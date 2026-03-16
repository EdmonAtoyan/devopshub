import { BadRequestException } from "@nestjs/common";
import { stripReplyPrefix } from "./mentions";

const GIF_ALT_FALLBACK = "GIF reaction";
const GIF_ALT_MAX_LENGTH = 240;

type GifInput = {
  gifUrl?: string | null;
  gifAlt?: string | null;
};

export function normalizeGifInput(input: GifInput) {
  const gifUrl = input.gifUrl?.trim() ?? "";

  if (!gifUrl) {
    return {
      gifUrl: null,
      gifAlt: null,
    };
  }

  let parsed: URL;

  try {
    parsed = new URL(gifUrl);
  } catch {
    throw new BadRequestException("GIF URL must be a valid absolute URL");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new BadRequestException("GIF URL must use http or https");
  }

  const alt = input.gifAlt?.trim().slice(0, GIF_ALT_MAX_LENGTH) || GIF_ALT_FALLBACK;

  return {
    gifUrl: parsed.toString(),
    gifAlt: alt,
  };
}

export function assertRichContent(body: string, gifUrl?: string | null) {
  if (body.trim() || gifUrl) {
    return;
  }

  throw new BadRequestException("Content must include text or a GIF");
}

export function assertCommentContent(body: string, gifUrl?: string | null) {
  assertRichContent(stripReplyPrefix(body), gifUrl);
}
