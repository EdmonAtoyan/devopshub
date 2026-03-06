"use client";

import { useEffect, useState } from "react";

type AnimatedLogoProps = {
  className?: string;
  alt?: string;
};

export function AnimatedLogo({ className, alt = "DevOpsHub" }: AnimatedLogoProps) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let timer: number | undefined;
    let cancelled = false;

    const schedule = () => {
      const delay = 20_000 + Math.floor(Math.random() * 10_001);
      timer = window.setTimeout(() => {
        if (cancelled) return;
        setVersion(Date.now());
        schedule();
      }, delay);
    };

    schedule();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return <img src={`/logo.svg?v=${version}`} alt={alt} className={className} />;
}
