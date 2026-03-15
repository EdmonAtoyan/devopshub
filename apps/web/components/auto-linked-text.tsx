import { ReactNode } from "react";

type AutoLinkedTextProps = {
  text: string;
};

const MARKDOWN_LINK_PATTERN =
  /\[([^\]\n]+)\]\(((?:https?:\/\/|www\.|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})(?:[^\s<>"']*))\)/gi;
const PLAIN_LINK_PATTERN =
  /(^|[\s(\[{"'<])((?:https?:\/\/[^\s<>"']+|(?:www\.|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})(?:[^\s<>"']*)))/gi;
const BARE_LINK_PATTERN =
  /^(?:www\.|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})(?::\d+)?(?:[/?#][^\s]*)?$/i;

export function AutoLinkedText({ text }: AutoLinkedTextProps) {
  return <>{linkifyText(text)}</>;
}

function linkifyText(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  MARKDOWN_LINK_PATTERN.lastIndex = 0;

  for (let match = MARKDOWN_LINK_PATTERN.exec(text); match !== null; match = MARKDOWN_LINK_PATTERN.exec(text)) {
    const [fullMatch, label, hrefCandidate] = match;

    if (cursor < match.index) {
      nodes.push(...linkifyPlainText(text.slice(cursor, match.index), () => `autolink-${key++}`));
    }

    const href = toSafeHref(hrefCandidate);
    if (href) {
      nodes.push(
        <a key={`markdown-link-${key++}`} href={href} target="_blank" rel="noopener noreferrer" className="auto-link">
          {label}
        </a>,
      );
    } else {
      nodes.push(fullMatch);
    }

    cursor = match.index + fullMatch.length;
  }

  if (cursor < text.length) {
    nodes.push(...linkifyPlainText(text.slice(cursor), () => `autolink-${key++}`));
  }

  return nodes.length > 0 ? nodes : [text];
}

function linkifyPlainText(text: string, createKey: () => string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  PLAIN_LINK_PATTERN.lastIndex = 0;

  for (let match = PLAIN_LINK_PATTERN.exec(text); match !== null; match = PLAIN_LINK_PATTERN.exec(text)) {
    const prefix = match[1] ?? "";
    const rawMatch = match[2];

    if (cursor < match.index) {
      nodes.push(text.slice(cursor, match.index));
    }

    if (prefix) {
      nodes.push(prefix);
    }

    const { linkText, trailingText } = splitTrailingPunctuation(rawMatch);
    const href = toSafeHref(linkText);

    if (href) {
      nodes.push(
        <a key={createKey()} href={href} target="_blank" rel="noopener noreferrer" className="auto-link">
          {linkText}
        </a>,
      );
    } else {
      nodes.push(rawMatch);
    }

    if (trailingText) {
      nodes.push(trailingText);
    }

    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes.length > 0 ? nodes : [text];
}

function splitTrailingPunctuation(value: string) {
  let linkText = value;
  let trailingText = "";

  while (linkText.length > 0) {
    const lastChar = linkText.at(-1);
    if (!lastChar) break;

    if (/[.,!?;:'"]/.test(lastChar)) {
      linkText = linkText.slice(0, -1);
      trailingText = `${lastChar}${trailingText}`;
      continue;
    }

    if (lastChar === ")" && countChar(linkText, "(") < countChar(linkText, ")")) {
      linkText = linkText.slice(0, -1);
      trailingText = `)${trailingText}`;
      continue;
    }

    if (lastChar === "]" && countChar(linkText, "[") < countChar(linkText, "]")) {
      linkText = linkText.slice(0, -1);
      trailingText = `]${trailingText}`;
      continue;
    }

    if (lastChar === "}" && countChar(linkText, "{") < countChar(linkText, "}")) {
      linkText = linkText.slice(0, -1);
      trailingText = `}${trailingText}`;
      continue;
    }

    if (lastChar === ">" && countChar(linkText, "<") < countChar(linkText, ">")) {
      linkText = linkText.slice(0, -1);
      trailingText = `>${trailingText}`;
      continue;
    }

    break;
  }

  return { linkText, trailingText };
}

function toSafeHref(value: string) {
  if (!value) return null;

  const normalizedValue = BARE_LINK_PATTERN.test(value) ? `https://${value}` : value;

  try {
    const url = new URL(normalizedValue);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function countChar(value: string, char: string) {
  let count = 0;

  for (const current of value) {
    if (current === char) count += 1;
  }

  return count;
}
