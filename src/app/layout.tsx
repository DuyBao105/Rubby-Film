import type { Metadata, Viewport } from "next";
import * as React from "react";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BottomNav } from "@/components/layout/bottom-nav";
import { movieProvider } from "@/lib/providers";
import { Be_Vietnam_Pro, Space_Grotesk } from "next/font/google";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-be-vietnam-pro",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-space-grotesk",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0D0F12",
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rubyfilm.vn";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "RubyFilm - Nền tảng xem phim trực tuyến hiện đại",
    template: "%s | RubyFilm",
  },
  description: "RubyFilm mang đến trải nghiệm xem phim điện ảnh đỉnh cao, chất lượng 4K Ultra HD, tốc độ mượt mà và giao diện chuẩn quốc tế.",
  keywords: ["xem phim", "phim moi", "phim hd", "phim chieu rap", "phim bo", "phim le", "rubyfilm", "phim vietsub"],
  authors: [{ name: "RubyFilm Team" }],
  creator: "RubyFilm",
  publisher: "RubyFilm",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: siteUrl,
    title: "RubyFilm - Nền tảng xem phim trực tuyến hiện đại",
    description: "Khám phá thế giới phim ảnh chất lượng cao 4K Ultra HD, cập nhật phim mới nhanh nhất với tốc độ mượt mà.",
    siteName: "RubyFilm",
  },
  twitter: {
    card: "summary_large_image",
    title: "RubyFilm - Nền tảng xem phim trực tuyến hiện đại",
    description: "Khám phá thế giới phim ảnh chất lượng cao 4K Ultra HD, cập nhật phim mới nhanh nhất với tốc độ mượt mà.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RubyFilm",
  },
};

import { ToastProvider } from "@/components/ui/toast";
import { AuthProvider } from "@/lib/auth/authContext";
import { AuthModal } from "@/components/auth/auth-modal";
import { LogoutConfirmModal } from "@/components/auth/logout-confirm-modal";
import { SwipeBackNavigation } from "@/components/common/swipe-back-navigation";

import { NavigationProgressBar } from "@/components/common/navigation-progress-bar";
import { AnalyticsHeartbeat } from "@/components/analytics/analytics-heartbeat";
import { PwaInstallPrompt } from "@/components/common/pwa-install-prompt";
import { AntiDevtools } from "@/components/common/anti-devtools";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [genres, countries] = await Promise.all([
    movieProvider.getGenres(),
    movieProvider.getCountries(),
  ]);

  return (
    <html lang="vi" className="dark" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Preconnect & DNS-prefetch for public media CDNs */}
        <link rel="preconnect" href="https://phimimg.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://phimimg.com" />
        <link rel="preconnect" href="https://image.tmdb.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://image.tmdb.org" />
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        {/* Auto-recover from stale Service Worker / deployment chunk mismatches */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Auto-unregister any stale service worker & clear caches to prevent hydration mismatches
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(regs) {
                  for (var i = 0; i < regs.length; i++) {
                    regs[i].unregister();
                  }
                });
              }
              if ('caches' in window) {
                caches.keys().then(function(keys) {
                  for (var i = 0; i < keys.length; i++) {
                    caches.delete(keys[i]);
                  }
                });
              }
              window.addEventListener('error', function(e) {
                var msg = (e && e.message) ? e.message.toLowerCase() : '';
                if (msg.indexOf('hydration') !== -1 || msg.indexOf('loading chunk') !== -1 || msg.indexOf('chunkloaderror') !== -1 || msg.indexOf('unexpected token') !== -1) {
                  var lastReload = sessionStorage.getItem('rubyfilm_chunk_reload');
                  var now = Date.now();
                  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
                    sessionStorage.setItem('rubyfilm_chunk_reload', String(now));
                    if ('caches' in window) {
                      caches.keys().then(function(keys) {
                        keys.forEach(function(k) { caches.delete(k); });
                      });
                    }
                    setTimeout(function() { window.location.reload(); }, 200);
                  }
                }
              });
            `,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${beVietnamPro.variable} ${spaceGrotesk.variable} ${beVietnamPro.className} font-sans min-h-screen flex flex-col bg-[#0F0F0F] text-[#D1D5DB] antialiased selection:bg-brand selection:text-white`}
      >
        <React.Suspense fallback={null}>
          <AnalyticsHeartbeat />
        </React.Suspense>
        <React.Suspense fallback={null}>
          <NavigationProgressBar />
        </React.Suspense>
        <ToastProvider>
          <AuthProvider>
            <AntiDevtools />
            <SwipeBackNavigation />
            <PwaInstallPrompt />
            <AuthModal />
            <LogoutConfirmModal />
            <React.Suspense fallback={null}>
              <Header genres={genres} countries={countries} />
            </React.Suspense>
            <main className="flex-grow flex flex-col pb-20 md:pb-0">{children}</main>
            <Footer />
            <BottomNav />
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
