export const GIF_ALT_FALLBACK = "GIF reaction";

export type GifAttachment = {
  url: string;
  alt?: string;
};

export type GifCarrier = {
  gifUrl?: string | null;
  gifAlt?: string | null;
};

export type GifSearchResult = {
  id: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
  alt: string;
};

export type GifSearchResponse = {
  configured: boolean;
  provider: string;
  results: GifSearchResult[];
};

export function toGifAttachment(value?: GifCarrier | null): GifAttachment | null {
  const url = value?.gifUrl?.trim();

  if (!url) {
    return null;
  }

  return {
    url,
    alt: value?.gifAlt?.trim() || GIF_ALT_FALLBACK,
  };
}

export function toGifPayload(gif?: GifAttachment | null) {
  return {
    gifUrl: gif?.url ?? "",
    gifAlt: gif?.alt ?? "",
  };
}

export function hasComposerContent(body: string, gif?: GifAttachment | null) {
  return body.trim().length > 0 || !!gif?.url;
}
