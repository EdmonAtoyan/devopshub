"use client";

import { useEffect, useState } from "react";

type ThemePreference = "system" | "light" | "dark";

function applyTheme(theme: ThemePreference) {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
    return;
  }
  root.setAttribute("data-theme", theme);
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<ThemePreference>("system");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as ThemePreference | null;
    const next = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    setTheme(next);
    applyTheme(next);
  }, []);

  const onChange = (next: ThemePreference) => {
    setTheme(next);
    localStorage.setItem("theme", next);
    applyTheme(next);
  };

  return (
    <div className={`${compact ? "flex items-center gap-2 text-xs" : "mt-4 flex items-center gap-2 text-xs"}`}>
      <span className="text-slate-400">Theme</span>
      <button
        type="button"
        className="rounded-md border border-line px-2 py-1"
        onClick={() => onChange("light")}
        aria-pressed={theme === "light"}
      >
        Light
      </button>
      <button
        type="button"
        className="rounded-md border border-line px-2 py-1"
        onClick={() => onChange("dark")}
        aria-pressed={theme === "dark"}
      >
        Dark
      </button>
      <button
        type="button"
        className="rounded-md border border-line px-2 py-1"
        onClick={() => onChange("system")}
        aria-pressed={theme === "system"}
      >
        System
      </button>
    </div>
  );
}
