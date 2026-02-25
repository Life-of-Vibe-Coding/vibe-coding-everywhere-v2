const ANSI_REGEX =
  /\x1B\[[0-9;?]*[ -/]*[@-~]|\x1B\][^\x07]*(?:\x07|\x1B\\)|\x1B[@-_]|\x1B.|[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

// ---------------------------------------------------------------------------
// Claude stream format (CLI JSON lines over PTY)
// ---------------------------------------------------------------------------

/** Claude session start (session_id, model, cwd). */
export interface ClaudeSystemEvent {
  type: "system";
  session_id?: string;
  model?: string;
  cwd?: string;
}

/** Claude assistant content: message.content[] with text and/or tool_use. */
export interface ClaudeAssistantContentBlock {
  type: "text" | "tool_use";
  text?: string;
  name?: string;
  input?: unknown;
}

export interface ClaudeAssistantEvent {
  type: "assistant";
  message?: { content?: ClaudeAssistantContentBlock[] };
}

/** Claude streaming delta (content_block_delta). */
export interface ClaudeStreamEventPayload {
  type: "stream_event";
  event?: { type?: string; delta?: { text?: string } };
}

/** Claude tool input request (input / permission_request). */
export interface ClaudeInputEvent {
  type: "input" | "permission_request";
  tool_name?: string;
  tool?: string;
  prompt?: string;
  message?: string;
  description?: string;
}

/** Claude user echo (no UI). */
export interface ClaudeUserEvent {
  type: "user";
}

/** Claude result summary at stream end. */
export interface ClaudeResultEvent {
  type: "result";
  result?: string;
}

export type ClaudeStreamOutput =
  | ClaudeSystemEvent
  | ClaudeAssistantEvent
  | ClaudeStreamEventPayload
  | ClaudeInputEvent
  | ClaudeUserEvent
  | ClaudeResultEvent;

/** Input sent to Claude CLI (e.g. user reply to tool request). */
export interface ClaudeStreamInput {
  message?: { content?: Array<{ type: string; content?: string }> };
}

const CLAUDE_STREAM_TYPES: readonly string[] = [
  "system",
  "assistant",
  "stream_event",
  "input",
  "permission_request",
  "user",
  "result",
];

export function isClaudeStreamOutput(data: unknown): data is ClaudeStreamOutput {
  if (typeof data !== "object" || data === null) return false;
  const t = (data as Record<string, unknown>).type;
  return typeof t === "string" && CLAUDE_STREAM_TYPES.includes(t);
}

// ---------------------------------------------------------------------------
// Gemini stream format (CLI JSON lines over PTY)
// ---------------------------------------------------------------------------

/** Gemini session start (init). */
export interface GeminiInitEvent {
  type: "init";
  session_id?: string;
  model?: string;
  cwd?: string;
}

/** Gemini message: string content (with optional delta) or message.content/parts. */
export interface GeminiMessageEvent {
  type: "message";
  role?: "user" | "assistant" | "model";
  /** When true, content is a delta chunk. */
  delta?: boolean;
  content?: string | Array<{ type?: string; text?: string; name?: string; input?: unknown }>;
  message?: { content?: unknown[]; parts?: unknown[] };
}

/** Gemini standalone tool_use (tool_id, tool_name, parameters). */
export interface GeminiToolUseEvent {
  type: "tool_use";
  tool_id?: string;
  tool_name?: string;
  tool?: string;
  parameters?: Record<string, unknown>;
  tool_input?: Record<string, unknown>;
  input?: Record<string, unknown>;
}

/** Gemini tool_result (e.g. policy_violation for permission denial). */
export interface GeminiToolResultEvent {
  type: "tool_result";
  tool_id?: string;
  tool_name?: string;
  status?: string;
  error?: { type?: string; message?: string };
}

export type GeminiStreamOutput =
  | GeminiInitEvent
  | GeminiMessageEvent
  | GeminiToolUseEvent
  | GeminiToolResultEvent;

/** Input sent to Gemini CLI (e.g. user reply / tool result). */
export interface GeminiStreamInput {
  message?: { content?: unknown[]; parts?: unknown[] };
  content?: string;
}

const GEMINI_STREAM_TYPES: readonly string[] = ["init", "message", "tool_use", "tool_result"];

export function isGeminiStreamOutput(data: unknown): data is GeminiStreamOutput {
  if (typeof data !== "object" || data === null) return false;
  const t = (data as Record<string, unknown>).type;
  return typeof t === "string" && GEMINI_STREAM_TYPES.includes(t);
}

// ---------------------------------------------------------------------------
// Codex stream format (normalized events emitted from codex app-server RPC).
// ---------------------------------------------------------------------------

/** Codex thread started (thread_id is session id for resume). */
export interface CodexThreadStartedEvent {
  type: "thread.started";
  thread_id?: string;
}

/** Codex turn lifecycle. */
export interface CodexTurnStartedEvent {
  type: "turn.started";
}
export interface CodexTurnCompletedEvent {
  type: "turn.completed";
  usage?: { input_tokens?: number; cached_input_tokens?: number; output_tokens?: number };
}
export interface CodexTurnFailedEvent {
  type: "turn.failed";
  error?: { message?: string };
}

/** Codex item events (item.started, item.updated, item.completed). */
export interface CodexItemEvent {
  type: "item.started" | "item.updated" | "item.completed";
  item?: {
    id?: string;
    type?: string;
    text?: string;
    command?: string;
    aggregated_output?: string;
    exit_code?: number;
    status?: string;
    changes?: Array<{ path?: string; kind?: string }>;
    server?: string;
    tool?: string;
    arguments?: unknown;
    result?: { content?: string; structured_content?: unknown };
    error?: string;
  };
}

/** Codex top-level error. */
export interface CodexErrorEvent {
  type: "error";
  message?: string;
}

export type CodexStreamOutput =
  | CodexThreadStartedEvent
  | CodexTurnStartedEvent
  | CodexTurnCompletedEvent
  | CodexTurnFailedEvent
  | CodexItemEvent
  | CodexErrorEvent;

const CODEX_STREAM_TYPES: readonly string[] = [
  "thread.started",
  "turn.started",
  "turn.completed",
  "turn.failed",
  "item.started",
  "item.updated",
  "item.completed",
  "error",
];

export function isCodexStreamOutput(data: unknown): data is CodexStreamOutput {
  if (typeof data !== "object" || data === null) return false;
  const t = (data as Record<string, unknown>).type;
  return typeof t === "string" && CODEX_STREAM_TYPES.includes(t);
}

// ---------------------------------------------------------------------------
// Pi RPC stream format (native Pi protocol from pi --mode rpc)
// ---------------------------------------------------------------------------

export interface PiAgentStartEvent {
  type: "agent_start";
}
/** Agent turn lifecycle marker from Pi stream. UI completion is driven by SSE event:"end"/"done", not this event. */
export interface PiAgentEndEvent {
  type: "agent_end";
  messages?: unknown[];
}
export interface PiMessageUpdateEvent {
  type: "message_update";
  message?: Record<string, unknown>;
  assistantMessageEvent?: {
    type: string;
    delta?: string;
    content?: string;
    toolCall?: { id?: string; name?: string; arguments?: Record<string, unknown> };
  };
}
export interface PiToolExecutionEvent {
  type: "tool_execution_start" | "tool_execution_update" | "tool_execution_end";
  toolCallId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  partialResult?: { content?: unknown[] };
  result?: { content?: unknown[] };
  isError?: boolean;
}
export interface PiResponseEvent {
  type: "response";
  id?: string;
  command?: string;
  success?: boolean;
  error?: string;
}
export interface PiExtensionErrorEvent {
  type: "extension_error";
  error?: string;
}

export type PiStreamOutput =
  | PiAgentStartEvent
  | PiAgentEndEvent
  | PiMessageUpdateEvent
  | PiToolExecutionEvent
  | PiResponseEvent
  | PiExtensionErrorEvent
  | { type: "turn_start" | "turn_end" | "message_start" | "message_end" | "auto_compaction_start" | "auto_compaction_end" | "auto_retry_start" | "auto_retry_end"; [key: string]: unknown };

const PI_STREAM_TYPES: readonly string[] = [
  "agent_start",
  "agent_end",
  "turn_start",
  "turn_end",
  "message_start",
  "message_update",
  "message_end",
  "tool_execution_start",
  "tool_execution_update",
  "tool_execution_end",
  "response",
  "extension_error",
  "auto_compaction_start",
  "auto_compaction_end",
  "auto_retry_start",
  "auto_retry_end",
];

export function isPiStreamOutput(data: unknown): data is PiStreamOutput {
  if (typeof data !== "object" || data === null) return false;
  const t = (data as Record<string, unknown>).type;
  return typeof t === "string" && PI_STREAM_TYPES.includes(t);
}

export const RENDER_CMD_REGEX = /Run the following command for render:\s*"([^"]+)"/i;
/** Matches both quoted "url" and bare http(s) URLs for agent output flexibility (keyin). */
export const RENDER_URL_REGEX = /URL for preview:\s*(?:"([^"]+)"|(https?:\/\/[^\s"'<>]+))/i;
/** Message is "not verified" (need permission) — do not show verified-style run bar. */
export const NEED_PERMISSION_REGEX = /Need permission for the following commands:/i;

export function stripAnsi(value: string): string {
  if (!value) return "";
  return value.replace(ANSI_REGEX, "");
}

/** Regex for command-style opening tags: <u 'command' u> or <u'command'u> (spaces optional). */
const COMMAND_OPEN_TAG_REGEX = /<u\s*'[^']*'\s*u>/gi;
/** Closing tag for command span. */
const COMMAND_CLOSE_TAG_REGEX = /<\/u>/gi;
/** Leading fragment when stream chunk starts with tail of opening tag (e.g. "' u>", "' command' u>"). */
const LEADING_OPEN_TAG_FRAGMENT_REGEX = /^\s*'[^']*'\s*u>\s*|^\s*'\s*u>\s*/i;
/** Trailing incomplete opening tag at end: either no closing quote ("<u 'command") or no ">" ("<u 'command' u"). */
const TRAILING_OPEN_TAG_FRAGMENT_REGEX = /<u\s*'[^']*'(?:\s*u?\s*)?$|<u\s*'[^']*$/i;
/** Trailing incomplete closing tag (e.g. "</u" without ">"). */
const TRAILING_CLOSE_TAG_FRAGMENT_REGEX = /<\/u\s*$/i;
/** Leading bare "<u" not part of full command tag (PTY-injected before JSON line). Remove so we don't show "<u{...}". */
const LEADING_BARE_U_REGEX = /^\s*<u(?!\s*'[^']*'\s*u>)/gm;

/** Known bash/zsh system messages to hide from terminal output display. */
const BASH_NOISE_PATTERNS = [
  /^bash:\s*no job control in this shell\s*$/i,
  /^The default interactive shell is now zsh\.\s*To update your account to use zsh,\s*please run\s+[`']chsh\s+-s\s+\/bin\/zsh[`']\.?\s*$/i,
  /^The default interactive shell is now zsh\.\s*$/i,
  /^To update your account to use zsh,\s*please run\s+[`']chsh\s+-s\s+\/bin\/zsh[`']\.?\s*$/i,
  /^For more details,\s*please visit\s+https:\/\/support\.apple\.com\/kb\/HT208050\.?\s*$/i,
  /^bash-\d+\.\d+\$?\s*$/,
];

/**
 * Strip command-style tags from text while preserving the content inside.
 * Handles: <u 'command' u>content</u> → content
 * Safe for streaming: strips leading/trailing incomplete tag fragments when the tag
 * is split across chunks (e.g. chunk1: "<u 'command", chunk2: "' u>ls</u>").
 */
export function stripCommandStyleTags(value: string): string {
  if (!value || typeof value !== "string") return value;
  let out = value
    .replace(COMMAND_OPEN_TAG_REGEX, "")
    .replace(COMMAND_CLOSE_TAG_REGEX, "");
  // Remove leading fragment (chunk started with tail of opening tag, e.g. "' u>ls")
  out = out.replace(LEADING_OPEN_TAG_FRAGMENT_REGEX, "");
  // Remove leading "<u" when not a full command tag (e.g. PTY-injected "<u" before JSON)
  out = out.replace(LEADING_BARE_U_REGEX, "");
  // Remove trailing incomplete fragments from chunked stream
  out = out.replace(TRAILING_OPEN_TAG_FRAGMENT_REGEX, "").replace(TRAILING_CLOSE_TAG_FRAGMENT_REGEX, "");
  return out;
}

/**
 * Filter out known bash shell system messages from terminal output.
 * Also strips command-style tags <u'...'u> while keeping inner content.
 */
export function filterBashNoise(chunk: string): string {
  if (!chunk || typeof chunk !== "string") return "";
  const plain = stripAnsi(chunk);
  const lines = plain.split(/\r?\n/);
  const kept = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true; // keep blank lines
    return !BASH_NOISE_PATTERNS.some((p) => p.test(trimmed));
  });
  const result = kept
    .map((line) => stripCommandStyleTags(line))
    .join("\n");
  return result.trim() ? result : "";
}

/** Remove incomplete tag fragments and command-style tags from chat/terminal output. Preserves content inside tags. */
export function stripTrailingIncompleteTag(value: string): string {
  return stripCommandStyleTags(value ?? "");
}

export function extractRenderCommandAndUrl(text: string | null | undefined): { command: string; url: string } | null {
  if (!text || typeof text !== "string") return null;
  if (NEED_PERMISSION_REGEX.test(text)) return null;
  const cmdMatch = text.match(RENDER_CMD_REGEX);
  const urlMatch = text.match(RENDER_URL_REGEX);
  const url = urlMatch?.[1] ?? urlMatch?.[2]; // quoted group 1 or bare group 2
  if (!cmdMatch?.[1] || !url) return null;
  return { command: cmdMatch[1].trim(), url: url.trim() };
}

/** Payload is AskUserQuestion tool call (tool_name + tool_input.questions). */
export function isAskUserQuestionPayload(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (String(obj.tool_name ?? "") !== "AskUserQuestion") return false;
  const input = obj.tool_input as Record<string, unknown> | undefined;
  return Array.isArray(input?.questions) && (input.questions as unknown[]).length > 0;
}

/** Union of all provider transport stream output types currently in use. */
export type ProviderStreamOutput = PiStreamOutput | ClaudeStreamOutput | GeminiStreamOutput | CodexStreamOutput;

/** Check for transport stream events and permission payloads from the active provider runtimes. */
export function isProviderStream(data: unknown): data is ProviderStreamOutput | (Record<string, unknown> & { permission_denials: unknown[] }) {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    isPiStreamOutput(obj) ||
    Array.isArray(obj.permission_denials) ||
    isAskUserQuestionPayload(obj)
  );
}


export function deniedToolToAllowedPattern(toolName: string | null | undefined): string | null {
  if (!toolName || typeof toolName !== "string") return null;
  const t = toolName.trim();
  if (t === "Bash") return "Bash(*)";
  if (["Write", "Edit", "Read"].includes(t)) return t;
  return t;
}

/**
 * Known provider CLI system noise lines to suppress from chat display.
 * These are startup/diagnostic messages from Gemini/Claude CLI that should not appear in the chat UI.
 */
const PROVIDER_NOISE_PATTERNS = [
  /^Approval mode overridden/i,
  /^Loaded cached credentials/i,
  /^Project hooks disabled/i,
  /^Hook registry initialized/i,
  /^The current folder is not trusted/i,
  /^To update your account/i,
  /^For more details,?\s*please visit/i,
  /^✓\s*(Model|Session|Sandbox)/i,
  /^Using model:/i,
];

/** Returns true if the line is known CLI system noise that should be suppressed from chat display. */
export function isProviderSystemNoise(line: string): boolean {
  if (!line || typeof line !== "string") return false;
  const trimmed = line.trim();
  if (!trimmed) return false;
  return PROVIDER_NOISE_PATTERNS.some((p) => p.test(trimmed));
}

/** Codex stderr: "state db missing rollout path for thread" — session is invalid; filter and handle in UI. */
const CODEX_SESSION_INVALID_STDERR = /missing\s+rollout\s+path\s+for\s+thread/i;

export function isCodexSessionInvalidStderr(line: string): boolean {
  if (!line || typeof line !== "string") return false;
  return CODEX_SESSION_INVALID_STDERR.test(line);
}

export function getAllowedToolsFromDenials(denials: Array<{ tool_name?: string; tool?: string }>): string[] {
  if (!Array.isArray(denials) || !denials.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const denial of denials) {
    const pattern = deniedToolToAllowedPattern(denial.tool_name ?? denial.tool ?? "");
    if (pattern && !seen.has(pattern)) {
      seen.add(pattern);
      out.push(pattern);
    }
  }
  return out;
}
