import React, { useMemo, useRef, useEffect, useCallback, useState } from "react";
import { View, Text, StyleSheet, Linking, Pressable, Alert, ScrollView, Platform, Dimensions } from "react-native";
import Markdown from "react-native-markdown-display";
import { useTheme } from "../../theme/index";
import type { Message } from "../../services/socket/hooks";
import { stripTrailingIncompleteTag } from "../../services/providers/stream";
import { PlayIcon, TerminalIcon, ChevronDownIcon } from "../icons/ChatActionIcons";
import { BookOpenIcon, PencilIcon, FilePenIcon } from "../icons/FileActivityIcons";
import { GeminiIcon, ClaudeIcon, CodexIcon } from "../icons/ProviderIcons";

function getFileName(path: string): string {
  const parts = path.replace(/\/$/, "").split(/[/\\]/);
  return parts[parts.length - 1] ?? path;
}

/** Replace span background-color highlights with text color using the provider's theme accent. */
function replaceHighlightWithTextColor(content: string, highlightColor: string): string {
  return content.replace(/style="([^"]+)"/gi, (match, inner) => {
    if (!/background-color\s*:/i.test(inner)) return match;
    const cleaned = inner
      .replace(/\s*background-color\s*:\s*[^;]+;?/gi, "")
      .replace(/\s*;\s*;\s*/g, ";")
      .replace(/^[\s;]+|[\s;]+$/g, "")
      .trim();
    return cleaned ? `style="color: ${highlightColor}; ${cleaned}"` : `style="color: ${highlightColor}"`;
  });
}

const BASH_LANGUAGES = new Set(["bash", "sh", "shell", "zsh"]);

/** Lines that are prose/headings, not runnable shell commands. Full command chain must be pure commands only. */
const NON_COMMAND_LINE_REGEX =
  /^\s*(#{2,}\s+.*|\*\*[^*]*\*\*\s*$|Command\s+execution\s+summary\s*$|Full\s+command\s+chain\s*\(.*\)\s*$|Terminal\s+\d+:\s*.*)$/i;

/** True if the trimmed line looks like prose (e.g. ends with period). Shell commands are not sentences. */
function looksLikeProse(trimmed: string): boolean {
  if (!trimmed) return false;
  return trimmed.endsWith(".");
}

/** Match "Terminal N: ..." section headers that must not appear inside a code block (log has one; UI must not show twice). */
const TERMINAL_HEADER_LINE_REGEX = /^\s*Terminal\s+\d+:\s*.+$/i;

/** Opening fence for bash-like blocks (bash, sh, shell, zsh). Case-insensitive. */
const BASH_FENCE_OPEN = /^```(bash|sh|shell|zsh)\s*$/im;

/**
 * If the model outputs an empty bash code block and the commands as plain text below,
 * the markdown parser gives the fence empty content and the commands render as paragraphs.
 * This function finds such empty bash blocks and moves the following command-like lines
 * into the block so they render inside the code block.
 */
export function fillEmptyBashBlocks(content: string): string {
  if (!content || typeof content !== "string") return content;
  const openMatch = content.match(BASH_FENCE_OPEN);
  if (!openMatch) return content;
  const openStart = content.indexOf(openMatch[0]);
  const openEnd = openStart + openMatch[0].length;
  const afterOpen = content.slice(openEnd);
  let closeIdx = afterOpen.search(/\r?\n```/);
  if (closeIdx === -1) {
    const bareClose = afterOpen.match(/^```/);
    if (bareClose) {
      closeIdx = 0;
    } else {
      return content;
    }
  }
  const blockBody = afterOpen.slice(0, closeIdx).trim();
  if (blockBody.length > 0) return content;
  const closeMatch = afterOpen.slice(closeIdx).match(/^(\r?\n)?```/);
  const closeFenceLen = closeMatch ? closeMatch[0].length : 4;
  const afterClose = afterOpen.slice(closeIdx + closeFenceLen).replace(/^\s*\r?\n?/, "");
  const lines = afterClose.split(/\r?\n/);
  const commandLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (t.startsWith("```")) break;
    if (!t) {
      if (commandLines.length > 0) commandLines.push(line);
      continue;
    }
    const isNonCommand = NON_COMMAND_LINE_REGEX.test(t) || looksLikeProse(t);
    if (isNonCommand && commandLines.length > 0) break;
    if (!isNonCommand) commandLines.push(line);
  }
  let linesToFill = commandLines;
  let beforeBlock = content.slice(0, openStart);
  let rest = "";
  if (commandLines.length === 0) {
    const beforeLines = beforeBlock.split(/\r?\n/);
    const trailingCommands: string[] = [];
    let firstTakenIndex = beforeLines.length;
    for (let i = beforeLines.length - 1; i >= 0; i--) {
      const line = beforeLines[i];
      const t = line.trim();
      if (!t) {
        if (trailingCommands.length > 0) trailingCommands.unshift(line);
        continue;
      }
      if (t.startsWith("```") || NON_COMMAND_LINE_REGEX.test(t) || looksLikeProse(t)) {
        firstTakenIndex = i + 1;
        break;
      }
      firstTakenIndex = i;
      trailingCommands.unshift(line);
    }
    if (trailingCommands.length === 0) return content;
    linesToFill = trailingCommands;
    beforeBlock = beforeLines.slice(0, firstTakenIndex).join("\n").replace(/\n+$/, "");
    if (beforeBlock.length > 0) beforeBlock = beforeBlock + "\n\n";
    else beforeBlock = "";
  } else {
    const restLines = lines.slice(commandLines.length);
    rest = restLines.join("\n").replace(/^\s*\n?/, "");
  }
  const lang = (openMatch[1] ?? "bash").toLowerCase();
  const filledBlock = "```" + lang + "\n" + linesToFill.join("\n").trimEnd() + "\n```";
  return beforeBlock + filledBlock + (rest ? "\n\n" + rest : "");
}

/** Remove trailing lines that are "Terminal N: ..." from code block content so they are only shown as markdown, not inside the block. */
function stripTrailingTerminalHeaderLines(content: string): string {
  const lines = content.split(/\r?\n/);
  let last = lines.length;
  while (last > 0 && TERMINAL_HEADER_LINE_REGEX.test(lines[last - 1]?.trim() ?? "")) last--;
  return lines.slice(0, last).join("\n").trimEnd();
}

/**
 * Extract runnable command only from a bash code block that may contain mixed content
 * (headings, "Command execution summary", or build-output prose). Ensures the full command chain
 * passed to the shell is pure commands only to avoid e.g. zsh "unmatched `" from prose with backticks.
 */
export function extractBashCommandOnly(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const commandLines: string[] = [];
  let started = false;
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      if (started) commandLines.push(line);
      continue;
    }
    const isNonCommand = NON_COMMAND_LINE_REGEX.test(t) || looksLikeProse(t);
    if (!started) {
      if (!isNonCommand) started = true;
      else continue;
    }
    if (isNonCommand) break;
    commandLines.push(line);
  }
  return commandLines.join("\n").trim();
}

/**
 * Match http/https URLs (exclude trailing punctuation; allow dots in path e.g. .html, and : for port e.g. :5174).
 * Renders according to output-enhancement prompt: prompts/output-enhancement/url.txt
 */
const URL_REGEX = /https?:\/\/[^\s\]\)\}\"']+?(?=[,;)\]}\s]|$)/g;

const LINK_PLACEHOLDER_PREFIX = "\u200B\u200BLINK";
const LINK_PLACEHOLDER_SUFFIX = "\u200B\u200B";
/** Supports both emoji (legacy) and non-emoji prefixes for backward compatibility. Groups: 1=prefix, 2=label, 3=encodedPath. */
const FILE_ACTIVITY_LINK_REGEX = /^((?:(?:📝\s*)?Writing|(?:✏️\s*)?Editing|(?:📖\s*)?Reading))\s+\[([^\]]+)\]\(file:([^)]+)\)\s*$/;

/** Matches "Running command:" or "🖥 Running command:" followed by newlines, `cmd`, optional Output block, and optional status (→ or ->). */
const BASH_COMMAND_BLOCK_REGEX = /(?:🖥\s*)?Running command:(?:\r?\n)+`([^`]*)`(?:(?:\r?\n)+Output:\r?\n```(?:[a-zA-Z0-9-]*)\r?\n([\s\S]*?)\r?\n```)?(?:(?:\r?\n)+(?:→|->)\s*(Completed|Failed)(?:\s*\((\d+)\))?)?/g;

/** Split regex to safely parse commands and outputs even if there is interleaved text between them. */
const COMMAND_RUN_SECTION_REGEX = /(?:(?:🖥\s*)?Running command:(?:\r?\n)+`([^`]*)`)|(?:Output:\r?\n```(?:[a-zA-Z0-9-]*)\r?\n([\s\S]*?)\r?\n```(?:(?:\r?\n)+(?:→|->)\s*(Completed|Failed)(?:\s*\((\d+)\))?)?)/g;

/** Status-only lines to filter out or assign to commands. */
const STATUS_ONLY_REGEX = /^(?:→|->)\s*(Completed|Failed)(?:\s*\((\d+)\))?\s*$/;

/** Extract command base (everything before the last space-separated token). Used to detect identical command patterns. */
function getCommandBase(cmd: string): string {
  const t = cmd.trim();
  const parts = t.split(/\s+/);
  if (parts.length <= 1) return t;
  return parts.slice(0, -1).join(" ");
}

/** Collapse consecutive identical command steps to show only the last one. */
export function collapseIdenticalCommandSteps(content: string): string {
  const blocks: Array<{ full: string; cmd: string }> = [];
  let m;
  const re = new RegExp(BASH_COMMAND_BLOCK_REGEX.source, "g");
  while ((m = re.exec(content)) !== null) {
    blocks.push({ full: m[0], cmd: m[1] });
  }
  if (blocks.length < 2) return content;

  const keepIndex = new Set<number>();
  let i = 0;
  while (i < blocks.length) {
    const base = getCommandBase(blocks[i].cmd);
    let j = i + 1;
    while (j < blocks.length && getCommandBase(blocks[j].cmd) === base) j++;
    keepIndex.add(j - 1);
    i = j;
  }

  let idx = 0;
  const collapsed = content.replace(re, (match) => (keepIndex.has(idx++) ? match : ""));
  return collapsed.replace(/\n{4,}/g, "\n\n\n");
}

/** Segment for compact command list: one row per command with optional status (mobile-friendly). */
export type CommandRunSegment = {
  kind: "command";
  command: string;
  output?: string;
  status?: "Completed" | "Failed";
  exitCode?: number;
};

type FileActivitySegment =
  | { kind: "file"; prefix: string; fileName: string; path: string }
  | { kind: "text"; text: string };

/** Splits content into markdown and command-run segments for mixed rendering (e.g. compact command list + rest as markdown). */
export function parseCommandRunSegments(content: string): Array<{ type: "markdown"; content: string } | CommandRunSegment> {
  const re = new RegExp(COMMAND_RUN_SECTION_REGEX.source, "g");
  const segments: Array<{ type: "markdown"; content: string } | CommandRunSegment> = [];
  let lastEnd = 0;
  let m;
  let currentCommand: CommandRunSegment | null = null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > lastEnd) {
      const slice = content.slice(lastEnd, m.index).trim();
      const lines = slice.split(/\n/).map((l) => l.trim()).filter(Boolean);
      const isAllStatusLines = lines.length > 0 && lines.every((l) => STATUS_ONLY_REGEX.test(l));
      if (slice.length && !isAllStatusLines) segments.push({ type: "markdown", content: slice });
    }
    if (m[1] !== undefined) {
      currentCommand = {
        kind: "command",
        command: m[1] ?? "",
        output: undefined,
        status: undefined,
        exitCode: undefined,
      };
      segments.push(currentCommand);
    } else if (m[2] !== undefined) {
      if (currentCommand) {
        currentCommand.output = m[2];
        currentCommand.status = (m[3] as "Completed" | "Failed" | undefined) ?? undefined;
        currentCommand.exitCode = m[4] != null ? parseInt(m[4], 10) : undefined;
      } else {
        segments.push({ type: "markdown", content: m[0] ?? "" });
      }
    }
    lastEnd = m.index + (m[0].length ?? 0);
  }
  if (lastEnd < content.length) {
    const slice = content.slice(lastEnd).trim();
    const lines = slice.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const isAllStatusLines = lines.length > 0 && lines.every((l) => STATUS_ONLY_REGEX.test(l));
    if (isAllStatusLines) {
      const statuses = lines
        .map((line) => {
          const mStatus = line.match(STATUS_ONLY_REGEX);
          return mStatus
            ? { status: mStatus[1] as "Completed" | "Failed", exitCode: mStatus[2] != null ? parseInt(mStatus[2], 10) : undefined }
            : null;
        })
        .filter((s): s is { status: "Completed" | "Failed"; exitCode: number | undefined } => s !== null);
      const cmdIndices: number[] = [];
      for (let i = segments.length - 1; i >= 0; i--) {
        if ((segments[i] as CommandRunSegment).kind === "command") cmdIndices.unshift(i);
      }
      for (let i = 0; i < statuses.length && i < cmdIndices.length; i++) {
        const s = statuses[i];
        if (!s) continue;
        const cmd = segments[cmdIndices[i]] as CommandRunSegment;
        cmd.status = s.status;
        cmd.exitCode = s.exitCode;
      }
    } else if (slice.length) {
      segments.push({ type: "markdown", content: slice });
    }
  }
  return segments;
}

function parseFileActivitySegments(content: string): FileActivitySegment[] {
  const lines = content.split(/\r?\n/);
  const raw: FileActivitySegment[] = lines.map((line) => {
    const match = line.match(FILE_ACTIVITY_LINK_REGEX);
    if (!match) return { kind: "text" as const, text: line };
    const prefix = match[1] ?? "";
    const rawName = (match[2] ?? "").trim();
    const fileName = rawName.replace(/^`(.+)`$/, "$1");
    const encodedPath = (match[3] ?? "").trim();
    let path = encodedPath;
    try {
      path = decodeURIComponent(encodedPath);
    } catch {
      // Keep original path when decode fails for malformed legacy links.
    }
    return { kind: "file" as const, prefix, fileName, path };
  });
  // Merge consecutive text segments so long read-result blocks (e.g. skill files) become one segment for collapse
  const merged: FileActivitySegment[] = [];
  let textAccum: string[] = [];
  const flushText = () => {
    if (textAccum.length > 0) {
      merged.push({ kind: "text", text: textAccum.join("\n") });
      textAccum = [];
    }
  };
  for (const seg of raw) {
    if (seg.kind === "file") {
      flushText();
      merged.push(seg);
    } else {
      textAccum.push(seg.text);
    }
  }
  flushText();
  return merged;
}

/** Wrap bare URLs in markdown link syntax so they render underlined and tappable. Preserves existing [text](url) links. */
function wrapBareUrlsInMarkdown(content: string): string {
  const existingLinks: Array<{ text: string; url: string }> = [];
  // Replace entire [text](url) so the link text (which may be a URL) is not wrapped again as a bare URL.
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

/** Max chars to show for read-result content (e.g. skill files) before collapsing. */
const MAX_READ_RESULT_PREVIEW = 1800;

export type ContentSegment =
  | { type: "thinking"; content: string }
  | { type: "text"; content: string };

/** Parses content into alternating thinking and text segments to maintain chronological order. */
export function parseContentSegments(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const THINKING_BLOCK_REGEX = /<think(?:_start)?>([\s\S]*?)(?:<\/think(?:_end)?>|$)/gi;
  let lastIndex = 0;
  let match;

  while ((match = THINKING_BLOCK_REGEX.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) {
        segments.push({ type: "text", content: text.replace(/\n{3,}/g, "\n\n") });
      }
    }
    const thinkContent = match[1].trim();
    if (thinkContent) {
      segments.push({ type: "thinking", content: thinkContent });
    }
    if (match.index === THINKING_BLOCK_REGEX.lastIndex) {
      THINKING_BLOCK_REGEX.lastIndex++;
    }
    lastIndex = THINKING_BLOCK_REGEX.lastIndex;
  }

  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) {
      segments.push({ type: "text", content: text.replace(/\n{3,}/g, "\n\n") });
    }
  }

  for (let i = 0; i < segments.length; i++) {
    if (segments[i].type === "text") {
      const hasThinkingAfter = segments.slice(i + 1).some(s => s.type === "thinking");
      if (hasThinkingAfter) {
        segments[i].type = "thinking";
      }
    }
  }

  const mergedSegments: ContentSegment[] = [];
  for (const seg of segments) {
    if (mergedSegments.length === 0) {
      mergedSegments.push({ ...seg });
    } else {
      const last = mergedSegments[mergedSegments.length - 1];
      if (last.type === seg.type) {
        last.content += "\n\n" + seg.content;
      } else {
        mergedSegments.push({ ...seg });
      }
    }
  }

  return mergedSegments;
}

/** Collapsible "Thinking" / "Show reasoning" block. Default collapsed, 44px min touch target, muted background. */
function CollapsibleThinkingBlock({
  content,
  theme,
  renderContent,
  initiallyExpanded = false,
}: {
  content: string;
  theme: { textMuted: string; accent: string };
  renderContent: (content: string) => React.ReactNode;
  initiallyExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded);

  // Track updates to initiallyExpanded so we can auto-expand/collapse as it streams
  useEffect(() => {
    setExpanded(initiallyExpanded);
  }, [initiallyExpanded]);

  const MIN_TOUCH = 44;
  return (
    <View
      style={{
        marginVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "transparent",
        backgroundColor: theme.textMuted + "15",
        overflow: "hidden",
      }}
    >
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 12,
          paddingHorizontal: 14,
          minHeight: MIN_TOUCH,
        }}
        accessibilityRole="button"
        accessibilityLabel={expanded ? "Hide reasoning" : "Show reasoning"}
        accessibilityState={{ expanded }}
      >
        <Text style={{ fontSize: 13, fontWeight: "600", color: theme.textMuted }}>
          {expanded ? "Reasoning" : "Show reasoning"}
        </Text>
        <View style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}>
          <ChevronDownIcon size={14} color={theme.textMuted} strokeWidth={2} />
        </View>
      </Pressable>
      {expanded && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
          {renderContent(content)}
        </View>
      )}
    </View>
  );
}

/** Collapsible block for long read results (skill files, etc.). Shows preview + "Show more" / "Show less". */
function CollapsibleReadResult({
  content,
  previewLength,
  markdownStyles,
  theme,
  markdownRules,
  onLinkPress,
  wrapBareUrls,
  replaceHighlight,
}: {
  content: string;
  previewLength: number;
  markdownStyles: React.ComponentProps<typeof Markdown>["style"];
  theme: { textMuted: string; accent: string };
  markdownRules: React.ComponentProps<typeof Markdown>["rules"];
  onLinkPress: (url: string) => boolean;
  wrapBareUrls: (s: string) => string;
  replaceHighlight: (s: string, c: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.length > previewLength;
  const preview = isLong ? content.slice(0, previewLength).trimEnd() + "\n\n…" : content;
  const moreChars = content.length - previewLength;
  const displayContent = expanded ? content : preview;

  return (
    <View style={isLong && !expanded ? { minHeight: 80 } : undefined}>
      <Markdown style={markdownStyles} mergeStyle rules={markdownRules ?? undefined} onLinkPress={onLinkPress}>
        {wrapBareUrls(replaceHighlight(displayContent, theme.accent))}
      </Markdown>
      {isLong && (
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          style={{ paddingVertical: 12, paddingRight: 12, alignSelf: "flex-start", minHeight: 44, justifyContent: "center" }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={expanded ? "Show less" : `Show more, ${moreChars.toLocaleString()} more characters`}
        >
          <Text style={{ fontSize: 13, color: theme.accent, fontWeight: "500" }}>
            {expanded ? "Show less" : `Show more (${moreChars.toLocaleString()} more characters)`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/** Matches file-activity lines from formatToolUseForDisplay (Writing, Reading, Editing). Supports emoji and non-emoji prefixes. */
export function hasFileActivityContent(content: string | null | undefined): boolean {
  if (!content || typeof content !== "string") return false;
  return (
    /(?:📝\s*)?Writing|(?:✏️\s*)?Editing|(?:📖\s*)?Reading/.test(content) ||
    /Writing\s*`|Editing\s*`|Reading\s*`/.test(content)
  );
}

/** True if content contains markdown fenced code blocks (```). */
export function hasCodeBlockContent(content: string | null | undefined): boolean {
  if (!content || typeof content !== "string") return false;
  return /```/.test(content);
}

interface MessageBubbleProps {
  message: Message;
  /** When true, the bubble content is the "Terminated" label (muted style). */
  isTerminatedLabel?: boolean;
  /** When true and assistant content, show content in a small scrollable tail box (max height from tailBoxMaxHeight). */
  showAsTailBox?: boolean;
  /** Max height for the tail box (e.g. half screen). Only used when showAsTailBox is true. */
  tailBoxMaxHeight?: number;
  /** AI provider for assistant messages; shows Gemini, Claude, or Codex icon when set. */
  provider?: "claude" | "gemini" | "codex" | "pi";
  /** When provided, bash code blocks are tappable; user can choose to run the command in a new terminal. */
  onRunBashCommand?: (command: string) => void;
  /** When provided, links (including bare URLs) open in the app's internal browser instead of external. */
  onOpenUrl?: (url: string) => void;
  /** When provided, file: links (from Writing/Editing/Reading) open the file in explorer. */
  onFileSelect?: (path: string) => void;
}

/** Shared message bubble colors — same logic for all providers (theme-driven). */
const TERMINAL_BG = "#1e293b";
const TERMINAL_TEXT = "rgba(255,255,255,0.9)";
const TERMINAL_PROMPT = "rgba(255,255,255,0.5)";

export function MessageBubble({ message, isTerminatedLabel, showAsTailBox, tailBoxMaxHeight = 360, provider, onRunBashCommand, onOpenUrl, onFileSelect }: MessageBubbleProps) {
  const theme = useTheme();
  const codeBlockBg = theme.surfaceBg;
  const codeTextColor = theme.accent;
  const quoteBg = theme.cardBg;
  const bashHeaderBg = theme.surfaceBg;
  const terminalBg = TERMINAL_BG;
  const terminalBorder = theme.borderColor;
  const terminalText = TERMINAL_TEXT;
  const terminalPrompt = TERMINAL_PROMPT;
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const refs = message.codeReferences ?? [];
  const tailScrollRef = useRef<ScrollView>(null);
  const markdownStyles = useMemo(
    () => ({
      body: { color: theme.textPrimary },
      text: { fontSize: 16, lineHeight: 26, color: theme.textPrimary },
      paragraph: { marginTop: 4, marginBottom: 4 },
      heading1: { fontSize: 20, lineHeight: 28 },
      heading2: { fontSize: 18, lineHeight: 26 },
      heading3: { fontSize: 16, lineHeight: 24, marginTop: 12, marginBottom: 4 },
      heading4: { fontSize: 15, lineHeight: 22 },
      heading5: { fontSize: 14, lineHeight: 20 },
      heading6: { fontSize: 13, lineHeight: 18 },
      link: { color: theme.accent, textDecorationLine: "underline" as const },
      code_inline: { color: codeTextColor, backgroundColor: "transparent", marginLeft: 4 },
      code_block: { color: codeTextColor, backgroundColor: "transparent" },
      fence: { color: codeTextColor, backgroundColor: "transparent" },
      blockquote: { backgroundColor: quoteBg, borderColor: theme.borderColor },
      strong: { fontWeight: "600" as const, color: theme.textPrimary },
      bullet_list: {
        marginTop: 8,
        marginBottom: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.borderColor,
      },
      bullet_list_icon: { marginLeft: 0, marginRight: 10, marginTop: 1, fontSize: 16 },
      bullet_list_content: { flex: 1 },
      ordered_list: {
        marginTop: 8,
        marginBottom: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.borderColor,
      },
      ordered_list_icon: { marginLeft: 0, marginRight: 10, marginTop: 1, fontSize: 16 },
      ordered_list_content: { flex: 1 },
      list_item: {
        flexDirection: "row" as const,
        marginBottom: 4,
        minHeight: 22,
        alignItems: "flex-start" as const,
      },
    }),
    [theme, codeBlockBg, codeTextColor, quoteBg]
  );
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: "row" as const, alignItems: "flex-start", gap: 10 },
        rowAssistant: { flexDirection: "column" as const, alignItems: "stretch" },
        rowUser: { flexDirection: "row" as const, justifyContent: "flex-end" },
        providerIconWrap: { width: 24, height: 24, marginBottom: 4 },
        bubble: {
          paddingVertical: 16,
          paddingHorizontal: 18,
          borderRadius: 18,
          backgroundColor: "transparent",
        },
        bubbleAssistant: { flex: 1, maxWidth: "96%" },
        bubbleUser: {
          maxWidth: "85%",
          borderWidth: 1,
          borderColor: theme.borderColor,
          backgroundColor: theme.mode === "dark" ? "#2a2e38" : "#e8e9ef",
        },
        bubbleSystem: {},
        bubbleText: { fontSize: 16, lineHeight: 26, color: theme.textPrimary },
        bubbleTextSystem: { fontSize: 13, color: theme.textMuted },
        bubbleTextTerminated: { color: theme.textMuted, fontStyle: "italic" as const },
        bubbleTextPlaceholder: { color: theme.textMuted, fontStyle: "italic" as const },
        fileActivityLine: { marginTop: 4, marginBottom: 4 },
        fileActivityFileName: { color: theme.textPrimary, fontWeight: "600" as const },
        fileActivityContainer: {
          marginLeft: -18,
          paddingLeft: 8,
          paddingRight: 4,
        },
        fileActivityRow: {
          flexDirection: "row" as const,
          alignItems: "center",
          paddingVertical: 12,
          paddingHorizontal: 14,
          marginBottom: 10,
          minHeight: 44,
          borderRadius: 8,
          borderLeftWidth: 4,
          gap: 10,
        },
        fileActivityRowRead: {
          backgroundColor: theme.mode === "dark" ? "rgba(59, 130, 246, 0.12)" : "rgba(59, 130, 246, 0.08)",
          borderLeftColor: "#3B82F6",
        },
        fileActivityRowEdit: {
          backgroundColor: theme.mode === "dark" ? "rgba(245, 158, 11, 0.12)" : "rgba(245, 158, 11, 0.08)",
          borderLeftColor: "#F59E0B",
        },
        fileActivityRowWrite: {
          backgroundColor: theme.mode === "dark" ? "rgba(16, 185, 129, 0.12)" : "rgba(16, 185, 129, 0.08)",
          borderLeftColor: "#10B981",
        },
        fileActivityActionLabel: { fontSize: 13, fontWeight: "600" as const },
        fileActivityActionRead: { color: "#3B82F6" },
        fileActivityActionEdit: { color: "#F59E0B" },
        fileActivityActionWrite: { color: "#10B981" },
        tailBoxScroll: { flexGrow: 0 },
        tailBoxContent: { paddingBottom: 12 },
        refPills: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8 },
        refPillsWithContent: { marginTop: 10 },
        refPill: {
          flexDirection: "row" as const,
          alignItems: "center",
          alignSelf: "flex-start",
          gap: 6,
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 12,
          backgroundColor: theme.accentLight,
        },
        refPillIcon: { fontSize: 12, color: theme.accent },
        refPillText: { fontSize: 13, color: theme.textPrimary, fontWeight: "500" as const },
        bashCodeBlockWrapper: {
          alignSelf: "stretch",
          marginVertical: 4,
          borderRadius: 8,
          overflow: "hidden" as const,
          backgroundColor: codeBlockBg,
          borderWidth: 1,
          borderColor: theme.borderColor,
        },
        bashCodeBlockHeader: {
          flexDirection: "row" as const,
          alignItems: "center",
          justifyContent: "flex-end",
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderBottomWidth: 1,
          borderBottomColor: theme.borderColor,
          backgroundColor: bashHeaderBg,
        },
        bashCodeBlockHeaderSpacer: { flex: 1 },
        bashRunButton: {
          flexDirection: "row" as const,
          alignItems: "center",
          gap: 4,
          paddingVertical: 4,
          paddingHorizontal: 12,
          borderRadius: 6,
          backgroundColor: theme.accent,
        },
        bashRunButtonPressed: { opacity: 0.85 },
        bashRunButtonText: { fontSize: 13, fontWeight: "600" as const, color: "#fff" },
        bashCodeBlock: { paddingHorizontal: 14, paddingVertical: 12 },
        commandRunSection: { marginVertical: 6, gap: 8, alignItems: "flex-start" as const },
        commandTerminalContainer: {
          alignSelf: "stretch" as const,
          width: "100%",
          maxWidth: "100%",
          borderWidth: 1,
          borderColor: terminalBorder,
          backgroundColor: terminalBg,
          borderRadius: 10,
          overflow: "hidden" as const,
        },
        commandTerminalHeader: {
          flexDirection: "row" as const,
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderBottomWidth: 1,
          borderBottomColor: terminalBorder,
        },
        commandTerminalTitle: { fontSize: 11, fontWeight: "600" as const, color: terminalPrompt },
        commandTerminalScrollBase: { overflow: "hidden" as const },
        commandTerminalContent: { paddingHorizontal: 10, paddingVertical: 8, paddingBottom: 12 },
        commandTerminalLine: {
          flexDirection: "row" as const,
          alignItems: "flex-start",
          gap: 6,
          paddingVertical: 4,
          minHeight: 24,
        },
        commandTerminalPrompt: {
          fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
          fontSize: 11,
          lineHeight: 20,
          color: terminalPrompt,
        },
        commandTerminalText: {
          flex: 1,
          fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
          fontSize: 11,
          lineHeight: 20,
          color: terminalText,
        },
        commandTerminalStatus: { fontSize: 10, lineHeight: 18, color: terminalPrompt },
      }),
    [theme, codeBlockBg, bashHeaderBg, terminalBg, terminalBorder, terminalText, terminalPrompt]
  );

  useEffect(() => {
    if (showAsTailBox && message.content) {
      tailScrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [showAsTailBox, message.content]);

  const handleMarkdownLinkPress = useCallback(
    (url: string): boolean => {
      if (url.startsWith("file:")) {
        const encodedPath = url.slice(5);
        let path = encodedPath;
        try {
          path = decodeURIComponent(encodedPath);
        } catch {
          // Backward compatibility for older unencoded or malformed file: links.
        }
        onFileSelect?.(path);
        return false;
      }
      if (onOpenUrl) {
        onOpenUrl(url);
        return false;
      }
      Linking.openURL(url);
      return false;
    },
    [onFileSelect, onOpenUrl]
  );

  const sanitizedContent = useMemo(
    () => collapseIdenticalCommandSteps(stripTrailingIncompleteTag(message.content ?? "")),
    [message.content]
  );
  const contentSegments = useMemo(
    () => parseContentSegments(sanitizedContent),
    [sanitizedContent]
  );

  const markdownRules = useMemo(() => {
    const base: Record<string, unknown> = {};
    if (!isUser && !isSystem) {
      base.text = (
        node: { key?: string; content?: string },
        children: React.ReactNode,
        _parent: unknown,
        mdStyles: Record<string, unknown>,
        inheritedStyles: Record<string, unknown> = {}
      ) => (
        <Text key={node.key} style={[inheritedStyles, mdStyles.text ?? markdownStyles.text]} selectable>
          {node.content ?? children}
        </Text>
      );
    }
    if (!onRunBashCommand && Object.keys(base).length === 0) return undefined;
    const rules: Record<string, unknown> = { ...base };
    if (onRunBashCommand) {
      rules.fence = (
        node: { key?: string; content?: string; sourceInfo?: string },
        _children: React.ReactNode,
        _parent: unknown,
        mdStyles: Record<string, unknown>,
        inheritedStyles: Record<string, unknown> = {}
      ) => {
        let content = node.content ?? "";
        if (typeof content === "string" && content.charAt(content.length - 1) === "\n") {
          content = content.substring(0, content.length - 1);
        }
        const lang = (node.sourceInfo ?? "").trim().toLowerCase().split(/\s/)[0] ?? "";
        const isBash = BASH_LANGUAGES.has(lang);
        const handleRunPress = () => {
          const trimmed = String(content).trim();
          if (!trimmed || !onRunBashCommand) return;
          const command = extractBashCommandOnly(trimmed) || trimmed;
          Alert.alert(
            "Run command",
            "Open a new terminal and run this command?",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Run", onPress: () => onRunBashCommand(command) },
            ]
          );
        };
        const displayContent = isBash
          ? (extractBashCommandOnly(content) || content)
          : stripTrailingTerminalHeaderLines(content);

        const { height: screenHeight } = Dimensions.get("window");
        const maxHeight = screenHeight * 0.75;

        const codeBlock = (
          <View
            key={node.key}
            style={[styles.bashCodeBlockWrapper, { maxHeight }]}
          >
            <ScrollView
              nestedScrollEnabled
              bounces={false}
              style={{ flexGrow: 0 }}
            >
              <ScrollView horizontal nestedScrollEnabled bounces={false} style={{ flexGrow: 0 }}>
                <View style={[styles.bashCodeBlock, { alignSelf: "flex-start" }]}>
                  <Text style={[inheritedStyles, mdStyles.fence ?? markdownStyles.fence]}>
                    {displayContent}
                  </Text>
                </View>
              </ScrollView>
            </ScrollView>
          </View>
        );

        if (isBash) {
          return (
            <View key={node.key} style={[styles.bashCodeBlockWrapper, { maxHeight }]}>
              <View style={styles.bashCodeBlockHeader}>
                <View style={styles.bashCodeBlockHeaderSpacer} />
                <Pressable
                  onPress={handleRunPress}
                  style={({ pressed }) => [styles.bashRunButton, pressed && styles.bashRunButtonPressed]}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel="Run command"
                >
                  <PlayIcon size={11} color="#fff" />
                  <Text style={styles.bashRunButtonText}>Run</Text>
                </Pressable>
              </View>
              <ScrollView
                nestedScrollEnabled
                bounces={false}
                style={{ flexGrow: 0 }}
              >
                <ScrollView horizontal nestedScrollEnabled bounces={false} style={{ flexGrow: 0 }}>
                  <View style={[styles.bashCodeBlock, { alignSelf: "flex-start" }]}>
                    <Text style={[inheritedStyles, mdStyles.fence ?? markdownStyles.fence]}>
                      {displayContent}
                    </Text>
                  </View>
                </ScrollView>
              </ScrollView>
            </View>
          );
        }
        return codeBlock;
      };
    }
    return rules as React.ComponentProps<typeof Markdown>["rules"];
  }, [onRunBashCommand, markdownStyles, styles, isUser, isSystem]);

  const getFileActivityRowStyle = useCallback(
    (prefix: string) => {
      const p = prefix.toLowerCase();
      if (p.includes("reading")) return [styles.fileActivityRow, styles.fileActivityRowRead];
      if (p.includes("editing")) return [styles.fileActivityRow, styles.fileActivityRowEdit];
      return [styles.fileActivityRow, styles.fileActivityRowWrite];
    },
    [styles]
  );

  const getFileActivityActionStyle = useCallback(
    (prefix: string) => {
      const p = prefix.toLowerCase();
      if (p.includes("reading")) return styles.fileActivityActionRead;
      if (p.includes("editing")) return styles.fileActivityActionEdit;
      return styles.fileActivityActionWrite;
    },
    [styles]
  );

  const FileActivityIcon = useCallback(
    ({ prefix }: { prefix: string }) => {
      const p = prefix.toLowerCase();
      const color =
        p.includes("reading") ? "#3B82F6"
          : p.includes("editing") ? "#F59E0B"
            : "#10B981";
      if (p.includes("reading")) return <BookOpenIcon color={color} />;
      if (p.includes("editing")) return <PencilIcon color={color} />;
      return <FilePenIcon color={color} />;
    },
    []
  );

  const renderActivitySegmentsContent = useCallback(
    (segments: FileActivitySegment[], keyPrefix: string = "root") => (
      <View key={keyPrefix} style={styles.fileActivityContainer}>
        {segments.map((seg, index) => {
          if (seg.kind === "file") {
            const actionLabel = seg.prefix.replace(/^[📖✏️📝]\s*/, "") || "File";
            return (
              <View key={`${keyPrefix}-file-activity-${index}`} style={getFileActivityRowStyle(seg.prefix)}>
                <FileActivityIcon prefix={seg.prefix} />
                <Text style={[styles.fileActivityActionLabel, getFileActivityActionStyle(seg.prefix)]}>
                  {actionLabel}
                </Text>
                <Pressable
                  style={{ flex: 1, minWidth: 0, minHeight: 44, justifyContent: "center" }}
                  onPress={() => onFileSelect?.(seg.path)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open file ${seg.fileName}`}
                >
                  <Text
                    style={styles.fileActivityFileName}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {seg.fileName}
                  </Text>
                </Pressable>
              </View>
            );
          }
          if (!seg.text.trim()) {
            return <View key={`${keyPrefix}-file-activity-space-${index}`} style={styles.fileActivityLine} />;
          }
          if (seg.text.length > MAX_READ_RESULT_PREVIEW) {
            return (
              <CollapsibleReadResult
                key={`${keyPrefix}-file-activity-text-${index}`}
                content={seg.text}
                previewLength={MAX_READ_RESULT_PREVIEW}
                markdownStyles={markdownStyles}
                theme={theme}
                markdownRules={markdownRules ?? undefined}
                onLinkPress={handleMarkdownLinkPress}
                wrapBareUrls={wrapBareUrlsInMarkdown}
                replaceHighlight={replaceHighlightWithTextColor}
              />
            );
          }
          return (
            <Markdown
              key={`${keyPrefix}-file-activity-text-${index}`}
              style={markdownStyles}
              mergeStyle
              rules={markdownRules}
              onLinkPress={handleMarkdownLinkPress}
            >
              {wrapBareUrlsInMarkdown(replaceHighlightWithTextColor(seg.text, theme.accent))}
            </Markdown>
          );
        })}
      </View>
    ),
    [
      FileActivityIcon,
      getFileActivityRowStyle,
      getFileActivityActionStyle,
      handleMarkdownLinkPress,
      markdownRules,
      markdownStyles,
      onFileSelect,
      styles,
      theme.accent,
    ]
  );

  const renderRichContent = useCallback(
    (textContent: string) => {
      const commandRunSegments = parseCommandRunSegments(textContent);
      const hasCommandRunSegments = commandRunSegments.some((s) => (s as { kind?: string }).kind === "command");
      const fileActivitySegments = parseFileActivitySegments(textContent);
      const hasRawFileActivityLinks = fileActivitySegments.some((seg) => seg.kind === "file");

      let markdownContent = replaceHighlightWithTextColor(textContent, theme.accent);
      for (let i = 0; i < 8; i++) {
        const next = fillEmptyBashBlocks(markdownContent);
        if (next === markdownContent) break;
        markdownContent = next;
      }

      if (hasCommandRunSegments) {
        const nodes: React.ReactNode[] = [];
        let commandGroup: CommandRunSegment[] = [];
        const COMMAND_LINE_HEIGHT = 32;
        const flushCommandGroup = (key: string) => {
          if (commandGroup.length === 0) return;
          const cmds = [...commandGroup];
          commandGroup = [];
          const hasOutput = cmds.some((c) => !!c.output);
          const visibleLines = Math.min(Math.max(cmds.length, 3), 6);
          const outputLineCount = hasOutput
            ? cmds.reduce((n, c) => n + (c.output ? c.output.trim().split(/\r?\n/).length : 0), 0)
            : 0;
          const scrollHeight = hasOutput
            ? Math.min(320, Math.max(80, outputLineCount * 24 + 48))
            : visibleLines * COMMAND_LINE_HEIGHT;
          nodes.push(
            <View
              key={key}
              style={styles.commandTerminalContainer}
            >
              <View style={styles.commandTerminalHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <TerminalIcon color={terminalPrompt} size={14} strokeWidth={1.8} />
                  <Text style={styles.commandTerminalTitle}>
                    Commands ({cmds.length})
                  </Text>
                </View>
              </View>
              <ScrollView
                style={[styles.commandTerminalScrollBase, hasOutput ? { maxHeight: scrollHeight } : { height: scrollHeight }]}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.commandTerminalContent} nestedScrollEnabled>
                  <View style={{ flex: 1, minWidth: "100%", paddingRight: 40 }}>
                    {cmds.map((cmd, i) => (
                      <View key={`line-${i}`}>
                        <View style={styles.commandTerminalLine}>
                          <Text style={styles.commandTerminalPrompt} selectable={false}>
                            $
                          </Text>
                          <Text style={[styles.commandTerminalText, { flex: 0 }]} selectable numberOfLines={cmd.output ? undefined : 1} ellipsizeMode="tail">
                            {cmd.command}
                          </Text>
                          {cmd.status && (
                            <Text
                              style={[
                                styles.commandTerminalStatus,
                                { color: cmd.status === "Failed" ? "#ef4444" : "#22c55e", paddingLeft: 6 },
                              ]}
                            >
                              {cmd.status}
                              {cmd.exitCode != null ? ` (${cmd.exitCode})` : ""}
                            </Text>
                          )}
                        </View>
                        {cmd.output ? (
                          <View style={{ marginTop: 4, marginBottom: 8, paddingLeft: 12 }}>
                            <Text style={[styles.commandTerminalText, { color: "rgba(255,255,255,0.7)", opacity: 0.8, flex: 0 }]} selectable>
                              {cmd.output}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </ScrollView>
            </View>
          );
        };
        let cmdKey = 0;
        commandRunSegments.forEach((seg, index) => {
          if ((seg as CommandRunSegment).kind === "command") {
            commandGroup.push(seg as CommandRunSegment);
          } else {
            flushCommandGroup(`terminal-${cmdKey++}`);
            const textSection = (seg as { type: "markdown"; content: string }).content;
            const subSegments = parseFileActivitySegments(textSection);
            if (subSegments.some((s) => s.kind === "file")) {
              nodes.push(renderActivitySegmentsContent(subSegments, `mixed-file-${index}`));
            } else {
              nodes.push(
                <Markdown
                  key={`md-${index}`}
                  style={markdownStyles}
                  mergeStyle
                  rules={markdownRules}
                  onLinkPress={handleMarkdownLinkPress}
                >
                  {wrapBareUrlsInMarkdown(
                    replaceHighlightWithTextColor(textSection, theme.accent)
                  )}
                </Markdown>
              );
            }
          }
        });
        flushCommandGroup(`terminal-${cmdKey}`);
        return <View style={styles.commandRunSection}>{nodes}</View>;
      } else if (hasRawFileActivityLinks) {
        return renderActivitySegmentsContent(fileActivitySegments, "root");
      } else {
        return (
          <Markdown
            style={markdownStyles}
            mergeStyle
            rules={markdownRules}
            onLinkPress={handleMarkdownLinkPress}
          >
            {wrapBareUrlsInMarkdown(markdownContent)}
          </Markdown>
        );
      }
    },
    [
      renderActivitySegmentsContent,
      handleMarkdownLinkPress,
      markdownRules,
      markdownStyles,
      styles,
      terminalPrompt,
      terminalText,
      theme.accent,
    ]
  );
  const showProviderIcon = !isUser && !isSystem && provider;
  const ProviderIcon =
    provider === "claude" ? ClaudeIcon : provider === "codex" || provider === "pi" ? CodexIcon : GeminiIcon;

  const isLatestThinkingBlock = useCallback((index: number) => {
    const isThinking = contentSegments[index]?.type === "thinking";
    if (!isThinking) return false;

    // It is the latest if there are no more 'thinking' blocks after it
    const hasMoreThinking = contentSegments.slice(index + 1).some(seg => seg.type === "thinking");
    return !hasMoreThinking;
  }, [contentSegments]);

  const bubbleContent = (
    <>
      {message.content && message.content.trim() !== "" ? (
        isTerminatedLabel ? (
          <Text
            style={[styles.bubbleText, styles.bubbleTextTerminated]}
            selectable={false}
          >
            {message.content}
          </Text>
        ) : isUser || isSystem ? (
          <Text
            style={[
              styles.bubbleText,
              isSystem && styles.bubbleTextSystem,
            ]}
            selectable
          >
            {message.content}
          </Text>
        ) : (
          <>
            {contentSegments.map((seg, i) => (
              seg.type === "thinking" ? (
                <CollapsibleThinkingBlock
                  key={`seg-${i}`}
                  content={seg.content}
                  theme={theme}
                  renderContent={renderRichContent}
                  initiallyExpanded={isLatestThinkingBlock(i)}
                />
              ) : (
                <React.Fragment key={`seg-${i}`}>
                  {renderRichContent(seg.content)}
                </React.Fragment>
              )
            ))}
          </>
        )
      ) : !isUser && !isSystem ? (
        <Text style={[styles.bubbleText, styles.bubbleTextPlaceholder]} selectable={false}>
          …
        </Text>
      ) : null}
      {refs.length > 0 && (
        <View style={[styles.refPills, message.content ? styles.refPillsWithContent : null]}>
          {refs.map((ref, index) => (
            <View key={`${ref.path}-${ref.startLine}-${index}`} style={styles.refPill}>
              <Text style={styles.refPillIcon}>◇</Text>
              <Text style={styles.refPillText} numberOfLines={1}>
                {getFileName(ref.path)} ({ref.startLine === ref.endLine ? ref.startLine : `${ref.startLine}-${ref.endLine}`})
              </Text>
            </View>
          ))}
        </View>
      )}
    </>
  );

  const bubbleLayoutProps = {};

  return (
    <View
      style={[
        styles.row,
        isUser && styles.rowUser,
        showProviderIcon && styles.rowAssistant,
      ]}
    >
      {showProviderIcon && (
        <View style={styles.providerIconWrap}>
          <ProviderIcon size={24} />
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser && styles.bubbleUser,
          isSystem && styles.bubbleSystem,
          !isUser && !isSystem && styles.bubbleAssistant,
        ]}
        {...bubbleLayoutProps}
      >
        {bubbleContent}
      </View>
    </View>
  );
}

