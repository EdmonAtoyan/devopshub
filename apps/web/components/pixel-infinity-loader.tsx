"use client";

import type { CSSProperties } from "react";

type PixelInfinityLoaderProps = {
  className?: string;
  label?: string;
  compact?: boolean;
};

const PIXELS = [
  [0, 1], [1, 0], [2, 0], [3, 1], [4, 2], [4, 3], [3, 4], [2, 4], [1, 3], [2, 2],
  [5, 2], [6, 1], [7, 0], [8, 0], [9, 1], [10, 2], [10, 3], [9, 4], [8, 4], [7, 3],
];

export function PixelInfinityLoader({ className = "", label = "Loading...", compact = false }: PixelInfinityLoaderProps) {
  return (
    <div className={`pixel-loader-wrap ${compact ? "pixel-loader-wrap-compact" : ""} ${className}`.trim()}>
      <div className={`pixel-loader ${compact ? "pixel-loader-compact" : ""}`}>
        {PIXELS.map(([x, y], index) => (
          <span
            key={index}
            className="pixel-loader-dot"
            style={
              {
                "--x": x,
                "--y": y,
                "--i": index,
              } as CSSProperties
            }
          />
        ))}
      </div>
      {label ? <p className="pixel-loader-label">{label}</p> : null}
    </div>
  );
}
