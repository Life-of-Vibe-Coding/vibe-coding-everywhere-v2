/** Matches http/https URLs (exclude trailing punctuation; allow dots in path, : for port). */
export const URL_REGEX = /https?:\/\/[^\s\]\)\}\"']+?(?=[,;)\]}\s]|$)/g;

const LINK_PLACEHOLDER_PREFIX = "\u200B\u200BLINK";
const LINK_PLACEHOLDER_SUFFIX = "\u200B\u200B";

/** Remove YAML frontmatter (content between leading --- and next ---) from markdown. */
export function stripFrontmatter(content: string): string {
  if (!content || typeof content !== "string") return content;
  const trimmed = content.trimStart();
  if (!trimmed.startsWith("---\n")) return content;
  const afterFirst = trimmed.slice(4);
  const closingIdx = afterFirst.indexOf("\n---");
  if (closingIdx === -1) return content;
  return afterFirst.slice(closingIdx + 4).trimStart();
}

/** Wrap bare URLs in markdown link syntax so they render underlined and tappable. Preserves existing [text](url) links. */
export function wrapBareUrlsInMarkdown(content: string): string {
  const existingLinks: Array<{ text: string; url: string }> = [];
  const stripped = content.replace(/\[([^\]]*)\]\((https?:\/\/[^\)]+)\)/g, (_, text, url) => {
    const idx = existingLinks.length;
    existingLinks.push({ text, url });
    return LINK_PLACEHOLDER_PREFIX + idx + LINK_PLACEHOLDER_SUFFIX;
  });
  const withWrapped = stripped.replace(URL_REGEX, (url) => `[${url}](${url})`);
  return withWrapped.replace(
    new RegExp(LINK_PLACEHOLDER_PREFIX + "(\\d+)" + LINK_PLACEHOLDER_SUFFIX, "g"),
    (_, i) => {
      const { text, url } = existingLinks[Number(i)];
      return `[${text}](${url})`;
    }
  );
}

/** Parse text into alternating text and URL segments for rendering clickable links in plain text (e.g. code blocks, terminal output). */
export function parseTextWithUrlSegments(content: string): Array<{ type: "text" | "url"; value: string }> {
  if (!content || typeof content !== "string") return [];
  const segments: Array<{ type: "text" | "url"; value: string }> = [];
  let lastIndex = 0;
  let match;
  const re = new RegExp(URL_REGEX.source, "g");
  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    segments.push({ type: "url", value: match[0] });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }
  return segments.length > 0 ? segments : [{ type: "text" as const, value: content }];
}
