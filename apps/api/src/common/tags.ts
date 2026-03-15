const MAX_TAGS_PER_RESOURCE = 10;
const MAX_TAG_LENGTH = 32;

export function normalizeTagNames(rawTags: string[]) {
  const normalized = rawTags
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .map((tag) => tag.replace(/\s+/g, "-").slice(0, MAX_TAG_LENGTH))
    .filter(Boolean);

  return Array.from(new Set(normalized)).slice(0, MAX_TAGS_PER_RESOURCE);
}
