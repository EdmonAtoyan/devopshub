"use client";

import { useEffect } from "react";

function setLoaderVisible(visible: boolean) {
  const loader = document.getElementById("global-loader");
  const app = document.getElementById("app-shell");
  if (!loader || !app) return;

  if (visible) {
    loader.classList.add("is-visible");
    loader.classList.remove("is-hidden");
    app.classList.remove("is-ready");
    return;
  }

  loader.classList.add("is-hidden");
  loader.classList.remove("is-visible");
  app.classList.add("is-ready");
}

export function NavigationLoader() {
  useEffect(() => {
    const hide = window.setTimeout(() => setLoaderVisible(false), 80);
    return () => window.clearTimeout(hide);
  }, []);

  useEffect(() => {
    const onBeforeUnload = () => {
      setLoaderVisible(true);
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  return null;
}
