const DEFAULT_SITE_URL = "http://localhost:3000";

export function resolveSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;
}

export function buildClientUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${resolveSiteUrl().replace(/\/+$/, "")}${normalizedPath}`;
}
