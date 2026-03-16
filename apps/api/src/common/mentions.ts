const MENTION_PATTERN = /(^|[^a-z0-9._-])@([a-z0-9][a-z0-9._-]{0,29})/gi;
const REPLY_PREFIX_PATTERN = /^@reply:[a-zA-Z0-9_-]+\n/;

export function stripReplyPrefix(text: string) {
  return text.replace(REPLY_PREFIX_PATTERN, "");
}

export function extractMentionUsernames(text: string) {
  const cleanText = stripReplyPrefix(text);
  const usernames: string[] = [];
  const seen = new Set<string>();

  MENTION_PATTERN.lastIndex = 0;

  for (let match = MENTION_PATTERN.exec(cleanText); match !== null; match = MENTION_PATTERN.exec(cleanText)) {
    const username = match[2]?.trim().toLowerCase();
    if (!username || seen.has(username)) {
      continue;
    }

    seen.add(username);
    usernames.push(username);
  }

  return usernames;
}
