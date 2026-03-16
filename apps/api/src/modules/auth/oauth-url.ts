const DEFAULT_SITE_URL = "http://localhost:3000";

export function resolveSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;
}

export function isGoogleOAuthConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_CALLBACK_URL?.trim(),
  );
}

export function buildClientUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${resolveSiteUrl().replace(/\/+$/, "")}${normalizedPath}`;
}
