/**
 * useSse hook - Main state management for SSE connection and AI sessions.
 *
 * This hook manages:
 * - SSE EventSource connection lifecycle
 * - Chat message state
 * - Session state (idle, running, waiting)
 * - Permission handling
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import EventSource from "react-native-sse";
import {
  stripAnsi,
  stripTrailingIncompleteTag,
  isProviderStream,
  isAskUserQuestionPayload,
  getAllowedToolsFromDenials,
  isProviderSystemNoise,
} from "@/services/providers/stream";
import type {
  Message,
  CodeReference,
  PermissionDenial,
  PendingAskUserQuestion,
  LastRunOptions,
  IServerConfig,
} from "@/core/types";
import { getDefaultServerConfig } from "@/services/server/config";
import { createEventDispatcher } from "@/services/providers/eventDispatcher";
import type { Provider } from "@/theme/index";
import type { CodeRefPayload } from "@/components/file/FileViewerModal";

// Re-export types for consumers that import from useSse
export type { Message, CodeReference, PermissionDenial, PendingAskUserQuestion, LastRunOptions };

type EventSourceLike = {
  addEventListener: (event: string, handler: (...args: any[]) => void) => void;
  removeEventListener: (event: string, handler: (...args: any[]) => void) => void;
  close: () => void;
};
type EventSourceCtor = new (url: string) => EventSourceLike;

function toWorkspaceRelativePath(filePath: string, workspaceRoot: string | null): string {
  const normalized = filePath.replace(/\\/g, "/").trim();
  if (!workspaceRoot) return normalized;
  const root = workspaceRoot.replace(/\\/g, "/").replace(/\/$/, "");
  if (root === "" || (!normalized.startsWith(root + "/") && normalized !== root)) return normalized;
  const rel = normalized === root ? "" : normalized.slice(root.length).replace(/^\//, "");
  return rel || normalized;
}

export interface UseSseOptions {
  serverConfig?: IServerConfig;
  provider?: Provider;
  model?: string;
  sessionId?: string | null;
  status?: boolean;
}

type SessionRuntimeState = "idle" | "running" | "waiting";

export function useSse(options: UseSseOptions = {}) {
  const serverConfig = options.serverConfig ?? getDefaultServerConfig();
  const serverUrl = serverConfig.getBaseUrl();
  const provider = options.provider ?? "codex";
  const defaultModel =
    provider === "claude" ? "sonnet4.5" : provider === "codex" ? "gpt-5.1-codex-mini" : "gemini-2.5-flash";
  const model = options.model ?? defaultModel;
  const sessionIdFromOptions = options.sessionId;
  const status = options.status ?? true;

  const [connected, setConnected] = useState(false);
  const [liveSessionMessages, setLiveSessionMessages] = useState<Message[]>([]);
  const [viewingLiveSession, setViewingLiveSession] = useState(true);

  const [waitingForUserInput, setWaitingForUserInput] = useState(false);
  const [typingIndicator, setTypingIndicator] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<SessionRuntimeState>("idle");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionInitLoading, setSessionInitLoading] = useState(false);
  const [savedSessionMessages, setSavedSessionMessages] = useState<Message[]>([]);

  const messages = viewingLiveSession ? liveSessionMessages : savedSessionMessages;

  const [permissionDenials, setPermissionDenials] = useState<PermissionDenial[] | null>(null);
  const [lastRunOptions, setLastRunOptions] = useState<LastRunOptions>({
    permissionMode: null,
    allowedTools: [],
    useContinue: false,
  });
  
  const [pendingAskQuestion, setPendingAskQuestion] = useState<PendingAskUserQuestion | null>(null);
  const [modelName, setModelName] = useState("Sonnet 4.5");
  const [lastSessionTerminated, setLastSessionTerminated] = useState(false);
  const [mockSequences, setMockSequences] = useState<string[]>([]);
  const [selectedSequence, setSelectedSequence] = useState<string | null>(null);

  const activeSseRef = useRef<{ id: string; source: EventSourceLike } | null>(null);
  const activeSseHandlersRef = useRef<{
    open: (event: unknown) => void;
    error: (event: unknown) => void;
    message: (event: any) => void;
    end: (event: any) => void;
    done: (event: any) => void;
  } | null>(null);
  const suppressActiveSessionSwitchRef = useRef(false);
  const outputBufferRef = useRef("");
  const currentAssistantContentRef = useRef("");
  const hasCompletedFirstRunRef = useRef(false);

  interface SessionLiveState {
    messages: Message[];
    outputBuffer: string;
    currentAssistantContent: string;
    sessionState: SessionRuntimeState;
    typingIndicator: boolean;
    waitingForUserInput: boolean;
    currentActivity: string | null;
    lastSessionTerminated: boolean;
    hasCompletedFirstRun: boolean;
  }
  const sessionStatesRef = useRef<Map<string, SessionLiveState>>(new Map());
  const displayedSessionIdRef = useRef<string | null>(null);

  const getOrCreateSessionState = useCallback((sid: string): SessionLiveState => {
    let s = sessionStatesRef.current.get(sid);
    if (!s) {
      s = {
        messages: [],
        outputBuffer: "",
        currentAssistantContent: "",
        sessionState: "idle",
        typingIndicator: false,
        waitingForUserInput: false,
        currentActivity: null,
        lastSessionTerminated: false,
        hasCompletedFirstRun: false,
      };
      sessionStatesRef.current.set(sid, s);
    }
    return s;
  }, []);
  const setSessionStateForSession = useCallback((sid: string | null, next: SessionRuntimeState) => {
    if (!sid) {
      setSessionState(next);
      return;
    }
    const state = getOrCreateSessionState(sid);
    state.sessionState = next;
    if (displayedSessionIdRef.current === sid) {
      setSessionState(next);
    }
  }, [getOrCreateSessionState]);
  const nextIdRef = useRef(0);
  const workspaceRootRef = useRef<string | null>(null);
  const toolUseByIdRef = useRef<Map<string, { tool_name: string; tool_input?: Record<string, unknown> }>>(new Map());
  const liveMessagesRef = useRef<Message[]>([]);
  liveMessagesRef.current = liveSessionMessages;
  const currentSessionIdRef = useRef<string | null>(null);
  currentSessionIdRef.current = sessionId;
  displayedSessionIdRef.current = viewingLiveSession ? sessionId : null;

  const appendAssistantTextRef = useRef<(chunk: string) => void>(() => {});
  const addMessageRef = useRef<(role: Message["role"], content: string, codeReferences?: CodeReference[]) => string>(() => "");
  const finalizeAssistantMessageRef = useRef<() => void>(() => {});
  const streamFlushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const STREAM_UPDATE_THROTTLE_MS = 80;
  /** When set, the next SSE open for this session should use skipReplay=1 (client already has disk state). */
  const skipReplayForSessionRef = useRef<string | null>(null);

  const syncSessionToReact = useCallback((sid: string | null) => {
    if (!sid) return;
    let s = sessionStatesRef.current.get(sid);
    // Fallback: state may be keyed by migrated id (e.g. Pi session_id) while sid is stale
    if (!s && displayedSessionIdRef.current) {
      s = sessionStatesRef.current.get(displayedSessionIdRef.current);
    }
    if (s) {
      setLiveSessionMessages(s.messages);
      setSessionState(s.sessionState);
      setTypingIndicator(s.typingIndicator);
      setWaitingForUserInput(s.waitingForUserInput);
      setCurrentActivity(s.currentActivity);
      setLastSessionTerminated(s.lastSessionTerminated);
      outputBufferRef.current = s.outputBuffer;
      currentAssistantContentRef.current = s.currentAssistantContent;
      hasCompletedFirstRunRef.current = s.hasCompletedFirstRun;
      liveMessagesRef.current = s.messages;
    } else {
      // Avoid blanking when switching back to a running session: state may be keyed by
      // a different id (server migrated session_id) or not yet populated. Preserve
      // existing display so we don't clear messages that were just shown.
      const isDisplayedSession = displayedSessionIdRef.current === sid;
      const hasDisplayedMessages = liveMessagesRef.current.length > 0;
      if (!(isDisplayedSession && hasDisplayedMessages)) {
        setLiveSessionMessages([]);
        liveMessagesRef.current = [];
      }
      setSessionState("idle");
      setTypingIndicator(false);
      setWaitingForUserInput(false);
      setCurrentActivity(null);
      outputBufferRef.current = "";
      currentAssistantContentRef.current = "";
    }
  }, []);

  const closeActiveSse = useCallback(
    (reason?: string) => {
      const active = activeSseRef.current;
      if (!active) {
        return;
      }
      const { id, source } = active;
      const handlers = activeSseHandlersRef.current;
      if (__DEV__) {
        console.log("[sse] disconnected", { reason: reason ?? "close", sessionId: id });
      }
      if (handlers) {
        source.removeEventListener("open", handlers.open);
        source.removeEventListener("error", handlers.error);
        source.removeEventListener("message", handlers.message);
        source.removeEventListener("end", handlers.end);
        source.removeEventListener("done", handlers.done);
      }
      source.close();
      if (displayedSessionIdRef.current === id) {
        setSessionStateForSession(id, "idle");
        setTypingIndicator(false);
        setWaitingForUserInput(false);
        setCurrentActivity(null);
      }
      suppressActiveSessionSwitchRef.current = false;
      activeSseRef.current = null;
      activeSseHandlersRef.current = null;
      if (streamFlushTimeoutRef.current) {
        clearTimeout(streamFlushTimeoutRef.current);
        streamFlushTimeoutRef.current = null;
      }
      setConnected(false);
    },
    [setCurrentActivity, setSessionStateForSession, setTypingIndicator, setWaitingForUserInput]
  );

  /** Deduplicate message IDs; bump nextIdRef for any reassignments. */
  const deduplicateMessageIds = useCallback((msgs: Message[]): Message[] => {
    const seen = new Set<string>();
    return msgs.map((m) => {
      let id = m.id;
      if (seen.has(id)) {
        id = `msg-${++nextIdRef.current}`;
        seen.add(id);
      } else {
        seen.add(id);
      }
      return id === m.id ? m : { ...m, id };
    });
  }, []);

  const createSessionHandlers = useCallback(
    (sidRef: { current: string }) => {
      const addMessageForSession = (role: Message["role"], content: string, codeReferences?: CodeReference[]) => {
        const id = `msg-${++nextIdRef.current}`;
        const state = getOrCreateSessionState(sidRef.current);
        const newMsg: Message = { id, role, content, codeReferences };
        state.messages = [...state.messages, newMsg];
        if (displayedSessionIdRef.current === sidRef.current) {
          setLiveSessionMessages([...state.messages]);
          liveMessagesRef.current = state.messages;
        }
        return id;
      };
      const appendAssistantTextForSession = (chunk: string) => {
        const sanitized = stripAnsi(chunk);
        if (!sanitized) return;
        const state = getOrCreateSessionState(sidRef.current);
        const next = state.currentAssistantContent ? state.currentAssistantContent + sanitized : sanitized;
        state.currentAssistantContent = next;
        const last = state.messages[state.messages.length - 1];
        if (last?.role === "assistant") {
          state.messages = [...state.messages.slice(0, -1), { ...last, content: next }];
        } else {
          state.messages = [...state.messages, { id: `msg-${++nextIdRef.current}`, role: "assistant", content: sanitized }];
        }
        state.typingIndicator = true;
        state.sessionState = "running";
        if (displayedSessionIdRef.current === sidRef.current) {
          setLiveSessionMessages([...state.messages]);
          setTypingIndicator(true);
          setSessionState("running");
          liveMessagesRef.current = state.messages;
          currentAssistantContentRef.current = next;
        }
      };
      const finalizeAssistantMessageForSession = () => {
        const state = getOrCreateSessionState(sidRef.current);
        const raw = state.currentAssistantContent;
        const cleaned = stripTrailingIncompleteTag(raw ?? "");
        if (cleaned !== (raw ?? "")) {
          const last = state.messages[state.messages.length - 1];
          if (last?.role === "assistant") {
            const trimmed = cleaned.trim();
            if (trimmed === "") state.messages = state.messages.slice(0, -1);
            else state.messages = [...state.messages.slice(0, -1), { ...last, content: cleaned }];
          }
          state.currentAssistantContent = cleaned;
        }
        const last = state.messages[state.messages.length - 1];
        if (last?.role === "assistant" && (last.content ?? "").trim() === "") {
          state.messages = state.messages.slice(0, -1);
        }
        state.currentAssistantContent = "";
        state.typingIndicator = false;
        state.sessionState = "idle";
        if (displayedSessionIdRef.current === sidRef.current) {
          setLiveSessionMessages([...state.messages]);
          setTypingIndicator(false);
          setSessionState("idle");
          currentAssistantContentRef.current = "";
          liveMessagesRef.current = state.messages;
        }
      };
      return {
        addMessageForSession,
        appendAssistantTextForSession,
        finalizeAssistantMessageForSession,
      };
    },
    [getOrCreateSessionState]
  );

  const pendingMessagesForNewSessionRef = useRef<Message[]>([]);

  const addMessage = useCallback(
    (role: Message["role"], content: string, codeReferences?: CodeReference[]) => {
      const sid = currentSessionIdRef.current;
      const id = `msg-${++nextIdRef.current}`;
      const newMsg: Message = { id, role, content, codeReferences };
      if (!sid) {
        setLiveSessionMessages((prev) => [...prev, newMsg]);
        pendingMessagesForNewSessionRef.current = [...pendingMessagesForNewSessionRef.current, newMsg];
        return id;
      }
      const state = getOrCreateSessionState(sid);
      state.messages = [...state.messages, newMsg];
      if (displayedSessionIdRef.current === sid) {
        setLiveSessionMessages([...state.messages]);
        liveMessagesRef.current = state.messages;
      }
      return id;
    },
    [getOrCreateSessionState]
  );
  addMessageRef.current = addMessage;

  /**
   * Switch to a running session: show disk-loaded conversation first, then connect SSE for new output only.
   * Call only when session is running (server returns running/sseConnected from GET /messages).
   * Seeds session state from initialMessages (from disk) so the list is stable; SSE uses skipReplay and appends new output.
   */
  const resumeLiveSession = useCallback(
    (sid: string, initialMessages?: Message[]) => {
      const state = getOrCreateSessionState(sid);
      if (initialMessages && initialMessages.length > 0) {
        let maxN = 0;
        for (const m of initialMessages) {
          const match = /^msg-(\d+)$/.exec(m.id);
          if (match) maxN = Math.max(maxN, parseInt(match[1], 10));
        }
        nextIdRef.current = Math.max(nextIdRef.current, maxN);
        const deduped = deduplicateMessageIds(initialMessages);
        state.messages = [...deduped];
        state.outputBuffer = "";
        state.currentAssistantContent = "";
        setLiveSessionMessages([...deduped]);
        liveMessagesRef.current = state.messages;
        skipReplayForSessionRef.current = sid; // SSE effect will add skipReplay=1 so server does not replay
      } else {
        state.messages = [];
        state.outputBuffer = "";
        state.currentAssistantContent = "";
      }

      setSessionId(sid);
      setViewingLiveSession(true); // SSE effect will open connection
      syncSessionToReact(sid);
    },
    [deduplicateMessageIds, getOrCreateSessionState, syncSessionToReact]
  );

  const appendAssistantText = useCallback(
    (chunk: string) => {
      const sid = currentSessionIdRef.current;
      if (!sid) return;
      const state = getOrCreateSessionState(sid);
      const sanitized = stripAnsi(chunk);
      if (!sanitized) return;
      const next = state.currentAssistantContent ? state.currentAssistantContent + sanitized : sanitized;
      state.currentAssistantContent = next;
      const last = state.messages[state.messages.length - 1];
      if (last?.role === "assistant") {
        state.messages = [...state.messages.slice(0, -1), { ...last, content: next }];
      } else {
        state.messages = [...state.messages, { id: `msg-${++nextIdRef.current}`, role: "assistant", content: sanitized }];
      }
      state.typingIndicator = true;
      currentAssistantContentRef.current = next;
      liveMessagesRef.current = state.messages;
      if (displayedSessionIdRef.current === sid) {
      if (!streamFlushTimeoutRef.current) {
        streamFlushTimeoutRef.current = setTimeout(() => {
          streamFlushTimeoutRef.current = null;
          const currentSid = currentSessionIdRef.current;
          if (currentSid) {
            const s = getOrCreateSessionState(currentSid);
            setLiveSessionMessages([...s.messages]);
            setTypingIndicator(true);
          }
        }, STREAM_UPDATE_THROTTLE_MS);
      }
    }
    setSessionStateForSession(sid, "running");
  },
    [getOrCreateSessionState, setSessionStateForSession]
  );
  appendAssistantTextRef.current = appendAssistantText;

  const finalizeAssistantMessage = useCallback(
    () => {
      if (streamFlushTimeoutRef.current) {
        clearTimeout(streamFlushTimeoutRef.current);
        streamFlushTimeoutRef.current = null;
      }
      const sid = currentSessionIdRef.current;
      if (!sid) return;
      const state = getOrCreateSessionState(sid);
      const raw = state.currentAssistantContent;
      const cleaned = stripTrailingIncompleteTag(raw ?? "");
      if (cleaned !== (raw ?? "")) {
        const last = state.messages[state.messages.length - 1];
        if (last?.role === "assistant") {
          const trimmed = cleaned.trim();
          if (trimmed === "") state.messages = state.messages.slice(0, -1);
          else state.messages = [...state.messages.slice(0, -1), { ...last, content: cleaned }];
        }
        state.currentAssistantContent = cleaned;
      }
      const last = state.messages[state.messages.length - 1];
      if (last?.role === "assistant" && (last.content ?? "").trim() === "") {
        state.messages = state.messages.slice(0, -1);
      }
      state.currentAssistantContent = "";
      state.typingIndicator = false;
      if (displayedSessionIdRef.current === sid) {
        setLiveSessionMessages([...state.messages]);
        setTypingIndicator(false);
        currentAssistantContentRef.current = "";
        liveMessagesRef.current = state.messages;
      }
      setSessionStateForSession(sid, "idle");
    },
    [getOrCreateSessionState, setSessionStateForSession]
  );
  finalizeAssistantMessageRef.current = finalizeAssistantMessage;

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

  const deduplicateDenialsRef = useRef(deduplicateDenials);
  const recordToolUseRef = useRef(recordToolUse);
  const getAndClearToolUseRef = useRef(getAndClearToolUse);
  const addPermissionDenialRef = useRef(addPermissionDenial);
  deduplicateDenialsRef.current = deduplicateDenials;
  recordToolUseRef.current = recordToolUse;
  getAndClearToolUseRef.current = getAndClearToolUse;
  addPermissionDenialRef.current = addPermissionDenial;

  // ===== Init session (POST /api/sessions/new) - sessionId must never be null ===== //
  useEffect(() => {
    if (sessionId != null) return;
    let cancelled = false;
    const initSession = async () => {
      setSessionInitLoading(true);
      try {
        const res = await fetch(`${serverUrl}/api/sessions/new`, { method: "POST" });
        const data = await res.json();
        if (cancelled) return;
        if (data.ok && data.sessionId) {
          const sid = data.sessionId;
          getOrCreateSessionState(sid);
          setSessionId(sid);
        }
      } catch (err) {
        if (!cancelled) {
          if (__DEV__) console.warn("[sse] init session failed:", err);
        }
      } finally {
        if (!cancelled) setSessionInitLoading(false);
      }
    };
    void initSession();
    return () => { cancelled = true; };
  }, [sessionId, serverUrl, getOrCreateSessionState]);

  // ===== EventSource Connection Setup (single active SSE) ===== //
  useEffect(() => {
    const targetSessionId = sessionIdFromOptions ?? sessionId;
    if (!targetSessionId || !status) {
      closeActiveSse("inactive");
      return;
    }

    syncSessionToReact(targetSessionId);

    // If we're switching selected sessions, always close first then open.
    if (activeSseRef.current && activeSseRef.current.id !== targetSessionId) {
      if (suppressActiveSessionSwitchRef.current) {
        // Migration happened (active stream id changed to new backend id); do not spawn a second stream.
        suppressActiveSessionSwitchRef.current = false;
      } else {
        closeActiveSse("session-switch");
      }
    }

    if (activeSseRef.current) {
      if (activeSseRef.current.id === targetSessionId) {
        setConnected(true);
      }
      return;
    }

    if (__DEV__) console.log("[sse] effect mount", { serverUrl, sessionId: targetSessionId });

    const sid = targetSessionId;
    // Mutable ref so handlers use current session id after re-key (session-started can migrate sid)
    const connectionSessionIdRef = { current: sid };

    const handlers = createSessionHandlers(connectionSessionIdRef);
    const state = getOrCreateSessionState(sid);
    const hasStreamEndedRef = { current: false };

    let streamUrl = `${serverUrl}/api/sessions/${sid}/stream?activeOnly=1`;
    if (skipReplayForSessionRef.current === sid) {
      streamUrl += "&skipReplay=1";
      skipReplayForSessionRef.current = null;
    }
    const EventSourceCtor = ((EventSource as unknown as { default?: EventSourceCtor }).default ??
      (EventSource as EventSourceCtor)) as EventSourceCtor;
    const sse = new EventSourceCtor(streamUrl);
    activeSseRef.current = { id: sid, source: sse };

    const setSessionIdWithRekey = (newId: string | null) => {
      const currentSid = connectionSessionIdRef.current;
      if (newId && newId !== currentSid && !newId.startsWith("temp-")) {
        const s = sessionStatesRef.current.get(currentSid);
        if (s) {
          sessionStatesRef.current.delete(currentSid);
          sessionStatesRef.current.set(newId, s);
        }
        connectionSessionIdRef.current = newId;
        if (activeSseRef.current && activeSseRef.current.id === currentSid) {
          activeSseRef.current.id = newId;
          suppressActiveSessionSwitchRef.current = true;
        }
      }
      setSessionId(newId);
    };

    const dispatchProviderEvent = createEventDispatcher({
      setPermissionDenials: (d) => setPermissionDenials(d ? deduplicateDenialsRef.current(d) : null),
      setModelName,
      setWaitingForUserInput: (v) => {
        state.waitingForUserInput = v;
        if (v) {
          state.sessionState = "waiting";
        } else if (state.sessionState === "waiting") {
          state.sessionState = "running";
        }
        if (displayedSessionIdRef.current === connectionSessionIdRef.current) {
          setSessionState(state.sessionState);
          setWaitingForUserInput(v);
        }
      },
      setPendingAskQuestion,
      setCurrentActivity: (v) => {
        state.currentActivity = v;
        if (displayedSessionIdRef.current === connectionSessionIdRef.current) setCurrentActivity(v);
      },
      addMessage: (role, content, codeRefs) => handlers.addMessageForSession(role, content, codeRefs),
      appendAssistantText: (chunk) => handlers.appendAssistantTextForSession(chunk),
      getCurrentAssistantContent: () => state.currentAssistantContent,
      getLastMessageRole: () => {
        const m = state.messages;
        return m.length ? m[m.length - 1]?.role ?? null : null;
      },
      getLastMessageContent: () => {
        const m = state.messages;
        const last = m.length ? m[m.length - 1] : null;
        return (last?.content as string) ?? "";
      },
      deduplicateDenials: (d) => deduplicateDenialsRef.current(d),
      recordToolUse: (id, data) => recordToolUseRef.current(id, data),
      getAndClearToolUse: (id) => getAndClearToolUseRef.current(id),
      addPermissionDenial: (denial) => addPermissionDenialRef.current(denial),
      setSessionId: setSessionIdWithRekey,
    });

    const openHandler = () => {
      hasStreamEndedRef.current = false;
      if (__DEV__) console.log("[sse] connected", { sessionId: connectionSessionIdRef.current });
      setConnected(true);
    };

    const errorHandler = (err: unknown) => {
      const e = err as { xhrStatus?: number; xhrState?: number; message?: string };
      const isExpectedServerClose =
        e?.xhrStatus === 200 &&
        e?.xhrState === 4 &&
        (typeof e?.message === "string" && e.message.toLowerCase().includes("connection abort"));
      if (isExpectedServerClose) {
        // Server closed the stream (e.g. after event: end). Android XHR reports this as "Software caused connection abort".
        if (__DEV__) console.log("[sse] stream ended (server closed)", { sessionId: connectionSessionIdRef.current });
      } else {
        if (__DEV__) console.log("[sse] disconnected (error)", { sessionId: connectionSessionIdRef.current });
        console.error("[sse] error:", err);
      }
      if (displayedSessionIdRef.current === connectionSessionIdRef.current) {
        setConnected(false);
        setSessionStateForSession(connectionSessionIdRef.current, "idle");
        setTypingIndicator(false);
      }
    };

    const messageHandler = (event: any) => {
      if (!event.data && typeof event.data !== "string") return;

      const dataStr = event.data;
      state.outputBuffer += dataStr + "\n";
      const lines = state.outputBuffer.split("\n");
      state.outputBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const clean = stripAnsi(trimmed);
        if (!clean) continue;

        if (isProviderSystemNoise(clean)) continue;

        try {
          const parsed = JSON.parse(clean);

          if (parsed.type === "session-started" || parsed.type === "claude-started") {
            hasStreamEndedRef.current = false;
            state.sessionState = "running";
            state.typingIndicator = true;
            state.waitingForUserInput = false;
            state.lastSessionTerminated = false;
            if (displayedSessionIdRef.current === connectionSessionIdRef.current) {
              setSessionStateForSession(connectionSessionIdRef.current, "running");
              setTypingIndicator(true);
              setWaitingForUserInput(false);
              setLastSessionTerminated(false);
            }
            const raw = parsed.session_id ?? parsed.sessionId;
            const id = raw != null && raw !== "" ? String(raw) : null;
            if (id && !id.startsWith("temp-")) {
              setSessionIdWithRekey(id);
            }
            setLastRunOptions({
              permissionMode: (parsed.permissionMode as string | null) ?? null,
              allowedTools: (Array.isArray(parsed.allowedTools) ? parsed.allowedTools : []) as string[],
              useContinue: Boolean(parsed.useContinue),
            });
            continue;
          }

          if (parsed.type === "session" && typeof parsed.id === "string" && !parsed.id.startsWith("temp-")) {
            setSessionIdWithRekey(parsed.id);
            continue;
          }

          if (parsed.type === "agent_end") {
            if (__DEV__) {
              console.log("[stream] agent_end event received");
            }
          }

          if (isProviderStream(parsed)) {
            dispatchProviderEvent(parsed as Record<string, unknown>);
          } else if (typeof parsed === "object" && parsed != null && "type" in parsed) {
            continue;
          } else {
            handlers.appendAssistantTextForSession(clean + "\n");
          }
        } catch {
          const jsonStart = clean.indexOf("{");
          if (clean.startsWith("<u") && jsonStart > 0) {
            try {
              const parsed = JSON.parse(clean.slice(jsonStart));
              if (parsed?.type === "agent_end") {
                if (__DEV__) {
                  console.log("[stream fallback] agent_end event received");
                }
              }
              if (isProviderStream(parsed)) {
                dispatchProviderEvent(parsed as Record<string, unknown>);
                continue;
              }
              if (typeof parsed === "object" && parsed != null && "type" in parsed) continue;
            } catch {}
          }
          handlers.appendAssistantTextForSession(clean + "\n");
        }
        }
    };

    const handleStreamEnd = (event: { data?: string }, exitCodeDefault = 0) => {
      if (hasStreamEndedRef.current) return;
      hasStreamEndedRef.current = true;

      let exitCode = exitCodeDefault;
      try {
        if (event?.data) {
          const parsed = JSON.parse(event.data);
          exitCode = parsed.exitCode ?? exitCodeDefault;
        }
      } catch (e) {}

      state.sessionState = "idle";
      state.typingIndicator = false;
      state.currentActivity = null;
      state.waitingForUserInput = false;
      if (exitCode !== 0) state.lastSessionTerminated = true;
      if (!state.hasCompletedFirstRun && exitCode === 0) state.hasCompletedFirstRun = true;

      if (displayedSessionIdRef.current === connectionSessionIdRef.current) {
        setSessionStateForSession(connectionSessionIdRef.current, "idle");
        setTypingIndicator(false);
        setCurrentActivity(null);
        setWaitingForUserInput(false);
        if (exitCode !== 0) setLastSessionTerminated(true);
      }
      handlers.finalizeAssistantMessageForSession();
      closeActiveSse("stream-end");
    };

    const endHandler = (event: any) => handleStreamEnd(event, 0);
    const doneHandler = (event: any) => handleStreamEnd(event ?? {}, 0);

    activeSseHandlersRef.current = {
      open: openHandler,
      error: errorHandler,
      message: messageHandler,
      end: endHandler,
      done: doneHandler,
    };

    sse.addEventListener("open", openHandler);
    sse.addEventListener("error", errorHandler);
    sse.addEventListener("message", messageHandler);
    // @ts-ignore - custom event type sent by our backend on terminate/agent_end
    sse.addEventListener("end", endHandler);
    // @ts-ignore - react-native-sse fires "done" when server closes connection
    sse.addEventListener("done", doneHandler);

    return () => {
      // SSE lifecycle is driven by target session/status; cleanup handled by effect transitions.
    };
  }, [
    closeActiveSse,
    createSessionHandlers,
    getOrCreateSessionState,
    setSessionStateForSession,
    serverUrl,
    sessionIdFromOptions,
    sessionId,
    status,
    syncSessionToReact,
  ]);

  // Close all SSEs only on unmount
  useEffect(() => {
    return () => closeActiveSse("unmount");
  }, [closeActiveSse]);

  // Sync displayed session state when sessionId or viewingLiveSession changes
  useEffect(() => {
    if (viewingLiveSession && sessionId) {
      syncSessionToReact(sessionId);
    } else if (!viewingLiveSession) {
      setConnected(false);
    }
  }, [sessionId, viewingLiveSession, syncSessionToReact]);

  // Refresh status when app returns from background (fixes stale Idle/Running display)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active" && viewingLiveSession && sessionId) {
        syncSessionToReact(sessionId);
      }
    });
    return () => sub.remove();
  }, [sessionId, viewingLiveSession, syncSessionToReact]);

  const submitPrompt = useCallback(
    async (
      prompt: string,
      permissionMode?: string,
      allowedTools?: string[],
      codeRefs?: CodeRefPayload[],
      approvalMode?: string,
      codexOptions?: { askForApproval?: string; fullAuto?: boolean; yolo?: boolean; effort?: string }
    ) => {
      let fullPrompt = prompt;
      if (codeRefs && codeRefs.length > 0) {
        const refsText = codeRefs
          .map((ref) => `File: ${ref.path}\n\`\`\`\n${ref.snippet}\n\`\`\``)
          .join("\\n\\n");
        fullPrompt = `${refsText}\n\n${prompt}`;
      }

      addMessage("user", prompt);
      setPermissionDenials(null);
      setLastSessionTerminated(false);
      setSessionStateForSession(sessionId, "running");
      setTypingIndicator(true);
      setWaitingForUserInput(false);

      // Yield to main thread so React paints loading state before fetch (immediate visual feedback)
      await new Promise<void>((resolve) => queueMicrotask(resolve));

      const payload = {
        prompt: fullPrompt,
        permissionMode,
        allowedTools,
        provider,
        model,
        approvalMode,
        sessionId,
        ...(provider === "codex" && { effort: codexOptions?.effort ?? "medium" }),
        ...(codexOptions && {
          askForApproval: codexOptions.askForApproval,
          fullAuto: codexOptions.fullAuto,
          yolo: codexOptions.yolo,
        }),
      };

      const resetRunningState = () => {
        setSessionStateForSession(sessionId, "idle");
        setTypingIndicator(false);
        setWaitingForUserInput(false);
      };

      try {
        const res = await fetch(`${serverUrl}/api/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.ok && data.sessionId) {
          const newSessionId = data.sessionId;
          if (sessionId != null && newSessionId !== sessionId) {
            // Switching to different session - clear new session's state OR preserve past messages
            const newState = getOrCreateSessionState(newSessionId);
            newState.sessionState = "running";
            newState.typingIndicator = true;
            // If viewingLiveSession was false, we should have carried over savedSessionMessages
            if (!viewingLiveSession) {
              const merged = [...savedSessionMessages, ...pendingMessagesForNewSessionRef.current];
              newState.messages = deduplicateMessageIds(merged);
            } else {
              // Usually we don't switch session ids mid-stream unless the server forks, but typically we want empty.
              // However, if we just typed a message after a reset, preserve pending.
              newState.messages = deduplicateMessageIds([...pendingMessagesForNewSessionRef.current]);
            }
            pendingMessagesForNewSessionRef.current = [];
            newState.outputBuffer = "";
            newState.currentAssistantContent = "";
            setLiveSessionMessages([...newState.messages]);
            outputBufferRef.current = "";
            currentAssistantContentRef.current = "";
            setSessionStateForSession(newSessionId, "running");
          } else if (sessionId == null) {
            // First prompt - migrate user message(s) to new session
            const newState = getOrCreateSessionState(newSessionId);
            newState.sessionState = "running";
            newState.typingIndicator = true;
            // Also include saved session messages if we were viewing a past session
            const merged = viewingLiveSession
              ? [...pendingMessagesForNewSessionRef.current]
              : [...savedSessionMessages, ...pendingMessagesForNewSessionRef.current];
            newState.messages = deduplicateMessageIds(merged);
            pendingMessagesForNewSessionRef.current = [];
            setLiveSessionMessages([...newState.messages]);
            setSessionStateForSession(newSessionId, "running");
          }
          setSessionId(newSessionId);
        } else {
          // Server error - reset running state so user isn't stuck. Use sessionId from error response if present (client can connect to stream).
          if (data.sessionId && typeof data.sessionId === "string" && !data.sessionId.startsWith("temp-")) {
            const newState = getOrCreateSessionState(data.sessionId);
            newState.sessionState = "idle";
            newState.typingIndicator = false;
            const merged = viewingLiveSession
              ? pendingMessagesForNewSessionRef.current
              : [...savedSessionMessages, ...pendingMessagesForNewSessionRef.current];
            newState.messages = deduplicateMessageIds(merged);
            pendingMessagesForNewSessionRef.current = [];
            setLiveSessionMessages([...newState.messages]);
            setSessionId(data.sessionId);
            setSessionStateForSession(data.sessionId, "idle");
          }
          resetRunningState();
          if (__DEV__ && !data.ok) {
            console.warn("[sse] submit prompt failed:", data?.error ?? "no sessionId in response");
          }
        }
      } catch (err) {
        console.error("Failed to submit prompt", err);
        resetRunningState();
      }
    },
    [
      addMessage,
      deduplicateMessageIds,
      getOrCreateSessionState,
      provider,
      model,
      serverUrl,
      sessionId,
      setSessionStateForSession,
      viewingLiveSession,
      savedSessionMessages,
    ]
  );

  const submitAskQuestionAnswer = useCallback(
    async (answers: Array<{ header: string; selected: string[] }>) => {
      if (!sessionId || !pendingAskQuestion) return;
      
      const payload = {
        tool_use_id: pendingAskQuestion.tool_use_id,
        answers,
      };
      
      try {
        await fetch(`${serverUrl}/api/sessions/${sessionId}/input`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: { content: [{ type: "tool_result", content: JSON.stringify(answers) }] } }),
        });
      } catch (err) {
        console.error("Failed to submit question answer", err);
      }
      
      setPendingAskQuestion(null);
      setWaitingForUserInput(false);
    },
    [sessionId, pendingAskQuestion, serverUrl]
  );

  const dismissAskQuestion = useCallback(() => {
    setPendingAskQuestion(null);
    setWaitingForUserInput(false);
  }, []);

  const retryAfterPermission = useCallback(
    async (permissionMode?: string, approvalMode?: string, retryPrompt?: string) => {
      const denials = permissionDenials ?? [];
      const allowedTools = getAllowedToolsFromDenials(denials);
      const prompt =
        typeof retryPrompt === "string" && retryPrompt.trim()
          ? retryPrompt.trim()
          : "(retry with new permissions)";

      const payload = {
        prompt,
        permissionMode: permissionMode ?? lastRunOptions.permissionMode ?? undefined,
        approvalMode,
        allowedTools,
        replaceRunning: true,
        provider,
        model,
        sessionId,
      };

      setSessionStateForSession(sessionId, "running");
      setTypingIndicator(true);
      setWaitingForUserInput(false);
      try {
        const res = await fetch(`${serverUrl}/api/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.ok && data.sessionId) {
          const sid = data.sessionId;
          const s = getOrCreateSessionState(sid);
          s.sessionState = "running";
          s.typingIndicator = true;
          setSessionId(sid);
          setSessionStateForSession(sid, "running");
        }
      } catch (err) {
        console.error("Failed to retry after permission", err);
      }
      
      setPermissionDenials(null);
    },
    [
      permissionDenials,
      lastRunOptions,
      provider,
      model,
      serverUrl,
      sessionId,
      getOrCreateSessionState,
      setSessionStateForSession,
    ]
  );

  const dismissPermission = useCallback(() => {
    setPermissionDenials(null);
  }, []);

  const terminateAgent = useCallback(async () => {
    setLastSessionTerminated(true);
    if (!sessionId) return;
    try {
      await fetch(`${serverUrl}/api/sessions/${sessionId}/terminate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch (err) {
       console.error("Failed to terminate agent", err);
    }
  }, [sessionId, serverUrl]);

  const resetSession = useCallback(async () => {
    if (sessionId) {
      try {
        await fetch(`${serverUrl}/api/sessions/${sessionId}/terminate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resetSession: true }),
        });
      } catch (err) {
        console.error("Failed to reset session", err);
      }
      if (__DEV__) console.log("[sse] disconnected (reset)", { sessionId });
      closeActiveSse("reset");
      sessionStatesRef.current.delete(sessionId);
    }
    setLiveSessionMessages([]);
    setSessionId(null);
    setPermissionDenials(null);
    setLastRunOptions({ permissionMode: null, allowedTools: [], useContinue: false });
    setPendingAskQuestion(null);
    setLastSessionTerminated(false);
    currentAssistantContentRef.current = "";
    setViewingLiveSession(true);
  }, [closeActiveSse, sessionId, serverUrl]);

  /** Start new session: clear state; session is created on first prompt (no dummy session). */
  const startNewSession = useCallback(async () => {
    if (sessionId) {
      try {
        await fetch(`${serverUrl}/api/sessions/${sessionId}/terminate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resetSession: true }),
        });
      } catch (err) {
        console.error("Failed to terminate session", err);
      }
      if (__DEV__) console.log("[sse] disconnected (new session)", { sessionId });
      closeActiveSse("new-session");
      sessionStatesRef.current.delete(sessionId);
    }
    setSessionId(null);
    pendingMessagesForNewSessionRef.current = [];
    setLiveSessionMessages([]);
    setPermissionDenials(null);
    setLastRunOptions({ permissionMode: null, allowedTools: [], useContinue: false });
    setPendingAskQuestion(null);
    setLastSessionTerminated(false);
    currentAssistantContentRef.current = "";
    setViewingLiveSession(true);
  }, [closeActiveSse, sessionId, serverUrl]);

  /**
   * Load a session from persisted conversation (disk).
   * Does NOT connect SSE — use for idle/finished sessions only.
   * When session is running, call resumeLiveSession instead so SSE is connected.
   */
  const loadSession = useCallback((loadedMessages: Message[], sessionIdToResume?: string | null) => {
    if (__DEV__) console.log("[sse] loadSession", loadedMessages.length, "msgs", { sessionIdToResume });
    let maxN = 0;
    for (const m of loadedMessages) {
      const match = /^msg-(\d+)$/.exec(m.id);
      if (match) maxN = Math.max(maxN, parseInt(match[1], 10));
    }
    nextIdRef.current = Math.max(nextIdRef.current, maxN);
    const deduped = deduplicateMessageIds(loadedMessages);
    setSavedSessionMessages(deduped);
    setViewingLiveSession(false); // No SSE for this session
    // When loading an idle session: set sessionId and populate session state + liveSessionMessages
    // so that when user submits (switchToLiveSession), past history is preserved instead of blanking
    if (sessionIdToResume && !sessionIdToResume.startsWith("temp-")) {
      setSessionId(sessionIdToResume);
      const state = getOrCreateSessionState(sessionIdToResume);
      state.messages = [...deduped];
      state.sessionState = "idle";
      state.typingIndicator = false;
      state.waitingForUserInput = false;
      state.currentActivity = null;
      setLiveSessionMessages([...deduped]);
      liveMessagesRef.current = state.messages;
    }
    // Reset running state when loading a past/finished session - we're viewing history, not live
    setSessionState("idle");
    setTypingIndicator(false);
    setWaitingForUserInput(false);
    setCurrentActivity(null);
  }, [deduplicateMessageIds, getOrCreateSessionState]);

  const switchToLiveSession = useCallback(() => {
    if (__DEV__) console.log("[sse] switchToLiveSession", { sessionId });
    setViewingLiveSession(true);
  }, [sessionId]);

  return {
    connected,
    messages,
    agentRunning: sessionState !== "idle",
    waitingForUserInput,
    typingIndicator,
    currentActivity,
    permissionDenials,
    lastRunOptions,
    pendingAskQuestion,
    mockSequences,
    selectedSequence,
    setSelectedSequence,
    sessionId,
    sessionInitLoading,
    lastSessionTerminated,
    submitPrompt,
    submitAskQuestionAnswer,
    dismissAskQuestion,
    retryAfterPermission,
    dismissPermission,
    terminateAgent,
    resetSession,
    startNewSession,
    loadSession,
    resumeLiveSession,
    switchToLiveSession,
    viewingLiveSession,
    liveSessionMessages,
  };
}
