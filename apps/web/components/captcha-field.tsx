"use client";

import Script from "next/script";
import { useEffect, useId, useRef, useState } from "react";

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
export const captchaEnabled = Boolean(turnstileSiteKey);

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          theme?: "auto" | "light" | "dark";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      remove?: (widgetId: string) => void;
    };
  }
}

type CaptchaFieldProps = {
  onTokenChange: (token: string) => void;
};

export function CaptchaField({ onTokenChange }: CaptchaFieldProps) {
  const containerId = useId().replace(/:/g, "");
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    onTokenChange("");
  }, [onTokenChange]);

  useEffect(() => {
    if (!captchaEnabled || !scriptReady || !window.turnstile) {
      return;
    }

    const container = document.getElementById(containerId);
    if (!container) {
      return;
    }

    container.innerHTML = "";
    widgetIdRef.current = window.turnstile.render(container, {
      sitekey: turnstileSiteKey,
      theme: "auto",
      callback: (token) => onTokenChange(token),
      "expired-callback": () => onTokenChange(""),
      "error-callback": () => onTokenChange(""),
    });

    return () => {
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [containerId, onTokenChange, scriptReady]);

  if (!captchaEnabled) {
    if (process.env.NODE_ENV === "production") {
      return null;
    }

    return (
      <div className="subtle-panel">
        <p className="text-xs leading-6 text-slate-400">
          Captcha will appear here when <code>NEXT_PUBLIC_TURNSTILE_SITE_KEY</code> is configured.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <p className="text-sm font-medium text-slate-200">Security check</p>
      <div className="subtle-panel overflow-hidden p-3">
        <div id={containerId} className="min-h-[4.5rem]" />
      </div>
    </div>
  );
}
