/**
 * Core domain types and interfaces.
 * 
 * This module defines all domain types using:
 * - Interface Segregation: Small, focused interfaces
 * - Type safety: Strongly typed domain entities
 * - Documentation: Every type is documented
 * 
 * Components and hooks depend on these abstractions instead of concrete implementations,
 * enabling dependency injection and easier testing.
 */

/** 
 * Code reference for display in chat messages.
 * Shows file name and line numbers for code blocks.
 */
export type CodeReference = {
  /** File path relative to workspace */
  path: string;
  /** Starting line number (1-based) */
  startLine: number;
  /** Ending line number (1-based) */
  endLine: number;
};

/** 
 * Chat message in the conversation.
 * Can be from user, assistant, or system.
 */
export type Message = {
  /** Unique message identifier */
  id: string;
  /** Message author role */
  role: "user" | "assistant" | "system";
  /** Message content (markdown supported) */
  content: string;
  /** Optional code references for context */
  codeReferences?: CodeReference[];
};

/**
 * Pending render command extracted from Claude output.
 * Shown in the UI for user to execute.
 */
export type PendingRender = {
  /** Shell command to execute */
  command: string;
  /** Preview URL associated with the command */
  url: string;
};

/**
 * Permission denial from Claude.
 * Occurs when Claude requests tool use that requires permission.
 */
export type PermissionDenial = {
  /** Tool name that was denied */
  tool_name?: string;
  /** Alternative tool property */
  tool?: string;
  /** Tool input parameters */
  tool_input?: { file_path?: string; path?: string };
};

/**
 * Options from the last Claude run.
 * Used for retrying with same settings.
 */
export type LastRunOptions = {
  /** Permission mode used */
  permissionMode: string | null;
  /** Allowed tool patterns */
  allowedTools: string[];
  /** Whether --continue flag was used */
  useContinue: boolean;
};

/**
 * State of a terminal process.
 * Used for run-render and interactive terminals.
 */
export type TerminalState = {
  /** Unique terminal identifier */
  id: string;
  /** Process ID (null if not available) */
  pid: number | null;
  /** Output lines from the terminal */
  lines: { type: "stdout" | "stderr"; text: string }[];
  /** Last command executed */
  lastCommand: string | null;
  /** Whether the process is still running */
  active: boolean;
  /** Whether this is a single command (vs interactive shell) */
  isSingleCommand: boolean;
};

// ═══════════════════════════════════════════════════════════════════════════
// Interface Segregation: Small, focused interfaces
// ═══════════════════════════════════════════════════════════════════════════

/** Connection status only. Used by connection indicator components. */
export interface IConnectionState {
  /** Whether socket is connected */
  connected: boolean;
}

/** Option for AskUserQuestion tool. */
export type AskUserQuestionOption = {
  /** Display label */
  label: string;
  /** Optional longer description */
  description?: string;
};

/** Single question in AskUserQuestion tool input. */
export type AskUserQuestionItem = {
  /** Question text (optional if header is descriptive) */
  question?: string;
  /** Header/title for the question */
  header: string;
  /** Available options to select */
  options: AskUserQuestionOption[];
  /** Whether multiple options can be selected */
  multiSelect?: boolean;
};

/** Pending AskUserQuestion tool call shown in UI. */
export type PendingAskUserQuestion = {
  /** Tool use ID for the response */
  tool_use_id: string;
  /** Optional UUID */
  uuid?: string;
  /** Questions to display */
  questions: AskUserQuestionItem[];
};

/** Chat messages and typing state. Used by chat UI components. */
export interface IChatState {
  /** All messages in the conversation */
  messages: Message[];
  /** Whether typing indicator should show */
  typingIndicator: boolean;
  /** Whether Claude is currently running */
  claudeRunning: boolean;
  /** Whether waiting for user input (permission prompt) */
  waitingForUserInput: boolean;
}

/** Permission denials and last run options. Used by permission banner. */
export interface IPermissionState {
  /** Current permission denials (null if none) */
  permissionDenials: PermissionDenial[] | null;
  /** Options from last run for retry */
  lastRunOptions: LastRunOptions;
}

/** Terminal list and selection state. Used by terminal management UI. */
export interface ITerminalState {
  /** All active terminals */
  terminals: TerminalState[];
  /** Currently selected terminal ID */
  selectedTerminalId: string | null;
  /** Function to set selected terminal */
  setSelectedTerminalId: (id: string | null) => void;
  /** Output lines for display */
  runOutputLines: { type: "stdout" | "stderr"; text: string }[];
  /** Current or last run command */
  runCommand: string | null;
  /** Whether a process is currently active */
  runProcessActive: boolean;
  /** Whether user can run commands in selected terminal */
  canRunInSelectedTerminal: boolean;
}

/** Run-render (preview) state. Used by render preview components. */
export interface IRunRenderState {
  /** Pending render command (null if none) */
  pendingRender: PendingRender | null;
  /** Result of last run-render command */
  runRenderResult: { ok: boolean; message: string } | null;
}

/**
 * Server configuration interface.
 * Provides base URL and preview URL resolution.
 * Injected for testability.
 */
export interface IServerConfig {
  /** Get the server base URL */
  getBaseUrl(): string;
  /** Resolve a preview URL (handles localhost -> Tailscale conversion) */
  resolvePreviewUrl(previewUrl: string): string;
}

/**
 * Workspace file service interface.
 * Abstracts file fetching for testability.
 */
export interface IWorkspaceFileService {
  /**
   * Fetch a file from the workspace.
   * @param path - Relative file path
   * @returns File content and image flag
   */
  fetchFile(path: string): Promise<{ content: string | null; isImage: boolean }>;
}

/**
 * Socket factory interface.
 * Enables swapping transport layer in tests.
 */
export interface ISocketFactory {
  /** Create a socket connection */
  create(url: string): unknown;
}
