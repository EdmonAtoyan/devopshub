type PreviewOptions = {
  maxChars?: number;
  maxLines?: number;
};

export function createTextPreview(
  content: string,
  { maxChars = 250, maxLines = 10 }: PreviewOptions = {},
) {
  const lines = content.split("\n");
  const byLines = lines.slice(0, maxLines).join("\n");
  const byChars = content.slice(0, maxChars);
  const truncatedByChars = content.length > maxChars;
  const truncatedByLines = lines.length > maxLines;

  if (truncatedByChars && truncatedByLines) {
    const text = byLines.length < byChars.length ? byLines : `${byChars}...`;
    return { text, truncated: true };
  }

  if (truncatedByLines) return { text: `${byLines}...`, truncated: true };
  if (truncatedByChars) return { text: `${byChars}...`, truncated: true };
  return { text: content, truncated: false };
}
