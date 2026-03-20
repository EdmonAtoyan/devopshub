import { CookieOptions, Request } from "express";

type SameSitePolicy = "lax" | "strict" | "none";

function toBoolean(value: string | undefined): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return null;
}

function resolveSameSite(request?: Request): SameSitePolicy {
  const configured = process.env.COOKIE_SAME_SITE?.trim().toLowerCase();
  if (configured === "lax" || configured === "strict" || configured === "none") {
    return configured;
  }

  if (!request) return "lax";

  const origin = request.get("origin");
  if (!origin) return "lax";

  try {
    const originUrl = new URL(origin);
    const siteUrl = process.env.SITE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (siteUrl) {
      const publicSiteUrl = new URL(siteUrl);
      if (publicSiteUrl.hostname === originUrl.hostname) {
        return "lax";
      }
    }

    const host = (request.get("x-forwarded-host") || request.get("host") || "").split(",")[0].trim();
    const proto = (request.get("x-forwarded-proto") || request.protocol || "http").split(",")[0].trim();
    if (!host) return "lax";

    const requestUrl = new URL(`${proto}://${host}`);
    return originUrl.hostname === requestUrl.hostname ? "lax" : "none";
  } catch {
    return "lax";
  }
}

function resolveSecure(request: Request | undefined, sameSite: SameSitePolicy): boolean {
  const configured = toBoolean(process.env.COOKIE_SECURE);
  if (configured !== null) {
    if (sameSite === "none" && !configured) return true;
    return configured;
  }

  if (sameSite === "none") return true;

  if (!request) {
    return (
      usesHttps(process.env.SITE_URL) ||
      usesHttps(process.env.NEXT_PUBLIC_SITE_URL) ||
      usesHttps(process.env.RESET_PASSWORD_BASE_URL)
    );
  }

  const forwardedProto = request.get("x-forwarded-proto");
  if (forwardedProto?.split(",")[0].trim() === "https") return true;
  if (request.secure) return true;
  if (usesHttps(request.get("origin"))) return true;
  if (usesHttps(process.env.SITE_URL)) return true;
  if (usesHttps(process.env.NEXT_PUBLIC_SITE_URL)) return true;
  return false;
}

function usesHttps(value: string | undefined) {
  if (!value) return false;

  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function authCookieOptions(request?: Request): CookieOptions {
  const sameSite = resolveSameSite(request);
  const secure = resolveSecure(request, sameSite);
  const domain = process.env.COOKIE_DOMAIN?.trim();

  const options: CookieOptions = {
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
    maxAge: 1000 * 60 * 60 * 24,
  };

  if (domain) {
    options.domain = domain;
  }

  return options;
}

export function authCookieClearOptions(request?: Request): CookieOptions {
  const options = authCookieOptions(request);
  return {
    httpOnly: options.httpOnly,
    sameSite: options.sameSite,
    secure: options.secure,
    path: options.path,
    domain: options.domain,
  };
}
