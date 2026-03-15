"use client";

import { useEffect, useState } from "react";

type ThemePreference = "dark" | "light";
const THEME_STORAGE_KEY = "theme";

function applyTheme(theme: ThemePreference) {
  document.documentElement.setAttribute("data-theme", theme);
}

function resolveThemePreference(): ThemePreference {
  if (typeof document !== "undefined") {
    const active = document.documentElement.getAttribute("data-theme");
    if (active === "light" || active === "dark") {
      return active;
    }
  }

  if (typeof window !== "undefined") {
    try {
      return window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  }

  return "dark";
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<ThemePreference>(() => resolveThemePreference());

  useEffect(() => {
    const next = resolveThemePreference();
    setTheme(next);
    applyTheme(next);
  }, []);

  const onChange = (next: ThemePreference) => {
    setTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
  };

  return (
    <div className={compact ? "flex flex-wrap items-center gap-2 text-xs" : "mt-4 flex flex-wrap items-center gap-2 text-xs"}>
      <span className="mr-1 text-slate-400">Theme</span>
      <button
        type="button"
        className={`rounded-lg border px-3 py-1.5 transition-colors ${
          theme === "dark" ? "border-accent/40 bg-accent/10 text-slate-100" : "border-line bg-slate-900 text-slate-300 hover:bg-slate-800"
        }`}
        onClick={() => onChange("dark")}
        aria-pressed={theme === "dark"}
      >
        Dark
      </button>
      <button
        type="button"
        className={`rounded-lg border px-3 py-1.5 transition-colors ${
          theme === "light" ? "border-accent/40 bg-accent/10 text-slate-100" : "border-line bg-slate-900 text-slate-300 hover:bg-slate-800"
        }`}
        onClick={() => onChange("light")}
        aria-pressed={theme === "light"}
      >
        Light
      </button>
    </div>
  );
}
