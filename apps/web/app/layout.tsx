import "./globals.css";
import { NavigationLoader } from "@/components/navigation-loader";
import type { Metadata } from "next";
import type { ReactNode } from "react";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

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

const themeInitScript = `
(() => {
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") {
      document.documentElement.setAttribute("data-theme", saved);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  } catch (_) {}
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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
