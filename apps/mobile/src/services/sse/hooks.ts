/**
 * useSse hook - Main state management for SSE connection and AI sessions.
 *
 * This hook manages:
 * - SSE EventSource connection lifecycle
 * - Chat message state
 * - Session state (idle, running)
 * - Permission handling
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import EventSource from "react-native-sse";
import {
  stripAnsi,
  stripTrailingIncompleteTag,
  isProviderStream,
  getAllowedToolsFromDenials,
  isProviderSystemNoise,
} from "@/services/providers/stream";
import type { Message, CodeReference, PermissionDenial, PendingAskUserQuestion, LastRunOptions } from "@/core/types";
import { getDefaultServerConfig } from "@/services/server/config";
import { createEventDispatcher } from "@/services/providers/eventDispatcher";
import type { CodeRefPayload } from "@/components/file/FileViewerModal";
import { createSessionMessageHandlers } from "./sessionMessageHandlers";
import {
  deduplicateDenials,
  deduplicateMessageIds as deduplicateMessageIdsUtil,
  getMaxMessageId,
  appendCodeRefsToPrompt,
} from "./hooks-utils";
import {
  getOrCreateSessionState as getOrCreateSessionStateFromCache,
  getOrCreateSessionMessages as getOrCreateSessionMessagesFromCache,
  getSessionDraft as getSessionDraftFromCache,
  moveSessionCacheData,
  setSessionDraft as setSessionDraftFromCache,
  setSessionMessages as setSessionMessagesFromCache,
} from "./sessionCacheHelpers";
import { resolveDefaultModel, resolveStreamUrl } from "./sseHookHelpers";
import type { EventSourceCtor, EventSourceLike, SessionLiveState, SessionRuntimeState, UseSseOptions } from "./hooks-types";
import { useSessionManagementStore } from "@/state/sessionManagementStore";

// Re-export types for consumers that import from useSse
export type { Message, CodeReference, PermissionDenial, PendingAskUserQuestion, LastRunOptions };
export type { UseSseOptions, SessionRuntimeState };

function stableStringify(value: unknown): string {
  const seen = new WeakSet();
  try {
    return JSON.stringify(value, (_, nested) => {
      if (typeof nested === "object" && nested !== null) {
        if (seen.has(nested)) return "[Circular]";
        seen.add(nested);
      }
      return nested;
    });
  } catch (_) {
    const safe = toSafePlainValue(value, new WeakMap(), 0);
    return JSON.stringify(safe);
  }
}

function toSafePlainValue(value: unknown, seen: WeakMap<object, string>, depth: number): unknown {
  if (depth > 8) {
    return "[MaxDepth]";
  }
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;
  if (value instanceof Error) return value.message;
  if (typeof value === "symbol") return value.toString();
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[Circular]";
  seen.set(value, "[Circular]");
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Map) {
    return { __type: "Map", values: Array.from(value.values()).map((v) => toSafePlainValue(v, seen, depth + 1)) };
  }
  if (value instanceof Set) {
    return { __type: "Set", values: Array.from(value.values()).map((v) => toSafePlainValue(v, seen, depth + 1)) };
  }
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    const item = (value as Record<string, unknown>)[key];
    out[key] = toSafePlainValue(item, seen, depth + 1);
  }
  return out;
}

function normalizeSubmitPayload(payload: {
  prompt: unknown;
  permissionMode?: unknown;
  allowedTools?: unknown;
  provider?: unknown;
  model?: unknown;
  approvalMode?: unknown;
  sessionId?: unknown;
  replaceRunning?: unknown;
  effort?: unknown;
  askForApproval?: unknown;
  fullAuto?: unknown;
  yolo?: unknown;
}) {
  return {
    prompt:
      typeof payload.prompt === "string"
        ? payload.prompt
        : typeof payload.prompt?.toString === "function"
          ? String(payload.prompt)
          : "",
    permissionMode:
      payload.permissionMode === undefined ? undefined : String(payload.permissionMode),
    allowedTools: Array.isArray(payload.allowedTools)
      ? payload.allowedTools
          .map((item) => (typeof item === "string" ? item : String(item)))
          .filter(Boolean)
      : undefined,
    provider:
      payload.provider === "claude" || payload.provider === "gemini" || payload.provider === "codex"
        ? payload.provider
        : "codex",
    model: typeof payload.model === "string" && payload.model.trim() ? payload.model.trim() : undefined,
    approvalMode: payload.approvalMode === undefined ? undefined : String(payload.approvalMode),
    sessionId:
      typeof payload.sessionId === "string" && payload.sessionId.trim()
        ? payload.sessionId.trim()
        : undefined,
    replaceRunning: Boolean(payload.replaceRunning),
    effort: typeof payload.effort === "string" ? payload.effort : undefined,
    askForApproval:
      payload.askForApproval === undefined ? undefined : String(payload.askForApproval),
    fullAuto: typeof payload.fullAuto === "boolean" ? payload.fullAuto : undefined,
    yolo: typeof payload.yolo === "boolean" ? payload.yolo : undefined,
  };
}

export function useSse(options: UseSseOptions = {}) {
  const serverConfig = options.serverConfig ?? getDefaultServerConfig();
  const serverUrl = serverConfig.getBaseUrl();
  const provider = options.provider ?? "codex";
  const {
    onConnectedChange,
    onSessionRunningChange,
    onWaitingForUserInputChange,
    onPermissionDenialsChange,
    onPendingAskQuestionChange,
    onLastSessionTerminatedChange,
    onMessagesChange,
  } = options;
  const defaultModel = resolveDefaultModel(provider);
  const model = options.model ?? defaultModel;
  const [connected, setConnected] = useState(false);
  const [liveSessionMessages, setLiveSessionMessages] = useState<Message[]>([]);

  const [waitingForUserInput, setWaitingForUserInput] = useState(false);
  const [sessionState, setSessionState] = useState<SessionRuntimeState>("idle");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionInitLoading, setSessionInitLoading] = useState(false);

  const [permissionDenials, setPermissionDenials] = useState<PermissionDenial[] | null>(null);
  const lastRunOptionsRef = useRef<LastRunOptions>({
    permissionMode: null,
    allowedTools: [],
    useContinue: false,
  });
  
  const [pendingAskQuestion, setPendingAskQuestion] = useState<PendingAskUserQuestion | null>(null);
  const [lastSessionTerminated, setLastSessionTerminated] = useState(false);

  const activeSseRef = useRef<{ id: string; source: EventSourceLike } | null>(null);
  const activeSseHandlersRef = useRef<{
    open: (event: unknown) => void;
    error: (event: unknown) => void;
    message: (event: any) => void;
    end: (event: any) => void;
    done: (event: any) => void;
  } | null>(null);
  const suppressActiveSessionSwitchRef = useRef(false);
  const selectedSessionRuntimeRef = useRef<{ id: string | null; running: boolean } | null>(null);
  const connectionIntentBySessionRef = useRef<Map<string, boolean>>(new Map());
  const sawAgentEndRef = useRef(false);
  const outputBufferRef = useRef("");
  const currentAssistantContentRef = useRef("");
  const runtimeStateCallbacksRef = useRef({
    onConnectedChange,
    onSessionRunningChange,
    onWaitingForUserInputChange,
    onPermissionDenialsChange,
    onPendingAskQuestionChange,
    onLastSessionTerminatedChange,
    onMessagesChange,
  });
  useEffect(() => {
    runtimeStateCallbacksRef.current = {
      onConnectedChange,
      onSessionRunningChange,
      onWaitingForUserInputChange,
      onPermissionDenialsChange,
      onPendingAskQuestionChange,
      onLastSessionTerminatedChange,
      onMessagesChange,
    };
  }, [
      onConnectedChange,
      onSessionRunningChange,
      onWaitingForUserInputChange,
      onPermissionDenialsChange,
      onPendingAskQuestionChange,
    onLastSessionTerminatedChange,
    onMessagesChange,
  ]);

  useEffect(() => {
    runtimeStateCallbacksRef.current.onConnectedChange?.(connected);
  }, [connected]);

  useEffect(() => {
    runtimeStateCallbacksRef.current.onSessionRunningChange?.(sessionState !== "idle");
  }, [sessionState]);

  useEffect(() => {
    runtimeStateCallbacksRef.current.onWaitingForUserInputChange?.(waitingForUserInput);
  }, [waitingForUserInput]);

  useEffect(() => {
    runtimeStateCallbacksRef.current.onPermissionDenialsChange?.(permissionDenials);
  }, [permissionDenials]);

  useEffect(() => {
    runtimeStateCallbacksRef.current.onPendingAskQuestionChange?.(pendingAskQuestion);
  }, [pendingAskQuestion]);

  useEffect(() => {
    runtimeStateCallbacksRef.current.onLastSessionTerminatedChange?.(lastSessionTerminated);
  }, [lastSessionTerminated]);

  useEffect(() => {
    runtimeStateCallbacksRef.current.onMessagesChange?.(liveSessionMessages);
  }, [liveSessionMessages]);

  const sessionStatesRef = useRef<Map<string, SessionLiveState>>(new Map());
  const sessionMessagesRef = useRef<Map<string, Message[]>>(new Map());
  const sessionDraftRef = useRef<Map<string, string>>(new Map());
  const displayedSessionIdRef = useRef<string | null>(null);

  const getOrCreateSessionState = useCallback((sid: string): SessionLiveState => {
    return getOrCreateSessionStateFromCache(sessionStatesRef.current, sid);
  }, []);
  const getOrCreateSessionMessages = useCallback(
    (sid: string): Message[] => getOrCreateSessionMessagesFromCache(sessionMessagesRef.current, sid),
    []
  );
  const getSessionDraft = useCallback((sid: string): string => getSessionDraftFromCache(sessionDraftRef.current, sid), []);
  const setSessionDraft = useCallback(
    (sid: string, draft: string) => setSessionDraftFromCache(sessionDraftRef.current, sid, draft),
    []
  );
  const setSessionMessages = useCallback(
    (sid: string, messages: Message[]) => setSessionMessagesFromCache(sessionMessagesRef.current, sid, messages),
    []
  );
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
  const toolUseByIdRef = useRef<Map<string, { tool_name: string; tool_input?: Record<string, unknown> }>>(new Map());
  const liveMessagesRef = useRef<Message[]>([]);
  liveMessagesRef.current = liveSessionMessages;
  const currentSessionIdRef = useRef<string | null>(null);
  currentSessionIdRef.current = sessionId;
  displayedSessionIdRef.current = sessionId;

  const appendAssistantTextRef = useRef<(chunk: string) => void>(() => {});
  const addMessageRef = useRef<(role: Message["role"], content: string, codeReferences?: CodeReference[]) => string>(() => "");
  const finalizeAssistantMessageRef = useRef<() => void>(() => {});
  const streamFlushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const STREAM_UPDATE_THROTTLE_MS = 80;
  /** When set, the next SSE open for this session should use skipReplay=1 (client already has disk state). */
  const skipReplayForSessionRef = useRef<string | null>(null);
  const sessionStatuses = useSessionManagementStore((state) => state.sessionStatuses);
  const storeSessionId = useSessionManagementStore((state) => state.sessionId);
  const setStoreSessionId = useSessionManagementStore((state) => state.setSessionId);

  const getSessionStatusFromStore = useCallback(
    (sid: string | null) => {
      if (!sid) return undefined;
      return sessionStatuses.find((session) => session.id === sid);
    },
    [sessionStatuses]
  );

  const isSessionManagedRunning = useCallback(
    (sid: string | null): boolean => getSessionStatusFromStore(sid)?.status === "running",
    [getSessionStatusFromStore]
  );

  const getConnectionIntent = useCallback((sid: string | null): boolean | undefined => {
    if (!sid) return undefined;
    const intent = connectionIntentBySessionRef.current.get(sid);
    if (intent === undefined) return undefined;
    connectionIntentBySessionRef.current.delete(sid);
    return intent;
  }, []);

  const setConnectionIntent = useCallback((sid: string | null, shouldConnect: boolean) => {
    if (!sid) return;
    if (shouldConnect) {
      connectionIntentBySessionRef.current.set(sid, true);
      return;
    }
    connectionIntentBySessionRef.current.delete(sid);
  }, []);

  const clearConnectionIntent = useCallback((sid: string | null) => {
    if (!sid) return;
    connectionIntentBySessionRef.current.delete(sid);
  }, []);

  const syncSessionToReact = useCallback((sid: string | null) => {
    if (!sid) return;
    const s = sessionStatesRef.current.get(sid);
    const messages = getOrCreateSessionMessages(sid);
    if (s) {
      setLiveSessionMessages(messages);
      setSessionState(s.sessionState);
      outputBufferRef.current = "";
      currentAssistantContentRef.current = getSessionDraft(sid);
      liveMessagesRef.current = messages;
    } else {
      // Preserve previously displayed messages when switching to an in-flight migrated session id.
      const isDisplayedSession = displayedSessionIdRef.current === sid;
      const hasDisplayedMessages = liveMessagesRef.current.length > 0;
      if (!(isDisplayedSession && hasDisplayedMessages)) {
        setLiveSessionMessages([]);
        liveMessagesRef.current = [];
      }
      outputBufferRef.current = "";
      setSessionState("idle");
      setWaitingForUserInput(false);
      currentAssistantContentRef.current = "";
    }
  }, [getOrCreateSessionMessages, getSessionDraft]);

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
      if (displayedSessionIdRef.current === id && sawAgentEndRef.current) {
        setSessionStateForSession(id, "idle");
        setWaitingForUserInput(false);
      }
      suppressActiveSessionSwitchRef.current = false;
      activeSseRef.current = null;
      activeSseHandlersRef.current = null;
      if (streamFlushTimeoutRef.current) {
        clearTimeout(streamFlushTimeoutRef.current);
        streamFlushTimeoutRef.current = null;
      }
      clearConnectionIntent(id);
      setConnected(false);
    },
    [clearConnectionIntent, setSessionStateForSession, setWaitingForUserInput]
  );

  /** Deduplicate message IDs; bump nextIdRef for any reassignments. */
  const deduplicateMessageIds = useCallback(
    (msgs: Message[]): Message[] => deduplicateMessageIdsUtil(msgs, nextIdRef),
    [nextIdRef]
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
      const messages = getOrCreateSessionMessages(sid);
      const nextMessages = [...messages, newMsg];
      setSessionMessages(sid, nextMessages);
      if (displayedSessionIdRef.current === sid) {
        setLiveSessionMessages([...nextMessages]);
        liveMessagesRef.current = nextMessages;
      }
      return id;
    },
    [getOrCreateSessionMessages, setSessionMessages]
  );
  addMessageRef.current = addMessage;

  const seedSessionFromMessages = useCallback(
    (sid: string, initialMessages: Message[] | undefined, statusHint?: boolean) => {
      const shouldRun = typeof statusHint === "boolean" ? statusHint : isSessionManagedRunning(sid);
      const state = getOrCreateSessionState(sid);
      if (typeof statusHint === "boolean") {
        setConnectionIntent(sid, statusHint);
      } else {
        clearConnectionIntent(sid);
      }
      if (initialMessages && initialMessages.length > 0) {
        const maxN = getMaxMessageId(initialMessages);
        nextIdRef.current = Math.max(nextIdRef.current, maxN);
        const deduped = deduplicateMessageIds(initialMessages);
        setSessionMessages(sid, [...deduped]);
        setSessionDraft(sid, "");
        setLiveSessionMessages([...deduped]);
        liveMessagesRef.current = deduped;
        skipReplayForSessionRef.current = sid; // SSE effect will add skipReplay=1 so server does not replay
      } else {
        setSessionMessages(sid, []);
        setSessionDraft(sid, "");
      }
      state.sessionState = shouldRun ? "running" : "idle";
      setSessionState(state.sessionState);

      setSessionId(sid);
      setSessionStateForSession(sid, state.sessionState);
      syncSessionToReact(sid);
      setConnected(false);
    },
    [
    deduplicateMessageIds,
    getMaxMessageId,
    getOrCreateSessionState,
    getOrCreateSessionMessages,
    setSessionMessages,
    setSessionDraft,
    isSessionManagedRunning,
    setConnectionIntent,
    clearConnectionIntent,
    setSessionStateForSession,
      syncSessionToReact,
    ]
  );

  const loadSession = useCallback(
    (loadedMessages: Message[], sessionIdToResume?: string | null, statusHint?: boolean) => {
      if (__DEV__) console.log("[sse] loadSession", loadedMessages.length, "msgs", { sessionIdToResume, statusHint });
      if (sessionIdToResume && !sessionIdToResume.startsWith("temp-")) {
        if (activeSseRef.current && activeSseRef.current.id !== sessionIdToResume) {
          closeActiveSse("session-load");
        }
        seedSessionFromMessages(sessionIdToResume, loadedMessages, statusHint);
      }
    },
    [activeSseRef, closeActiveSse, seedSessionFromMessages]
  );

  const refreshCurrentSessionFromDisk = useCallback(
    async (sid: string | null) => {
      if (!sid || sid.startsWith("temp-")) return;
      try {
        const res = await fetch(`${serverUrl}/api/sessions/${encodeURIComponent(sid)}/messages`);
        if (!res.ok) return;
        const data = await res.json();
        const loadedMessages = Array.isArray(data?.messages) ? (data.messages as Message[]) : [];
        const state = getOrCreateSessionState(sid);
        const deduped = deduplicateMessageIds(loadedMessages);
        const maxN = getMaxMessageId(deduped);

        nextIdRef.current = Math.max(nextIdRef.current, maxN);
        setSessionMessages(sid, deduped);
        setSessionDraft(sid, "");
        state.sessionState = "idle";
        setSessionState(state.sessionState);

        if (displayedSessionIdRef.current === sid) {
          setLiveSessionMessages([...deduped]);
          liveMessagesRef.current = deduped;
          setSessionStateForSession(sid, "idle");
          setWaitingForUserInput(false);
          outputBufferRef.current = "";
          currentAssistantContentRef.current = "";
        }
      } catch (err) {
        if (__DEV__) {
          console.warn("[sse] refresh session from disk failed", { sessionId: sid, error: String(err) });
        }
      }
    },
    [
      deduplicateMessageIds,
      getMaxMessageId,
      getOrCreateSessionState,
      getOrCreateSessionMessages,
      getSessionDraft,
      setSessionDraft,
      setSessionMessages,
      serverUrl,
      setSessionStateForSession,
      setWaitingForUserInput,
    ]
  );

  const appendAssistantText = useCallback(
    (chunk: string) => {
      const sid = currentSessionIdRef.current;
      if (!sid) return;
      const sanitized = stripAnsi(chunk);
      if (!sanitized) return;
      const currentMessages = getOrCreateSessionMessages(sid);
      const nextDraft = getSessionDraft(sid);
      const draft = nextDraft ? nextDraft + sanitized : sanitized;
      setSessionDraft(sid, draft);
      const last = currentMessages[currentMessages.length - 1];
      if (last?.role === "assistant") {
        setSessionMessages(sid, [...currentMessages.slice(0, -1), { ...last, content: draft }]);
      } else {
        setSessionMessages(sid, [...currentMessages, { id: `msg-${++nextIdRef.current}`, role: "assistant", content: sanitized }]);
      }
      const nextMessages = getOrCreateSessionMessages(sid);
      currentAssistantContentRef.current = draft;
      liveMessagesRef.current = nextMessages;
      if (displayedSessionIdRef.current === sid) {
        if (!streamFlushTimeoutRef.current) {
          streamFlushTimeoutRef.current = setTimeout(() => {
            streamFlushTimeoutRef.current = null;
            const currentSid = currentSessionIdRef.current;
            if (currentSid) {
              const messages = getOrCreateSessionMessages(currentSid);
              setLiveSessionMessages([...messages]);
            }
          }, STREAM_UPDATE_THROTTLE_MS);
        }
      }
      if (!sawAgentEndRef.current) {
        setSessionStateForSession(sid, "running");
      }
    },
    [
      getOrCreateSessionMessages,
      getSessionDraft,
      setSessionDraft,
      setSessionMessages,
      setSessionStateForSession,
    ]
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
      const raw = getSessionDraft(sid);
      const cleaned = stripTrailingIncompleteTag(raw ?? "");
      if (cleaned !== (raw ?? "")) {
        const currentMessages = getOrCreateSessionMessages(sid);
        const last = currentMessages[currentMessages.length - 1];
        if (last?.role === "assistant") {
          const trimmed = cleaned.trim();
          if (trimmed === "") setSessionMessages(sid, currentMessages.slice(0, -1));
          else setSessionMessages(sid, [...currentMessages.slice(0, -1), { ...last, content: cleaned }]);
        }
      }
      const normalizedMessages = getOrCreateSessionMessages(sid);
      const last = normalizedMessages[normalizedMessages.length - 1];
      if (last?.role === "assistant" && (last.content ?? "").trim() === "") {
        setSessionMessages(sid, normalizedMessages.slice(0, -1));
      }
      setSessionDraft(sid, "");
      const normalized = getOrCreateSessionMessages(sid);
      if (displayedSessionIdRef.current === sid) {
        setLiveSessionMessages([...normalized]);
        currentAssistantContentRef.current = "";
        liveMessagesRef.current = normalized;
      }
      setSessionStateForSession(sid, "idle");
    },
    [
      getOrCreateSessionMessages,
      getSessionDraft,
      setSessionDraft,
      setSessionMessages,
      getOrCreateSessionState,
      setSessionStateForSession,
    ]
  );
  finalizeAssistantMessageRef.current = finalizeAssistantMessage;

  const deduplicateDenialsCallback = useCallback(deduplicateDenials, []);

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
      setPermissionDenials((prev) => deduplicateDenialsCallback([...(prev ?? []), denial]));
    },
    [deduplicateDenialsCallback]
  );

  const recordToolUseRef = useRef(recordToolUse);
  const getAndClearToolUseRef = useRef(getAndClearToolUse);
  const addPermissionDenialRef = useRef(addPermissionDenial);
  const deduplicateDenialsRef = useRef(deduplicateDenialsCallback);
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
    const targetSessionId = storeSessionId;
    const targetSessionIntent = getConnectionIntent(targetSessionId);
    const targetSessionRunning = targetSessionId
      ? (targetSessionIntent ?? isSessionManagedRunning(targetSessionId))
      : false;
    const prevSessionRuntime = selectedSessionRuntimeRef.current;
    if (prevSessionRuntime?.id === targetSessionId && prevSessionRuntime.running && !targetSessionRunning) {
      void refreshCurrentSessionFromDisk(targetSessionId);
    }
    if (!targetSessionId || !targetSessionRunning) {
      closeActiveSse("inactive");
      selectedSessionRuntimeRef.current = {
        id: targetSessionId ?? null,
        running: false,
      };
      return;
    }
    selectedSessionRuntimeRef.current = { id: targetSessionId, running: true };

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

    const handlers = createSessionMessageHandlers({
      sidRef: connectionSessionIdRef,
      getOrCreateSessionState,
      getOrCreateSessionMessages,
      setSessionMessages,
      getSessionDraft,
      setSessionDraft,
      displayedSessionIdRef,
      setLiveSessionMessages,
      setSessionStateForSession,
      liveMessagesRef,
      nextIdRef,
    });
    const hasStreamEndedRef = { current: false };
    sawAgentEndRef.current = false;

    const markAgentEnd = () => {
      if (sawAgentEndRef.current) return;
      sawAgentEndRef.current = true;
      const endedSessionId = connectionSessionIdRef.current;
      if (!endedSessionId) return;
      if (displayedSessionIdRef.current === endedSessionId) {
        setWaitingForUserInput(false);
      }
    };

    const { url: streamUrl, applySkipReplay } = resolveStreamUrl(serverUrl, sid, skipReplayForSessionRef.current);
    if (applySkipReplay) {
      skipReplayForSessionRef.current = null;
    }
    const EventSourceCtor = ((EventSource as unknown as { default?: EventSourceCtor }).default ??
      (EventSource as EventSourceCtor)) as EventSourceCtor;
    const sse = new EventSourceCtor(streamUrl);
    activeSseRef.current = { id: sid, source: sse };

    const setSessionIdWithRekey = (newId: string | null) => {
      const currentSid = connectionSessionIdRef.current;
      if (newId && newId !== currentSid && !newId.startsWith("temp-")) {
        moveSessionCacheData(currentSid, newId, sessionStatesRef.current, sessionMessagesRef.current, sessionDraftRef.current);
        connectionSessionIdRef.current = newId;
        if (activeSseRef.current && activeSseRef.current.id === currentSid) {
          activeSseRef.current.id = newId;
          suppressActiveSessionSwitchRef.current = true;
        }
        const selectedSessionRuntime = selectedSessionRuntimeRef.current;
        if (selectedSessionRuntime?.id === currentSid) {
          selectedSessionRuntimeRef.current = {
            ...selectedSessionRuntime,
            id: newId,
          };
        }
        const intent = connectionIntentBySessionRef.current.get(currentSid);
        if (intent !== undefined) {
          connectionIntentBySessionRef.current.delete(currentSid);
          connectionIntentBySessionRef.current.set(newId, intent);
        }
      }
      setSessionId(newId);
    };

    const dispatchProviderEvent = createEventDispatcher({
      setPermissionDenials: (d) => setPermissionDenials(d ? deduplicateDenialsRef.current(d) : null),
      setWaitingForUserInput: (v) => {
        if (displayedSessionIdRef.current === connectionSessionIdRef.current) {
          if (!sawAgentEndRef.current) {
            setSessionStateForSession(connectionSessionIdRef.current, "running");
          }
          setWaitingForUserInput(v);
        }
      },
      setPendingAskQuestion,
      setCurrentActivity: () => {
        // Activity is currently not surfaced in mobile chat UI and intentionally ignored.
      },
      addMessage: (role, content, codeRefs) => handlers.addMessageForSession(role, content, codeRefs),
      appendAssistantText: (chunk) => handlers.appendAssistantTextForSession(chunk),
      getCurrentAssistantContent: () => getSessionDraft(connectionSessionIdRef.current),
      getLastMessageRole: () => {
        const m = getOrCreateSessionMessages(connectionSessionIdRef.current);
        return m.length ? m[m.length - 1]?.role ?? null : null;
      },
      getLastMessageContent: () => {
        const m = getOrCreateSessionMessages(connectionSessionIdRef.current);
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
      }
    };

    const messageHandler = (event: any) => {
      if (!event.data && typeof event.data !== "string") return;

      const dataStr = event.data;
      outputBufferRef.current += dataStr + "\n";
      const lines = outputBufferRef.current.split("\n");
      outputBufferRef.current = lines.pop() ?? "";

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
            setLastSessionTerminated(false);
            if (displayedSessionIdRef.current === connectionSessionIdRef.current) {
              setSessionStateForSession(connectionSessionIdRef.current, "running");
              setWaitingForUserInput(false);
              setLastSessionTerminated(false);
            }
            const raw = parsed.session_id ?? parsed.sessionId;
            const id = raw != null && raw !== "" ? String(raw) : null;
            if (id && !id.startsWith("temp-")) {
              setSessionIdWithRekey(id);
            }
            lastRunOptionsRef.current = {
              permissionMode: (parsed.permissionMode as string | null) ?? null,
              allowedTools: (Array.isArray(parsed.allowedTools) ? parsed.allowedTools : []) as string[],
              useContinue: Boolean(parsed.useContinue),
            };
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
            markAgentEnd();
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
                markAgentEnd();
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

      setLastSessionTerminated(exitCode !== 0);
      if (displayedSessionIdRef.current === connectionSessionIdRef.current) {
        setSessionStateForSession(connectionSessionIdRef.current, "idle");
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
      // SSE lifecycle is driven by target session state; cleanup handled by effect transitions.
    };
  }, [
    closeActiveSse,
    getOrCreateSessionState,
    refreshCurrentSessionFromDisk,
    setSessionStateForSession,
    getConnectionIntent,
    isSessionManagedRunning,
    storeSessionId,
    serverUrl,
    syncSessionToReact,
  ]);

  // Close all SSEs only on unmount
  useEffect(() => {
    return () => closeActiveSse("unmount");
  }, [closeActiveSse]);

  // Sync displayed session state when sessionId changes
  useEffect(() => {
    if (sessionId) {
      syncSessionToReact(sessionId);
    } else {
      setConnected(false);
    }
  }, [sessionId, syncSessionToReact]);

  useEffect(() => {
    setStoreSessionId(sessionId);
  }, [sessionId, setStoreSessionId]);

  // Refresh status when app returns from background (fixes stale Idle/Running display)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active" && sessionId) {
        syncSessionToReact(sessionId);
      }
    });
    return () => sub.remove();
  }, [sessionId, syncSessionToReact]);

  const submitPrompt = useCallback(
    async (
      prompt: string,
      permissionMode?: string,
      allowedTools?: string[],
      codeRefs?: CodeRefPayload[],
      approvalMode?: string,
      codexOptions?: { askForApproval?: string; fullAuto?: boolean; yolo?: boolean; effort?: string }
    ) => {
      const safePrompt = typeof prompt === "string" ? prompt : String(prompt ?? "");
      const fullPrompt = appendCodeRefsToPrompt(
        safePrompt,
        codeRefs ? codeRefs.map((ref) => ({ path: ref.path, snippet: ref.snippet })) : undefined
      );

      addMessage("user", safePrompt);
      setPermissionDenials(null);
      setLastSessionTerminated(false);
      setSessionStateForSession(sessionId, "running");
      setWaitingForUserInput(false);

      // Yield to main thread so React paints loading state before fetch (immediate visual feedback)
      await new Promise<void>((resolve) => queueMicrotask(resolve));

      const payload = normalizeSubmitPayload({
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
      });

      const resetRunningState = () => {
        setSessionStateForSession(sessionId, "idle");
        setWaitingForUserInput(false);
      };

      let submitStage = "prepare";
      try {
        const requestBody = stableStringify(payload);
        if (__DEV__) {
          const payloadKeys = Object.entries(payload)
            .filter(([, value]) => value !== undefined)
            .map(([key]) => key);
          console.log("[sse] submit prompt payload keys", payloadKeys);
          console.log("[sse] submit prompt body length", requestBody.length);
        }
        submitStage = "fetch";
        const res = await fetch(`${serverUrl}/api/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody,
        });
        submitStage = "parse-json";
        const data = await res.json();
        submitStage = "apply-result";
          if (data.ok && data.sessionId) {
            const newSessionId = data.sessionId;
            const newState = getOrCreateSessionState(newSessionId);
            const currentMessages = getOrCreateSessionMessages(newSessionId);
            newState.sessionState = "running";
            const merged = deduplicateMessageIds([...currentMessages, ...pendingMessagesForNewSessionRef.current]);
            if (merged.length > 0) {
              setSessionMessages(newSessionId, merged);
            } else {
              setSessionMessages(newSessionId, []);
            }
            pendingMessagesForNewSessionRef.current = [];
            setSessionDraft(newSessionId, "");
            const messagesToDisplay = getOrCreateSessionMessages(newSessionId);
            if (displayedSessionIdRef.current === newSessionId) {
              setLiveSessionMessages([...messagesToDisplay]);
              liveMessagesRef.current = messagesToDisplay;
            }
            outputBufferRef.current = "";
            currentAssistantContentRef.current = "";
            setSessionStateForSession(newSessionId, "running");
            setConnectionIntent(newSessionId, true);
            if (!sessionId || sessionId !== newSessionId) {
              setSessionId(newSessionId);
            }
          } else {
            // Server error - reset running state so user isn't stuck. Use sessionId from error response if present (client can connect to stream).
            if (data.sessionId && typeof data.sessionId === "string" && !data.sessionId.startsWith("temp-")) {
              const errorState = getOrCreateSessionState(data.sessionId);
              const errorStateMessages = getOrCreateSessionMessages(data.sessionId);
              errorState.sessionState = "idle";
              const merged = deduplicateMessageIds([...errorStateMessages, ...pendingMessagesForNewSessionRef.current]);
              setSessionMessages(data.sessionId, merged);
              pendingMessagesForNewSessionRef.current = [];
              setLiveSessionMessages([...merged]);
              liveMessagesRef.current = merged;
              setSessionId(data.sessionId);
              setSessionStateForSession(data.sessionId, "idle");
            }
            resetRunningState();
            setConnectionIntent(sessionId, false);
            if (__DEV__ && !data.ok) {
              console.warn("[sse] submit prompt failed:", data?.error ?? "no sessionId in response");
            }
          }
      } catch (err) {
        const errStage = submitStage;
        const errStatus = err && typeof err === "object" && "status" in err ? (err as { status?: number }).status : undefined;
        if (__DEV__) {
          console.error("Failed to submit prompt", {
            stage: errStage ?? "request",
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
            status: errStatus,
          });
        } else {
          console.error("Failed to submit prompt", err);
        }
        setConnectionIntent(sessionId, false);
        resetRunningState();
      }
    },
    [
      addMessage,
      deduplicateMessageIds,
      getOrCreateSessionState,
      getOrCreateSessionMessages,
      setSessionMessages,
      setSessionDraft,
      setConnectionIntent,
      provider,
      model,
      serverUrl,
      sessionId,
      setSessionStateForSession,
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

      setSessionStateForSession(sessionId, "running");
      setWaitingForUserInput(false);
      try {
        const requestBody = stableStringify(
          normalizeSubmitPayload({
            prompt,
            permissionMode: permissionMode ?? lastRunOptionsRef.current.permissionMode ?? undefined,
            approvalMode,
            allowedTools,
            replaceRunning: true,
            provider,
            model,
            sessionId,
          }),
        );
        const res = await fetch(`${serverUrl}/api/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody,
        });
        const data = await res.json();
        if (data.ok && data.sessionId) {
          const sid = data.sessionId;
          const s = getOrCreateSessionState(sid);
          s.sessionState = "running";
          setSessionId(sid);
          setSessionStateForSession(sid, "running");
      setConnectionIntent(sid, true);
        }
      } catch (err) {
        console.error("Failed to retry after permission", err);
        setConnectionIntent(sessionId, false);
      }
      
      setPermissionDenials(null);
    },
    [
      permissionDenials,
      provider,
      model,
      serverUrl,
      sessionId,
      getOrCreateSessionState,
      setSessionStateForSession,
      setConnectionIntent,
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
      setConnectionIntent(sessionId, false);
    } catch (err) {
       console.error("Failed to terminate agent", err);
    }
  }, [sessionId, serverUrl, setConnectionIntent]);

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
      sessionMessagesRef.current.delete(sessionId);
      sessionDraftRef.current.delete(sessionId);
      clearConnectionIntent(sessionId);
      setConnectionIntent(sessionId, false);
    }
    setLiveSessionMessages([]);
    setSessionId(null);
    setPermissionDenials(null);
    lastRunOptionsRef.current = { permissionMode: null, allowedTools: [], useContinue: false };
    setPendingAskQuestion(null);
    setLastSessionTerminated(false);
    currentAssistantContentRef.current = "";
  }, [closeActiveSse, sessionId, serverUrl, setConnectionIntent, clearConnectionIntent]);

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
      sessionMessagesRef.current.delete(sessionId);
      sessionDraftRef.current.delete(sessionId);
      clearConnectionIntent(sessionId);
      setConnectionIntent(sessionId, false);
    }
    setSessionId(null);
    pendingMessagesForNewSessionRef.current = [];
    setLiveSessionMessages([]);
    setPermissionDenials(null);
    lastRunOptionsRef.current = { permissionMode: null, allowedTools: [], useContinue: false };
    setPendingAskQuestion(null);
    setLastSessionTerminated(false);
    currentAssistantContentRef.current = "";
  }, [closeActiveSse, sessionId, serverUrl, setConnectionIntent, clearConnectionIntent]);

  return {
    sessionRunning: sessionState !== "idle",
    sessionId,
    submitPrompt,
    submitAskQuestionAnswer,
    dismissAskQuestion,
    retryAfterPermission,
    dismissPermission,
    terminateAgent,
    resetSession,
    startNewSession,
    loadSession,
  };
}
