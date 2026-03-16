"use client";

import { useEffect, useState } from "react";
import { GIF_ALT_FALLBACK, type GifAttachment as GifAttachmentValue } from "@/lib/gifs";

type GifAttachmentProps = {
  gif: GifAttachmentValue | null;
  showByDefault?: boolean;
  compact?: boolean;
  className?: string;
};

export function GifAttachment({
  gif,
  showByDefault = true,
  compact = false,
  className = "",
}: GifAttachmentProps) {
  const [visible, setVisible] = useState(showByDefault);

  useEffect(() => {
    setVisible(showByDefault);
  }, [showByDefault, gif?.url]);

  if (!gif?.url) {
    return null;
  }

  if (!visible) {
    return (
      <div className={`gif-placeholder ${className}`.trim()}>
        <span className="gif-placeholder-label">{GIF_ALT_FALLBACK}</span>
        <button type="button" className="gif-toggle-button" onClick={() => setVisible(true)}>
          Show
        </button>
      </div>
    );
  }

  return (
    <div className={`gif-player ${className}`.trim()}>
      <img
        src={gif.url}
        alt={gif.alt || GIF_ALT_FALLBACK}
        loading="lazy"
        className={`gif-player-image ${compact ? "gif-player-image-compact" : ""}`.trim()}
      />
      {!showByDefault ? (
        <button type="button" className="gif-toggle-button mt-2" onClick={() => setVisible(false)}>
          Hide
        </button>
      ) : null}
    </div>
  );
}
