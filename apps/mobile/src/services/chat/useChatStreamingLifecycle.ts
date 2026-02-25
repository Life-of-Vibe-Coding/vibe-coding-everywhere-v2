import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { AppState, type AppStateStatus } from "react-native";
import EventSource from "react-native-sse";
import {
  stripAnsi,
  isProviderStream,
  isProviderSystemNoise,
} from "@/services/providers/stream";
import { createEventDispatcher } from "@/services/providers/eventDispatcher";
import { createSessionMessageHandlers } from "./sessionMessageHandlers";
import { moveSessionCacheData } from "./sessionCacheHelpers";
import { resolveStreamUrl } from "./chatHookHelpers";
import type {
  EventSourceCtor,
  LastRunOptions,
  EventSourceLike,
  Message,
  PendingAskUserQuestion,
  PermissionDenial,
  SessionLiveState,
  SessionRuntimeState,
} from "./hooks-types";

type UseChatStreamingLifecycleParams = {
  serverUrl: string;
  sessionId: string | null;
  storeSessionId: string | null;
  sessionStatuses: Array<{ id: string; status: string }>;
  skipReplayForSessionRef: MutableRefObject<string | null>;
  nextIdRef: MutableRefObject<number>;
  liveMessagesRef: MutableRefObject<Message[]>;
  outputBufferRef: MutableRefObject<string>;
  currentAssistantContentRef: MutableRefObject<string>;
  sessionStatesRef: MutableRefObject<Map<string, SessionLiveState>>;
  sessionMessagesRef: MutableRefObject<Map<string, Message[]>>;
  sessionDraftRef: MutableRefObject<Map<string, string>>;
  activeSseRef: MutableRefObject<{ id: string; source: EventSourceLike } | null>;
  activeSseHandlersRef: MutableRefObject<{
    open: (event: unknown) => void;
    error: (event: unknown) => void;
    message: (event: any) => void;
    end: (event: any) => void;
    done: (event: any) => void;
  } | null>;
  suppressActiveSessionSwitchRef: MutableRefObject<boolean>;
  selectedSessionRuntimeRef: MutableRefObject<{ id: string | null; running: boolean } | null>;
  connectionIntentBySessionRef: MutableRefObject<Map<string, boolean>>;
  sawAgentEndRef: MutableRefObject<boolean>;
  streamFlushTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  displayedSessionIdRef: MutableRefObject<string | null>;
  recordToolUseRef: MutableRefObject<(id: string, data: { tool_name: string; tool_input?: Record<string, unknown> }) => void>;
  getAndClearToolUseRef: MutableRefObject<(id: string) => { tool_name: string; tool_input?: Record<string, unknown> } | null>;
  addPermissionDenialRef: MutableRefObject<(denial: PermissionDenial) => void>;
  deduplicateDenialsRef: MutableRefObject<(denials: PermissionDenial[]) => PermissionDenial[]>;
  getOrCreateSessionState: (sid: string) => SessionLiveState;
  getOrCreateSessionMessages: (sid: string) => Message[];
  getSessionDraft: (sid: string) => string;
  setSessionDraft: (sid: string, draft: string) => void;
  setSessionMessages: (sid: string, messages: Message[]) => void;
  deduplicateMessageIds: (messages: Message[]) => Message[];
  getMaxMessageId: (messages: Message[]) => number;
  closeActiveSse: (reason?: string) => void;
  syncSessionToReact: (sid: string | null) => void;
  getConnectionIntent: (sid: string | null) => boolean | undefined;
  setConnectionIntent: (sid: string | null, shouldConnect: boolean) => void;
  clearConnectionIntent: (sid: string | null) => void;
  setConnected: Dispatch<SetStateAction<boolean>>;
  setSessionId: Dispatch<SetStateAction<string | null>>;
  setLiveSessionMessages: Dispatch<SetStateAction<Message[]>>;
  setSessionState: Dispatch<SetStateAction<SessionRuntimeState>>;
  setSessionStateForSession: (sid: string | null, next: SessionRuntimeState) => void;
  setWaitingForUserInput: Dispatch<SetStateAction<boolean>>;
  setPendingAskQuestion: Dispatch<SetStateAction<PendingAskUserQuestion | null>>;
  setPermissionDenials: Dispatch<SetStateAction<PermissionDenial[] | null>>;
  setLastSessionTerminated: Dispatch<SetStateAction<boolean>>;
  setStoreSessionId: (sid: string | null) => void;
  lastRunOptionsRef: MutableRefObject<LastRunOptions>;
};

const STREAM_FLUSH_INTERVAL_MS = 50;
const STREAM_FLUSH_INTERVAL_LARGE_MS = 95;
const STREAM_FLUSH_DRAFT_THRESHOLD = 2400;
const STREAM_BOUNDARY_MARKER = /[.!?;,\n]/;

export function useChatStreamingLifecycle(params: UseChatStreamingLifecycleParams) {
  const {
    serverUrl,
    sessionId,
    storeSessionId,
    sessionStatuses,
    skipReplayForSessionRef,
    nextIdRef,
    liveMessagesRef,
    outputBufferRef,
    currentAssistantContentRef,
    sessionStatesRef,
    sessionMessagesRef,
    sessionDraftRef,
    activeSseRef,
    activeSseHandlersRef,
    suppressActiveSessionSwitchRef,
    selectedSessionRuntimeRef,
    connectionIntentBySessionRef,
    sawAgentEndRef,
    streamFlushTimeoutRef,
    displayedSessionIdRef,
    recordToolUseRef,
    getAndClearToolUseRef,
    addPermissionDenialRef,
    deduplicateDenialsRef,
    getOrCreateSessionState,
    getOrCreateSessionMessages,
    getSessionDraft,
    setSessionDraft,
    setSessionMessages,
    deduplicateMessageIds,
    getMaxMessageId,
    closeActiveSse,
    syncSessionToReact,
    getConnectionIntent,
    setConnectionIntent,
    clearConnectionIntent,
    setConnected,
    setSessionId,
    setLiveSessionMessages,
    setSessionState,
    setSessionStateForSession,
    setWaitingForUserInput,
    setPendingAskQuestion,
    setPermissionDenials,
    setLastSessionTerminated,
    setStoreSessionId,
    lastRunOptionsRef,
  } = params;

  const isSessionManagedRunning = useCallback(
    (sid: string | null): boolean => {
      if (!sid) return false;
      return sessionStatuses.find((session) => session.id === sid)?.status === "running";
    },
    [sessionStatuses]
  );
  const streamFlushPerfRef = useRef({
    flushCount: 0,
    totalChars: 0,
    lastFlushAt: 0,
  });

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
      setSessionDraft,
      setSessionMessages,
      serverUrl,
      setSessionStateForSession,
      setWaitingForUserInput,
      setSessionState,
      setLiveSessionMessages,
      liveMessagesRef,
      nextIdRef,
      displayedSessionIdRef,
      outputBufferRef,
      currentAssistantContentRef,
    ]
  );

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

    if (activeSseRef.current && activeSseRef.current.id !== targetSessionId) {
      if (suppressActiveSessionSwitchRef.current) {
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

    let pendingAssistantText = "";
    const flushAssistantText = () => {
      if (!pendingAssistantText) return;
      const chunk = pendingAssistantText;
      pendingAssistantText = "";
      streamFlushPerfRef.current.flushCount += 1;
      streamFlushPerfRef.current.totalChars += chunk.length;
      const now = Date.now();
      const sinceLast = streamFlushPerfRef.current.lastFlushAt
        ? now - streamFlushPerfRef.current.lastFlushAt
        : 0;
      streamFlushPerfRef.current.lastFlushAt = now;
      const start = Date.now();
      handlers.appendAssistantTextForSession(chunk);
      const appendDuration = Date.now() - start;
      if (__DEV__ && streamFlushPerfRef.current.flushCount % 15 === 0) {
        console.debug("[stream] assistant flush", {
          flushCount: streamFlushPerfRef.current.flushCount,
          totalChars: streamFlushPerfRef.current.totalChars,
          sinceLastMs: sinceLast,
          appendMs: appendDuration,
          chunkLen: chunk.length,
        });
      }
    };
    const queueAssistantText = (chunk: string) => {
      pendingAssistantText += chunk;
      if (STREAM_BOUNDARY_MARKER.test(chunk)) {
        if (streamFlushTimeoutRef.current) {
          clearTimeout(streamFlushTimeoutRef.current);
          streamFlushTimeoutRef.current = null;
        }
        flushAssistantText();
        return;
      }
      if (streamFlushTimeoutRef.current) return;
      const currentDraft = getSessionDraft(connectionSessionIdRef.current);
      const delay =
        currentDraft.length + pendingAssistantText.length > STREAM_FLUSH_DRAFT_THRESHOLD
          ? STREAM_FLUSH_INTERVAL_LARGE_MS
          : STREAM_FLUSH_INTERVAL_MS;
      streamFlushTimeoutRef.current = setTimeout(() => {
        streamFlushTimeoutRef.current = null;
        flushAssistantText();
      }, delay);
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
      setModelName: () => {
        // Model name is currently not surfaced in mobile chat UI and intentionally ignored.
      },
      addMessage: (role, content, codeRefs) => handlers.addMessageForSession(role, content, codeRefs),
      appendAssistantText: (chunk) => queueAssistantText(chunk),
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
            queueAssistantText(clean + "\n");
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
          queueAssistantText(clean + "\n");
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
      if (streamFlushTimeoutRef.current) {
        clearTimeout(streamFlushTimeoutRef.current);
        streamFlushTimeoutRef.current = null;
      }
      flushAssistantText();
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
    setSessionId,
    activeSseRef,
    suppressActiveSessionSwitchRef,
    selectedSessionRuntimeRef,
    setConnected,
    getOrCreateSessionMessages,
    setSessionMessages,
    getSessionDraft,
    setSessionDraft,
    displayedSessionIdRef,
    setLiveSessionMessages,
    liveMessagesRef,
    nextIdRef,
    sawAgentEndRef,
    setWaitingForUserInput,
    skipReplayForSessionRef,
    sessionStatesRef,
    sessionMessagesRef,
    sessionDraftRef,
    connectionIntentBySessionRef,
    setPermissionDenials,
    deduplicateDenialsRef,
    setPendingAskQuestion,
    recordToolUseRef,
    getAndClearToolUseRef,
    addPermissionDenialRef,
    outputBufferRef,
    setLastSessionTerminated,
    activeSseHandlersRef,
  ]);

  useEffect(() => {
    return () => closeActiveSse("unmount");
  }, [closeActiveSse]);

  useEffect(() => {
    if (sessionId) {
      syncSessionToReact(sessionId);
    } else {
      setConnected(false);
    }
  }, [sessionId, syncSessionToReact, setConnected]);

  useEffect(() => {
    setStoreSessionId(sessionId);
  }, [sessionId, setStoreSessionId]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active" && sessionId) {
        syncSessionToReact(sessionId);
      }
    });
    return () => sub.remove();
  }, [sessionId, syncSessionToReact]);
}
