function resolveApiBase() {
  const envBase = process.env.NEXT_PUBLIC_API_URL;

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const origin = window.location.origin;
    const protocol = window.location.protocol;
    const tunnelHost = isTunnelHost(hostname);

    if (envBase) {
      const normalized = normalizeApiBase(envBase);

      try {
        const parsed = new URL(normalized);
        const isLocalTarget = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
        const isRemoteClient = hostname !== "localhost" && hostname !== "127.0.0.1";
        const isPrivateTarget = isPrivateHost(parsed.hostname);

        if (isLocalTarget && isRemoteClient) {
          parsed.hostname = hostname;
          parsed.protocol = protocol;
          return parsed.toString().replace(/\/$/, "");
        }

        if (isPrivateTarget && (tunnelHost || !isPrivateHost(hostname))) {
          return `${origin}/api`;
        }

        return parsed.toString().replace(/\/$/, "");
      } catch {
        if (normalized.startsWith("/")) {
          return `${origin}${normalized}`;
        }
        return `${origin}/api`;
      }
    }

    return `${origin}/api`;
  }

  return normalizeApiBase(envBase || "http://localhost:4000/api");
}

function normalizeApiBase(value: string) {
  const trimmed = value.replace(/\/+$/, "");
  return /\/api$/i.test(trimmed) ? trimmed : `${trimmed}/api`;
}

function isPrivateHost(hostname: string) {
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return true;
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return true;
  if (hostname === "0.0.0.0") return true;
  return false;
}

function isTunnelHost(hostname: string) {
  return (
    hostname.endsWith(".ngrok-free.app") ||
    hostname.endsWith(".ngrok-free.dev") ||
    hostname.endsWith(".ngrok.io") ||
    hostname.endsWith(".ngrok.app")
  );
}

const API_BASE = resolveApiBase();
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, "");

export function apiUrl(path: string) {
  const clean = path.startsWith("/") ? path.slice(1) : path;
  return `${API_BASE}/${clean}`;
}

export function assetUrl(path: string) {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${API_ORIGIN}${clean}`;
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers || undefined);
  const hasBody = init?.body !== undefined && init?.body !== null;
  if (hasBody && !headers.has("Content-Type")) {
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
  return response.json() as Promise<T>;
}
