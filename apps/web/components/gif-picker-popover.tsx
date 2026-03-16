"use client";

import { SearchIcon } from "@/components/icons";
import { apiRequest } from "@/lib/api";
import type { GifAttachment, GifSearchResponse, GifSearchResult } from "@/lib/gifs";
import { createPortal } from "react-dom";
import type { RefObject } from "react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

type PopoverPosition = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type GifPickerPopoverProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onSelect: (gif: GifAttachment) => void;
};

const POPOVER_GAP = 12;
const POPOVER_MARGIN = 16;
const POPOVER_MAX_WIDTH = 384;
const POPOVER_MAX_HEIGHT = 420;

export function GifPickerPopover({
  open,
  anchorRef,
  onClose,
  onSelect,
}: GifPickerPopoverProps) {
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const [results, setResults] = useState<GifSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) {
      setPosition(null);
      setLoading(false);
      setError("");
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (
        panelRef.current?.contains(event.target as Node) ||
        anchorRef.current?.contains(event.target as Node)
      ) {
        return;
      }

      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorRef, onClose, open]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const updatePosition = () => {
      const anchor = anchorRef.current;

      if (!anchor) {
        return;
      }

      const rect = anchor.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const width = Math.min(POPOVER_MAX_WIDTH, Math.max(280, viewportWidth - POPOVER_MARGIN * 2));
      const maxLeft = Math.max(POPOVER_MARGIN, viewportWidth - width - POPOVER_MARGIN);
      const availableAbove = Math.max(200, rect.top - POPOVER_GAP - POPOVER_MARGIN);
      const height = Math.min(POPOVER_MAX_HEIGHT, Math.max(220, availableAbove));

      setPosition({
        left: clamp(rect.right - width, POPOVER_MARGIN, maxLeft),
        top: clamp(rect.top - height - POPOVER_GAP, POPOVER_MARGIN, viewportHeight - height - POPOVER_MARGIN),
        width,
        height,
      });
    };

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;
    setLoading(true);
    setError("");

    const timer = window.setTimeout(() => {
      const path = `search/gifs?q=${encodeURIComponent(query.trim())}&limit=18`;

      void apiRequest<GifSearchResponse>(path)
        .then((response) => {
          if (!active) {
            return;
          }

          setConfigured(response.configured);
          setResults(response.results);
          setLoading(false);
        })
        .catch((caught) => {
          if (!active) {
            return;
          }

          setConfigured(true);
          setResults([]);
          setLoading(false);
          setError(caught instanceof Error ? caught.message : "GIF search is unavailable right now.");
        });
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  if (!open || !position || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      id={panelId}
      className="gif-picker-popover menu-pop"
      role="dialog"
      aria-label="GIF picker"
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        maxHeight: position.height,
      }}
    >
      <div className="gif-picker-header">
        <div className="search-input-wrap">
          <SearchIcon size={16} className="search-input-icon" />
          <input
            ref={inputRef}
            className="input search-input-field gif-picker-search"
            placeholder="Search GIFs"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      <div className="gif-picker-results">
        {!configured ? (
          <p className="gif-picker-empty">GIF search is unavailable until `TENOR_API_KEY` is configured.</p>
        ) : null}
        {configured && loading ? <p className="gif-picker-empty">Loading GIFs...</p> : null}
        {configured && !loading && error ? <p className="gif-picker-empty">{error}</p> : null}
        {configured && !loading && !error && results.length === 0 ? (
          <p className="gif-picker-empty">No GIFs matched that search.</p>
        ) : null}
        {configured && !loading && !error ? (
          <div className="gif-picker-grid">
            {results.map((result) => (
              <button
                key={result.id}
                type="button"
                className="gif-picker-result"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect({ url: result.url, alt: result.alt });
                  onClose();
                }}
              >
                <img
                  src={result.previewUrl}
                  alt={result.alt}
                  loading="lazy"
                  className="gif-picker-result-image"
                  style={{ aspectRatio: `${Math.max(result.width, 1)} / ${Math.max(result.height, 1)}` }}
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="gif-picker-footer">Powered by Tenor</div>
    </div>,
    document.body,
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
