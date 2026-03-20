const DEFAULT_SITE_URL = "http://localhost:3000";

export function resolveSiteUrl() {
  const configured =
    process.env.SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SITE_URL or NEXT_PUBLIC_SITE_URL must be configured in production");
  }

  return DEFAULT_SITE_URL;
}

export function resolveGoogleCallbackUrl() {
  const configured = process.env.GOOGLE_CALLBACK_URL?.trim();
  if (configured) {
    return trimTrailingSlash(configured);
  }

  return buildClientUrl("/api/auth/google/callback");
}

export function isGoogleOAuthConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
}

export function buildClientUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${resolveSiteUrl()}${normalizedPath}`;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}
