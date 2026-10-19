import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { OAUTH_STATE_COOKIE_NAME, signOAuthState } from "@/lib/auth/authService";

interface RouteParams {
  params: Promise<{
    provider: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { provider } = await params;
  const searchParams = request.nextUrl.searchParams;
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  // Validate provider
  if (provider !== "google" && provider !== "facebook") {
    return NextResponse.redirect(
      new URL(
        `/?auth=login&error=INVALID_PROVIDER&callbackUrl=${encodeURIComponent(callbackUrl)}`,
        request.url
      )
    );
  }

  // Check server-side credentials
  const isGoogle = provider === "google";
  const clientId = isGoogle
    ? process.env.GOOGLE_CLIENT_ID
    : process.env.FACEBOOK_CLIENT_ID;
  const clientSecret = isGoogle
    ? process.env.GOOGLE_CLIENT_SECRET
    : process.env.FACEBOOK_CLIENT_SECRET;

  // Gracefully handle unconfigured credentials with an informative user notification
  if (!clientId || !clientSecret || clientId.startsWith("your_") || clientSecret.startsWith("your_")) {
    const errorUrl = new URL(
      `/?auth=login&error=OAUTH_NOT_CONFIGURED&provider=${provider}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
      request.url
    );
    return NextResponse.redirect(errorUrl);
  }

  // Determine Origin & Redirect URI
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
  const protocol = request.headers.get("x-forwarded-proto") || (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
  // Prioritize actual request host on localhost/LAN, use NEXT_PUBLIC_SITE_URL in production if set
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
  const normalizedHost = host.replace("127.0.0.1", "localhost");
  const origin = isLocal ? `${protocol}://${normalizedHost}` : (process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`);
  const redirectUri = `${origin}/api/auth/oauth/${provider}/callback`;

  // Generate cryptographically secure signed state
  const stateRandom = crypto.randomBytes(16).toString("hex");
  const statePayload = signOAuthState({
    state: stateRandom,
    provider,
    callbackUrl,
    redirectUri,
    timestamp: Date.now(),
  });

  let authUrl = "";

  if (isGoogle) {
    const googleParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state: statePayload,
      access_type: "online",
      prompt: "select_account",
    });
    authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${googleParams.toString()}`;
  } else {
    // Facebook OAuth 2.0 Dialog
    const fbParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "email,public_profile",
      state: statePayload,
    });
    authUrl = `https://www.facebook.com/v19.0/dialog/oauth?${fbParams.toString()}`;
  }

  const response = NextResponse.redirect(authUrl);

  // Set secure HttpOnly state cookie (10 minutes expiry)
  response.cookies.set(OAUTH_STATE_COOKIE_NAME, statePayload, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && !isLocal,
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60, // 10 minutes
  });

  return response;
}
