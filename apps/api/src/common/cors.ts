type CorsCallback = (error: Error | null, allow?: boolean) => void;

export function corsOriginValidator(origin: string | undefined, callback: CorsCallback) {
  if (!origin) {
    callback(null, true);
    return;
  }

  const allowedOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (isAllowedOrigin(origin, allowedOrigins)) {
    callback(null, true);
    return;
  }

  callback(new Error("Origin not allowed by CORS"), false);
}

function isAllowedOrigin(origin: string, allowList: string[]) {
  if (allowList.includes(origin)) return true;

  for (const rule of allowList) {
    if (!rule.includes("*")) continue;
    const pattern = new RegExp(
      `^${rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`,
    );
    if (pattern.test(origin)) return true;
  }

  if (process.env.ALLOW_NGROK_ORIGINS?.toLowerCase() !== "false") {
    try {
      const parsed = new URL(origin);
      if (parsed.hostname === "localhost") return true;
      if (parsed.hostname === "127.0.0.1") return true;
      if (parsed.hostname === "0.0.0.0") return true;

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
      if (siteUrl) {
        const site = new URL(siteUrl);
        if (site.origin === origin) return true;
      }

      if (parsed.hostname.endsWith(".ngrok-free.app")) return true;
      if (parsed.hostname.endsWith(".ngrok-free.dev")) return true;
      if (parsed.hostname.endsWith(".ngrok.io")) return true;
      if (parsed.hostname.endsWith(".ngrok.app")) return true;
    } catch {
      return false;
    }
  }

  return false;
}
