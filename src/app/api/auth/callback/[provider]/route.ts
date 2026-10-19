import { NextRequest, NextResponse } from "next/server";
import {
  authRepository,
  AUTH_COOKIE_NAME,
  OAUTH_STATE_COOKIE_NAME,
  verifyOAuthState,
} from "@/lib/auth/authService";
import { OAuthProfile } from "@/lib/auth/authTypes";

interface RouteParams {
  params: Promise<{
    provider: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { provider } = await params;
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Validate provider
  if (provider !== "google" && provider !== "facebook") {
    return NextResponse.redirect(new URL("/?auth=login&error=INVALID_PROVIDER", request.url));
  }

  // 1. Verify CSRF State via HMAC signature and/or cookie
  const storedStateCookie = request.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value;
  const verifiedState = state ? verifyOAuthState(state) : null;
  const isStateValid = Boolean(
    verifiedState ||
    (state && storedStateCookie && state === storedStateCookie)
  );

  if (!isStateValid) {
    const errorUrl = new URL(
      `/?auth=login&error=OAUTH_STATE_MISMATCH&provider=${provider}`,
      request.url
    );
    const response = NextResponse.redirect(errorUrl);
    response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
    return response;
  }

  // Parse state payload
  let callbackUrl = "/";
  if (verifiedState?.callbackUrl) {
    callbackUrl = verifiedState.callbackUrl;
  } else if (state) {
    try {
      const raw = state.includes(".") ? state.split(".")[0] : state;
      const parsedState = JSON.parse(Buffer.from(raw, "base64url").toString("utf-8"));
      callbackUrl = parsedState.callbackUrl || "/";
    } catch (e) {
      callbackUrl = "/";
    }
  }

  // 2. Handle User Cancellation / Provider Errors
  if (oauthError) {
    const isCancelled = oauthError === "access_denied";
    const redirectUrl = new URL(
      `/?auth=login&error=${isCancelled ? "OAUTH_CANCELLED" : "OAUTH_FAILED"}&provider=${provider}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
      request.url
    );
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
    return response;
  }

  if (!code) {
    const response = NextResponse.redirect(
      new URL(`/?auth=login&error=OAUTH_MISSING_CODE&provider=${provider}&callbackUrl=${encodeURIComponent(callbackUrl)}`, request.url)
    );
    response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
    return response;
  }

  // 3. Exchange Code for Access Token on Server
  const isGoogle = provider === "google";
  const clientId = isGoogle
    ? process.env.GOOGLE_CLIENT_ID
    : process.env.FACEBOOK_CLIENT_ID;
  const clientSecret = isGoogle
    ? process.env.GOOGLE_CLIENT_SECRET
    : process.env.FACEBOOK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const response = NextResponse.redirect(
      new URL(`/?auth=login&error=OAUTH_NOT_CONFIGURED&provider=${provider}&callbackUrl=${encodeURIComponent(callbackUrl)}`, request.url)
    );
    response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
    return response;
  }

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto") || (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
  const normalizedHost = host.replace("127.0.0.1", "localhost");
  const origin = isLocal ? `${protocol}://${normalizedHost}` : (process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`);
  const redirectUri = verifiedState?.redirectUri || `${origin}${request.nextUrl.pathname}`;

  let profile: OAuthProfile;

  try {
    if (isGoogle) {
      // Exchange code for Google Access Token
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const errorText = await tokenRes.text();
        console.error("Google token exchange error:", errorText);
        const errorUrl = new URL(
          `/?auth=login&error=OAUTH_EXCHANGE_ERROR&provider=${provider}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
          request.url
        );
        const response = NextResponse.redirect(errorUrl);
        response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
        return response;
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      // Fetch verified userinfo from Google
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!userInfoRes.ok) {
        console.error("Google userinfo fetch error:", await userInfoRes.text());
        const errorUrl = new URL(
          `/?auth=login&error=OAUTH_EXCHANGE_ERROR&provider=${provider}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
          request.url
        );
        const response = NextResponse.redirect(errorUrl);
        response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
        return response;
      }

      const userInfo = await userInfoRes.json();

      profile = {
        provider: "google",
        providerAccountId: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name || userInfo.given_name || "Google User",
        avatarUrl: userInfo.picture,
      };
    } else {
      // Exchange code for Facebook Access Token
      const fbTokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
      fbTokenUrl.searchParams.set("client_id", clientId);
      fbTokenUrl.searchParams.set("client_secret", clientSecret);
      fbTokenUrl.searchParams.set("redirect_uri", redirectUri);
      fbTokenUrl.searchParams.set("code", code);

      const tokenRes = await fetch(fbTokenUrl.toString());
      if (!tokenRes.ok) {
        const errorText = await tokenRes.text();
        console.error("Facebook token exchange error:", errorText);
        const errorUrl = new URL(
          `/?auth=login&error=OAUTH_EXCHANGE_ERROR&provider=${provider}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
          request.url
        );
        const response = NextResponse.redirect(errorUrl);
        response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
        return response;
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      // Fetch user profile from Facebook Graph API
      const fbUserUrl = new URL("https://graph.facebook.com/me");
      fbUserUrl.searchParams.set("fields", "id,name,email,picture.type(large)");
      fbUserUrl.searchParams.set("access_token", accessToken);

      const userInfoRes = await fetch(fbUserUrl.toString());
      if (!userInfoRes.ok) {
        console.error("Facebook userinfo fetch error:", await userInfoRes.text());
        const errorUrl = new URL(
          `/?auth=login&error=OAUTH_EXCHANGE_ERROR&provider=${provider}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
          request.url
        );
        const response = NextResponse.redirect(errorUrl);
        response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
        return response;
      }

      const fbInfo = await userInfoRes.json();

      profile = {
        provider: "facebook",
        providerAccountId: fbInfo.id,
        email: fbInfo.email || `${fbInfo.id}@facebook.user.rubyfilm.vn`,
        name: fbInfo.name || "Facebook User",
        avatarUrl: fbInfo.picture?.data?.url,
      };
    }

    // 4. Resolve or Link User in Repository
    const authUser = await authRepository.findOrCreateFromOAuth(profile);

    // 5. Create Secure Session
    const session = await authRepository.createSession(authUser);

    // 6. Set Session Cookie & Clean Up
    const destinationUrl = new URL(callbackUrl.startsWith("/") ? callbackUrl : `/${callbackUrl}`, origin);
    destinationUrl.searchParams.set("auth_success", provider);
    const response = NextResponse.redirect(destinationUrl);

    response.cookies.set(AUTH_COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" && !isLocal,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    const userHint = Buffer.from(
      JSON.stringify({
        id: authUser.id,
        name: authUser.name,
        email: authUser.email,
        avatarUrl: authUser.avatarUrl,
        role: authUser.role,
        providers: authUser.providers,
      })
    ).toString("base64url");

    response.cookies.set("rubbyfilm_user_hint", userHint, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production" && !isLocal,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
    return response;
  } catch (error: any) {
    console.error(`OAuth callback error [${provider}]:`, error?.message || error);
    const errorUrl = new URL(
      `/?auth=login&error=SERVER_ERROR&provider=${provider}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
      request.url
    );
    const response = NextResponse.redirect(errorUrl);
    response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
    return response;
  }
}
