/**
 * useSocket hook - Main state management for Socket.IO connection and Claude sessions.
 * 
 * This hook manages:
 * - Socket.IO connection lifecycle
 * - Chat message state
 * - Claude session state (running, waiting for input)
 * - Terminal processes
 * - Permission handling
 * - File rendering
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import { io, Socket } from "socket.io-client";
import {
  stripAnsi,
  stripTrailingIncompleteTag,
  isProviderStream,
  isAskUserQuestionPayload,
  getAllowedToolsFromDenials,
  isProviderSystemNoise,
  isCodexSessionInvalidStderr,
} from "../providers/stream";
import type {
  Message,
  CodeReference,
  PermissionDenial,
  PendingAskUserQuestion,
  LastRunOptions,
  IServerConfig,
} from "../../core/types";
import { getDefaultServerConfig } from "../server/config";
import { createEventDispatcher } from "../providers/eventDispatcher";
import type { Provider } from "../../theme/index";
import type { CodeRefPayload } from "../../components/file/FileViewerModal";

// Re-export types for consumers that import from useSocket
export type { Message, CodeReference, PermissionDenial, PendingAskUserQuestion, LastRunOptions };

/**
 * Normalize file path to use forward slashes.
 * If workspace root is provided, converts absolute paths to relative paths.
 * 
 * @param filePath - Original file path
 * @param workspaceRoot - Workspace root directory (optional)
 * @returns Normalized relative or absolute path
 */
function toWorkspaceRelativePath(filePath: string, workspaceRoot: string | null): string {
  const normalized = filePath.replace(/\\/g, "/").trim();
  if (!workspaceRoot) return normalized;
  const root = workspaceRoot.replace(/\\/g, "/").replace(/\/$/, "");
  if (root === "" || (!normalized.startsWith(root + "/") && normalized !== root)) return normalized;
  const rel = normalized === root ? "" : normalized.slice(root.length).replace(/^\//, "");
  return rel || normalized;
}

/** Options for useSocket hook */
export interface UseSocketOptions {
  /** Injected server config (base URL). Defaults to env-based config. */
  serverConfig?: IServerConfig;
  /** AI provider for submit-prompt ("claude" | "gemini"). */
  provider?: Provider;
  /** Model ID for submit-prompt (e.g. "sonnet", "gemini-2.5-flash"). Defaults by provider. */
  model?: string;
}

/**
 * Main hook for managing Socket.IO connection and Claude sessions.
 * 
 * @param options - Configuration options
 * @returns Object containing connection state, messages, and action handlers
 */
export function useSocket(options: UseSocketOptions = {}) {
  // Server configuration - can be injected for testing
  const serverConfig = options.serverConfig ?? getDefaultServerConfig();
  const serverUrl = serverConfig.getBaseUrl();
  const provider = options.provider ?? "pi";
  const defaultModel =
    provider === "claude" ? "sonnet4.5" : provider === "pi" || provider === "codex" ? "gpt-5.1-codex-mini" : "gemini-2.5-flash";
  const model = options.model ?? defaultModel;

  // ===== Connection State =====
  const [connected, setConnected] = useState(false);

  // ===== Live Session (receives socket events; continues in background when user switches) =====
  const [liveSessionMessages, setLiveSessionMessages] = useState<Message[]>([]);
  const [viewingLiveSession, setViewingLiveSession] = useState(true);

  // ===== Chat State (derived: either live or saved session) =====
  const [claudeRunning, setClaudeRunning] = useState(false);
  const [waitingForUserInput, setWaitingForUserInput] = useState(false);
  const [typingIndicator, setTypingIndicator] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<string | null>(null);

  // ===== Session (server session_id for Claude; shown in UI) =====
  const [sessionId, setSessionId] = useState<string | null>(null);

  // ===== Saved Session (when user switches to a different session, we show this) =====
  const [savedSessionMessages, setSavedSessionMessages] = useState<Message[]>([]);

  // Displayed messages: live session when viewing it, else saved session
  const messages = viewingLiveSession ? liveSessionMessages : savedSessionMessages;

  // ===== Permission State =====
  const [permissionDenials, setPermissionDenials] = useState<PermissionDenial[] | null>(null);
  const [lastRunOptions, setLastRunOptions] = useState<LastRunOptions>({
    permissionMode: null,
    allowedTools: [],
    useContinue: false,
  });
  
  // ===== Question Modal State =====
  const [pendingAskQuestion, setPendingAskQuestion] = useState<PendingAskUserQuestion | null>(null);
  
  // ===== Model Info =====
  const [modelName, setModelName] = useState("Sonnet 4.5");
  
  // ===== Session Tracking =====
  const [lastSessionTerminated, setLastSessionTerminated] = useState(false);
  const [mockSequences, setMockSequences] = useState<string[]>([]);
  const [selectedSequence, setSelectedSequence] = useState<string | null>(null);

  // ===== Refs for managing state across renders =====
  const socketRef = useRef<Socket | null>(null);
  const outputBufferRef = useRef("");
  const currentAssistantContentRef = useRef("");
  const hasCompletedFirstRunRef = useRef(false);
  const nextIdRef = useRef(0);
  const workspaceRootRef = useRef<string | null>(null);
  const toolUseByIdRef = useRef<Map<string, { tool_name: string; tool_input?: Record<string, unknown> }>>(new Map());
  const liveMessagesRef = useRef<Message[]>([]);
  liveMessagesRef.current = liveSessionMessages;

  // Refs for stable callback identity - socket handlers must always call latest implementations,
  // especially after session switch when viewingLiveSession changes but live session continues in background.
  const appendAssistantTextRef = useRef<(chunk: string) => void>(() => {});
  const addMessageRef = useRef<(role: Message["role"], content: string, codeReferences?: CodeReference[]) => string>(() => "");
  const finalizeAssistantMessageRef = useRef<() => void>(() => {});

  /**
   * Add a new message to the chat.
   * Generates a unique ID for each message.
   */
  const addMessage = useCallback(
    (role: Message["role"], content: string, codeReferences?: CodeReference[]) => {
      const id = `msg-${++nextIdRef.current}`;
      setLiveSessionMessages((prev) => [...prev, { id, role, content, codeReferences }]);
      return id;
    },
    []
  );
  addMessageRef.current = addMessage;

  /**
   * Append text to the current assistant message.
   * Creates a new assistant message if the last message isn't from assistant.
   * Also extracts render commands from the content.
   */
  const appendAssistantText = useCallback((chunk: string) => {
    const sanitized = stripAnsi(chunk);
    if (!sanitized) return;
    // Update ref synchronously so getCurrentAssistantContent() is correct when
    // appendOverlapTextDelta runs (e.g. item.completed) before React flushes setLiveSessionMessages.
    const current = currentAssistantContentRef.current;
    const next = current ? current + sanitized : sanitized;
    currentAssistantContentRef.current = next;
    setLiveSessionMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant") {
        return [...prev.slice(0, -1), { ...last, content: next }];
      }
      const newMsg: Message = { id: `msg-${++nextIdRef.current}`, role: "assistant", content: sanitized };
      return [...prev, newMsg];
    });
    setTypingIndicator(true);
  }, []);
  appendAssistantTextRef.current = appendAssistantText;

  /**
   * Finalize the current assistant message when streaming ends.
   * Strips incomplete tags and cleans up empty messages.
   */
  const finalizeAssistantMessage = useCallback(() => {
    setTypingIndicator(false);
    const raw = currentAssistantContentRef.current;
    const cleaned = stripTrailingIncompleteTag(raw ?? "");
    if (cleaned !== (raw ?? "")) {
      setLiveSessionMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          const trimmed = cleaned.trim();
          if (trimmed === "") {
            return prev.slice(0, -1);
          }
          return [...prev.slice(0, -1), { ...last, content: cleaned }];
        }
        return prev;
      });
      currentAssistantContentRef.current = cleaned;
    }
    setLiveSessionMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant" && (last.content ?? "").trim() === "") {
        return prev.slice(0, -1);
      }
      return prev;
    });
    currentAssistantContentRef.current = "";
  }, []);
  finalizeAssistantMessageRef.current = finalizeAssistantMessage;

  /**
   * Remove duplicate permission denials based on tool name and path.
   */
  const deduplicateDenials = useCallback((denials: PermissionDenial[]): PermissionDenial[] => {
    const seen = new Set<string>();
    return denials.filter((d) => {
      const tool = d.tool_name ?? d.tool ?? "?";
      const pathKey = d.tool_input?.file_path ?? d.tool_input?.path ?? "";
      const key = `${tool}:${pathKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, []);

  const recordToolUse = useCallback((id: string, data: { tool_name: string; tool_input?: Record<string, unknown> }) => {
    toolUseByIdRef.current.set(id, data);
  }, []);

  const getAndClearToolUse = useCallback((id: string) => {
    const m = toolUseByIdRef.current;
    const v = m.get(id);
    m.delete(id);
    return v ?? null;
  }, []);

  const addPermissionDenial = useCallback(
    (denial: PermissionDenial) => {
      setPermissionDenials((prev) => deduplicateDenials([...(prev ?? []), denial]));
    },
    [deduplicateDenials]
  );

  // Refs for callbacks used by socket handlers - allows effect to depend only on serverUrl,
  // so session switch (provider/model change) never triggers effect re-run and disconnect.
  const deduplicateDenialsRef = useRef(deduplicateDenials);
  const recordToolUseRef = useRef(recordToolUse);
  const getAndClearToolUseRef = useRef(getAndClearToolUse);
  const addPermissionDenialRef = useRef(addPermissionDenial);
  deduplicateDenialsRef.current = deduplicateDenials;
  recordToolUseRef.current = recordToolUse;
  getAndClearToolUseRef.current = getAndClearToolUse;
  addPermissionDenialRef.current = addPermissionDenial;

  // ===== Socket.IO Connection Setup =====
  useEffect(() => {
    if (__DEV__) {
      console.log("[socket] effect mount", { serverUrl });
    }

    // Initialize Socket.IO connection with explicit reconnection for mobile
    const socket = io(serverUrl, {
      transports: ["websocket", "polling"],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    // Connection events
    socket.on("connect", () => {
      if (__DEV__) console.log("[socket] connected");
      setConnected(true);
    });

    socket.on("disconnect", (reason) => {
      if (__DEV__) console.log("[socket] disconnected", reason);
      setConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.error("[socket] connect_error:", err.message);
      setConnected(false);
    });

    // Reconnect when app returns to foreground (mobile: connection may drop when backgrounded)
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        const s = socketRef.current;
        if (s && !s.connected) {
          if (__DEV__) console.log("[socket] app foregrounded, reconnecting");
          s.connect();
        }
      }
    };
    const subscription = AppState.addEventListener("change", handleAppStateChange);

    // Claude session events
    socket.on("claude-started", (data: Record<string, unknown>) => {
      setClaudeRunning(true);
      setTypingIndicator(true);
      setWaitingForUserInput(false);
      setLastSessionTerminated(false);
      const raw = data?.session_id ?? data?.sessionId;
      const id =
        raw != null && raw !== "" ? String(raw) : null;
      setSessionId(id);
      setLastRunOptions({
        permissionMode: (data?.permissionMode as string | null) ?? null,
        allowedTools: (Array.isArray(data?.allowedTools) ? data.allowedTools : []) as string[],
        useContinue: Boolean(data?.useContinue),
      });
    });

    const dispatchProviderEvent = createEventDispatcher({
      setPermissionDenials: (d) => setPermissionDenials(d ? deduplicateDenialsRef.current(d) : null),
      setModelName,
      setWaitingForUserInput,
      setPendingAskQuestion,
      setCurrentActivity,
      addMessage: (role, content, codeRefs) => addMessageRef.current(role, content, codeRefs),
      appendAssistantText: (chunk) => appendAssistantTextRef.current(chunk),
      getCurrentAssistantContent: () => currentAssistantContentRef.current,
      getLastMessageRole: () => {
        const m = liveMessagesRef.current;
        return m.length ? m[m.length - 1]?.role ?? null : null;
      },
      getLastMessageContent: () => {
        const m = liveMessagesRef.current;
        const last = m.length ? m[m.length - 1] : null;
        return (last?.content as string) ?? "";
      },
      deduplicateDenials: (d) => deduplicateDenialsRef.current(d),
      recordToolUse: (id, data) => recordToolUseRef.current(id, data),
      getAndClearToolUse: (id) => getAndClearToolUseRef.current(id),
      addPermissionDenial: (denial) => addPermissionDenialRef.current(denial),
      setSessionId,
    });

    // Main output handler - receives all provider (Claude/Gemini) output
    socket.on("output", (data: string) => {
      outputBufferRef.current += data;
      const lines = outputBufferRef.current.split("\n");
      outputBufferRef.current = lines.pop() ?? "";
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        // Strip ANSI escape codes before parsing (PTY may wrap JSON in escape sequences)
        const clean = stripAnsi(trimmed);
        if (!clean) continue;

        // Filter known provider CLI system noise (Gemini startup messages, etc.)
        if (isProviderSystemNoise(clean)) continue;

        // Codex stderr: "missing rollout path for thread" — treat as session invalid, show friendly message
        if (isCodexSessionInvalidStderr(clean)) {
          setSessionId(null);
          addMessageRef.current("system", "This session is no longer available. Start a new chat to continue.");
          continue;
        }

        // Try to parse as JSON (provider stream format)
        try {
          const parsed = JSON.parse(clean);
          if (__DEV__ && isAskUserQuestionPayload(parsed)) {
            console.log("[socket/output] AskUserQuestion line received", (parsed as Record<string, unknown>).tool_use_id);
          }
          const isStream = isProviderStream(parsed);
          if (__DEV__ && (parsed as Record<string, unknown>).type?.toString().startsWith("item.")) {
            console.log("[socket/output] item event:", (parsed as Record<string, unknown>).type, "isProviderStream=" + isStream, "item.text=" + ((parsed as Record<string, unknown>).item as { text?: string })?.text?.slice?.(0, 20));
          }
          if (isStream) {
            // Handle AI stream events via shared dispatcher (Claude/Gemini/Codex)
            dispatchProviderEvent(parsed as Record<string, unknown>);
          } else {
            appendAssistantTextRef.current(clean + "\n");
          }
        } catch {
          // PTY sometimes injects "<u" before a JSON line (terminal underline escape), producing "<u{...}".
          // Salvage: parse from first "{" so we dispatch the event instead of appending garbage.
          const jsonStart = clean.indexOf("{");
          if (clean.startsWith("<u") && jsonStart > 0) {
            try {
              const parsed = JSON.parse(clean.slice(jsonStart));
              if (isProviderStream(parsed)) {
                dispatchProviderEvent(parsed as Record<string, unknown>);
                continue;
              }
            } catch {
              // fall through to append as text
            }
          }
          // Not JSON - treat as plain text output
          appendAssistantTextRef.current(clean + "\n");
        }
      }
    });

    // Session ended
    socket.on("exit", ({ exitCode }: { exitCode: number }) => {
      setClaudeRunning(false);
      setTypingIndicator(false);
      setCurrentActivity(null);
      setWaitingForUserInput(false);
      // Defer finalize so React can flush setMessages from item.completed/appendAssistantText first.
      // Otherwise exit may run in same tick and finalizeAssistantMessage can see stale state.
      queueMicrotask(() => finalizeAssistantMessageRef.current());
      
      if (exitCode !== 0) {
        setLastSessionTerminated(true);
      }
      
      if (!hasCompletedFirstRunRef.current && exitCode === 0) {
        hasCompletedFirstRunRef.current = true;
      }
    });

    // Cleanup on unmount
    return () => {
      if (__DEV__) console.log("[socket] effect cleanup, disconnecting");
      subscription.remove();
      socket.disconnect();
    };
  }, [serverUrl]);

  // ===== Action Handlers =====

  /**
   * Submit a prompt to Claude/Gemini/Codex.
   * @param prompt - The user prompt
   * @param permissionMode - Optional Claude permission mode
   * @param allowedTools - Optional allowed tools list
   * @param codeRefs - Optional code references to include
   * @param approvalMode - Optional Gemini approval mode
   * @param codexOptions - Optional Codex flags (askForApproval, fullAuto, yolo, effort)
   */
  const submitPrompt = useCallback(
    (
      prompt: string,
      permissionMode?: string,
      allowedTools?: string[],
      codeRefs?: CodeRefPayload[],
      approvalMode?: string,
      codexOptions?: { askForApproval?: string; fullAuto?: boolean; yolo?: boolean; effort?: string }
    ) => {
      if (!socketRef.current) return;

      // Build full prompt with code references if provided
      let fullPrompt = prompt;
      if (codeRefs && codeRefs.length > 0) {
        const refsText = codeRefs
          .map((ref) => `File: ${ref.path}\n\`\`\`\n${ref.snippet}\n\`\`\``)
          .join("\n\n");
        fullPrompt = `${refsText}\n\n${prompt}`;
      }

      socketRef.current.emit("submit-prompt", {
        prompt: fullPrompt,
        permissionMode,
        allowedTools,
        provider,
        model,
        approvalMode,
        ...((provider === "pi" || provider === "codex") && { effort: codexOptions?.effort ?? "medium" }),
        ...(codexOptions && {
          askForApproval: codexOptions.askForApproval,
          fullAuto: codexOptions.fullAuto,
          yolo: codexOptions.yolo,
        }),
      });

      // Add user message to chat
      addMessage("user", prompt);
      setPermissionDenials(null);
      setLastSessionTerminated(false);
    },
    [addMessage, provider, model]
  );

  /**
   * Submit answer to AskUserQuestion modal.
   * @param answers - Selected answers
   */
  const submitAskQuestionAnswer = useCallback(
    (answers: Array<{ header: string; selected: string[] }>) => {
      if (!socketRef.current || !pendingAskQuestion) return;
      
      const payload = {
        tool_use_id: pendingAskQuestion.tool_use_id,
        answers,
      };
      
      socketRef.current.emit("input", JSON.stringify({ message: { content: [{ type: "tool_result", content: JSON.stringify(answers) }] } }));
      setPendingAskQuestion(null);
      setWaitingForUserInput(false);
    },
    [pendingAskQuestion]
  );

  /**
   * Dismiss the AskUserQuestion modal without answering.
   */
  const dismissAskQuestion = useCallback(() => {
    setPendingAskQuestion(null);
    setWaitingForUserInput(false);
  }, []);

  /**
   * Retry after permission denial with updated permissions.
   * @param permissionMode - New Claude permission mode
   * @param approvalMode - New Gemini approval mode
   */
  const retryAfterPermission = useCallback(
    (permissionMode?: string, approvalMode?: string) => {
      if (!socketRef.current) return;
      
      const denials = permissionDenials ?? [];
      const allowedTools = getAllowedToolsFromDenials(denials);
      
      socketRef.current.emit("submit-prompt", {
        prompt: "", // Empty prompt to continue
        permissionMode: permissionMode ?? lastRunOptions.permissionMode ?? undefined,
        approvalMode,
        allowedTools,
        replaceRunning: true,
        provider,
        model,
      });
      
      setPermissionDenials(null);
    },
    [permissionDenials, lastRunOptions, provider, model]
  );

  /**
   * Dismiss permission denial banner.
   */
  const dismissPermission = useCallback(() => {
    setPermissionDenials(null);
  }, []);

  /**
   * Terminate the current Claude session.
   */
  const terminateAgent = useCallback(() => {
    if (!socketRef.current) return;
    socketRef.current.emit("claude-terminate");
    setLastSessionTerminated(true);
  }, []);

  /**
   * New session: clear chat and reset permission state.
   */
  const resetSession = useCallback(() => {
    if (socketRef.current) socketRef.current.emit("claude-terminate", { resetSession: true });
    setLiveSessionMessages([]);
    setSessionId(null);
    setPermissionDenials(null);
    setLastRunOptions({ permissionMode: null, allowedTools: [], useContinue: false });
    setPendingAskQuestion(null);
    setLastSessionTerminated(false);
    currentAssistantContentRef.current = "";
    setViewingLiveSession(true);
  }, []);

  /**
   * Load an existing session's messages (e.g. from persisted storage).
   * Switches display to the saved session; the live session continues receiving
   * socket events in the background.
   */
  const loadSession = useCallback((loadedMessages: Message[]) => {
    if (__DEV__) console.log("[socket] loadSession", loadedMessages.length, "msgs");
    let maxN = 0;
    for (const m of loadedMessages) {
      const match = /^msg-(\d+)$/.exec(m.id);
      if (match) maxN = Math.max(maxN, parseInt(match[1], 10));
    }
    nextIdRef.current = Math.max(nextIdRef.current, maxN);
    const seen = new Set<string>();
    const deduped = loadedMessages.map((m) => {
      let id = m.id;
      if (seen.has(id)) {
        id = `msg-${++nextIdRef.current}`;
        seen.add(id);
      } else {
        seen.add(id);
      }
      return { ...m, id };
    });
    setSavedSessionMessages(deduped);
    setViewingLiveSession(false);
  }, []);

  /**
   * Switch back to viewing the live session (the one receiving socket events).
   */
  const switchToLiveSession = useCallback(() => {
    if (__DEV__) console.log("[socket] switchToLiveSession", { connected: socketRef.current?.connected });
    setViewingLiveSession(true);
  }, []);

  return {
    // Connection state
    connected,
    
    // Chat state
    messages,
    claudeRunning,
    waitingForUserInput,
    typingIndicator,
    currentActivity,
    
    // Permission state
    permissionDenials,
    lastRunOptions,
    
    // Question modal state
    pendingAskQuestion,
    
    // Mock sequences
    mockSequences,
    selectedSequence,
    setSelectedSequence,
    
    // Session tracking
    sessionId,
    lastSessionTerminated,

    // Actions
    submitPrompt,
    submitAskQuestionAnswer,
    dismissAskQuestion,
    retryAfterPermission,
    dismissPermission,
    terminateAgent,
    resetSession,
    loadSession,
    switchToLiveSession,
    viewingLiveSession,
    liveSessionMessages,
  };
}
