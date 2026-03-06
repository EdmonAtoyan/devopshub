import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  async rewrites() {
    const upstream = resolveApiUpstream();
    return [
      {
        source: "/api/:path*",
        destination: `${upstream}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${upstream}/uploads/:path*`,
      },
      {
        source: "/socket.io/:path*",
        destination: `${upstream}/socket.io/:path*`,
      },
    ];
  },
};

export default nextConfig;

function resolveApiUpstream() {
  const configured = process.env.API_UPSTREAM_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001/api";

  if (configured.startsWith("/")) {
    return "http://127.0.0.1:3001";
  }

  try {
    const parsed = new URL(configured);
    const basePath = parsed.pathname.replace(/\/api\/?$/i, "").replace(/\/+$/, "");
    return `${parsed.protocol}//${parsed.host}${basePath}`;
  } catch {
    return "http://127.0.0.1:3001";
  }
}
