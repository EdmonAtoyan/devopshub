const DEFAULT_LOCAL_API_PORT = resolveNumericPort(
  process.env.API_PORT,
  "4000",
);
const DEFAULT_DIRECT_API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || "";
const DEFAULT_LEGACY_API_BASE = process.env.NEXT_PUBLIC_LEGACY_API_URL?.trim() || "/api";

const DIRECT_ROUTE_ALIASES: Record<string, string> = {
  auth: "auth",
  users: "users",
  feed: "posts",
  posts: "posts",
};

function resolveApiBase(configuredBase: string) {
  if (typeof window !== "undefined") {
    return normalizeApiBase(configuredBase);
  }

  const upstream = process.env.API_UPSTREAM_URL?.trim();
  const normalizedUpstream = normalizeApiUpstream(
    upstream ||
      (process.env.NODE_ENV === "production"
        ? `http://api:${DEFAULT_LOCAL_API_PORT}`
        : `http://127.0.0.1:${DEFAULT_LOCAL_API_PORT}`),
  );
  if (!configuredBase || configuredBase === "/") {
    return normalizedUpstream;
  }

  if (configuredBase.startsWith("/")) {
    return normalizeApiBase(`${normalizedUpstream}${configuredBase}`);
  }

  return normalizeApiBase(configuredBase);
}

function normalizeApiBase(value: string) {
  if (!value || value === "/") return "";
  return value.replace(/\/+$/, "");
}

function normalizeApiUpstream(value: string) {
  return normalizeApiBase(value).replace(/\/api$/i, "");
}

function resolveNumericPort(...candidates: Array<string | undefined>) {
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (!value || !/^\d+$/.test(value)) continue;
    return value;
  }

  return "4000";
}

function resolveApiTarget(path: string) {
  const clean = path.startsWith("/") ? path.slice(1) : path;
  const [firstSegment, ...rest] = clean.split("/");
  const directRoute = DIRECT_ROUTE_ALIASES[firstSegment];

  if (directRoute) {
    return {
      base: resolveApiBase(DEFAULT_DIRECT_API_BASE),
      path: [directRoute, ...rest].join("/"),
    };
  }

  return {
    base: resolveApiBase(DEFAULT_LEGACY_API_BASE),
    path: clean,
  };
}

function isFormDataBody(body: BodyInit | null | undefined): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

function isAbsoluteUrl(value: string) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function apiUrl(path: string) {
  const target = resolveApiTarget(path);
  return target.base ? `${target.base}/${target.path}` : `/${target.path}`;
}

export function assetUrl(path: string) {
  const clean = path.trim();
  if (!clean) return "";
  if (isAbsoluteUrl(clean)) return clean;
  return clean.startsWith("/") ? clean : `/${clean}`;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers || undefined);
  const hasBody = init?.body !== undefined && init?.body !== null;
  if (hasBody && !headers.has("Content-Type") && !isFormDataBody(init?.body)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as { message?: string | string[] };
      const message = Array.isArray(payload.message)
        ? payload.message.join(", ")
        : (payload.message ?? "Request failed");
      throw new Error(message);
    }

    const text = await response.text();
    throw new Error(text || "Request failed");
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
