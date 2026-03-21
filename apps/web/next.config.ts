import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  async rewrites() {
    const upstream = resolveApiUpstream();
    return [
      {
        source: "/auth/:path*",
        destination: `${upstream}/auth/:path*`,
      },
      {
        source: "/users/:path*",
        destination: `${upstream}/users/:path*`,
      },
      {
        source: "/posts/:path*",
        destination: `${upstream}/posts/:path*`,
      },
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
  const explicitUpstream = process.env.API_UPSTREAM_URL?.trim();
  if (explicitUpstream) {
    return normalizeApiUpstream(explicitUpstream);
  }

  if (process.env.NODE_ENV === "production") {
    return `http://api:${resolveNumericPort(process.env.API_PORT, "4000")}`;
  }

  return `http://127.0.0.1:${resolveNumericPort(process.env.API_PORT, "4000")}`;
}

function normalizeApiUpstream(configured: string) {
  try {
    const parsed = new URL(configured);
    const basePath = parsed.pathname.replace(/\/api\/?$/i, "").replace(/\/+$/, "");
    return `${parsed.protocol}//${parsed.host}${basePath}`;
  } catch {
    return `http://127.0.0.1:${resolveNumericPort(process.env.API_PORT, "4000")}`;
  }
}

function resolveNumericPort(...candidates: Array<string | undefined>) {
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (!value || !/^\d+$/.test(value)) continue;
    return value;
  }

  return "4000";
}
