import "./globals.css";
import { NavigationLoader } from "@/components/navigation-loader";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

const siteUrl = resolveSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "DevOps Hub",
    template: "%s | DevOps Hub",
  },
  description: "Developer-focused DevOps community for infrastructure engineering, tools, and knowledge sharing.",
  openGraph: {
    title: "DevOps Hub",
    description: "DevOps community platform for SREs, platform teams, and cloud engineers.",
    url: siteUrl,
    siteName: "DevOps Hub",
    type: "website",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "DevOps Hub",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DevOps Hub",
    description: "Developer-focused DevOps community platform.",
    images: ["/og-image.svg"],
  },
  alternates: {
    canonical: "/",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

const themeInitScript = `
(() => {
  try {
    const saved = localStorage.getItem("theme");
    document.documentElement.setAttribute("data-theme", saved === "light" ? "light" : "dark");
  } catch (_) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body suppressHydrationWarning>
        <div suppressHydrationWarning id="global-loader" className="global-loader is-visible" aria-live="polite" aria-label="Loading">
          <img id="global-loader-logo" src="/logo.svg" alt="DevOpsHub loading" className="global-loader-logo" />
        </div>
        <div suppressHydrationWarning id="app-shell" className="app-shell">
          {children}
        </div>
        <NavigationLoader />
      </body>
    </html>
  );
}

function resolveSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured;

  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL must be configured in production");
  }

  return "http://localhost:3000";
}
