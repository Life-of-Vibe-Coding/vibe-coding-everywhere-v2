/**
 * useSocket hook - Main state management for SSE connection and AI sessions.
 *
 * This hook manages:
 * - SSE EventSource connection lifecycle
 * - Chat message state
 * - AI session state (running, waiting for input)
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

function toWorkspaceRelativePath(filePath: string, workspaceRoot: string | null): string {
  const normalized = filePath.replace(/\\/g, "/").trim();
  if (!workspaceRoot) return normalized;
  const root = workspaceRoot.replace(/\\/g, "/").replace(/\/$/, "");
  if (root === "" || (!normalized.startsWith(root + "/") && normalized !== root)) return normalized;
  const rel = normalized === root ? "" : normalized.slice(root.length).replace(/^\//, "");
  return rel || normalized;
}

export interface UseSocketOptions {
  serverConfig?: IServerConfig;
  provider?: Provider;
  model?: string;
}

export function useSocket(options: UseSocketOptions = {}) {
  const serverConfig = options.serverConfig ?? getDefaultServerConfig();
  const serverUrl = serverConfig.getBaseUrl();
  const provider = options.provider ?? "pi";
  const defaultModel =
    provider === "claude" ? "sonnet4.5" : provider === "pi" || provider === "codex" ? "gpt-5.1-codex-mini" : "gemini-2.5-flash";
  const model = options.model ?? defaultModel;

  const [connected, setConnected] = useState(false);
  const [liveSessionMessages, setLiveSessionMessages] = useState<Message[]>([]);
  const [viewingLiveSession, setViewingLiveSession] = useState(true);

  const [claudeRunning, setClaudeRunning] = useState(false);
  const [waitingForUserInput, setWaitingForUserInput] = useState(false);
  const [typingIndicator, setTypingIndicator] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
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

  const eventSourceMapRef = useRef<Map<string, EventSource>>(new Map());
  const prevSessionIdRef = useRef<string | null>(null);
  const outputBufferRef = useRef("");
  const currentAssistantContentRef = useRef("");
  const hasCompletedFirstRunRef = useRef(false);

  interface SessionLiveState {
    messages: Message[];
    outputBuffer: string;
    currentAssistantContent: string;
    claudeRunning: boolean;
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
        claudeRunning: false,
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

  const syncSessionToReact = useCallback((sid: string | null) => {
    if (!sid) return;
    const s = sessionStatesRef.current.get(sid);
    if (s) {
      setLiveSessionMessages(s.messages);
      setClaudeRunning(s.claudeRunning);
      setTypingIndicator(s.typingIndicator);
      setWaitingForUserInput(s.waitingForUserInput);
      setCurrentActivity(s.currentActivity);
      setLastSessionTerminated(s.lastSessionTerminated);
      outputBufferRef.current = s.outputBuffer;
      currentAssistantContentRef.current = s.currentAssistantContent;
      hasCompletedFirstRunRef.current = s.hasCompletedFirstRun;
      liveMessagesRef.current = s.messages;
    } else {
      setLiveSessionMessages([]);
      setClaudeRunning(false);
      setTypingIndicator(false);
      setWaitingForUserInput(false);
      setCurrentActivity(null);
      outputBufferRef.current = "";
      currentAssistantContentRef.current = "";
      liveMessagesRef.current = [];
    }
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
        if (displayedSessionIdRef.current === sidRef.current) {
          setLiveSessionMessages([...state.messages]);
          setTypingIndicator(true);
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
        if (displayedSessionIdRef.current === sidRef.current) {
          setLiveSessionMessages([...state.messages]);
          setTypingIndicator(false);
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

  const resumeLiveSession = useCallback((sid: string, initialMessages: Message[]) => {
    let maxN = 0;
    for (const m of initialMessages) {
      const match = /^msg-(\d+)$/.exec(m.id);
      if (match) maxN = Math.max(maxN, parseInt(match[1], 10));
    }
    nextIdRef.current = Math.max(nextIdRef.current, maxN);
    const seen = new Set<string>();
    const deduped = initialMessages.map((m) => {
      let id = m.id;
      if (seen.has(id)) {
        id = `msg-${++nextIdRef.current}`;
        seen.add(id);
      } else {
        seen.add(id);
      }
      return { ...m, id };
    });

    const state = getOrCreateSessionState(sid);
    state.messages = deduped;
    state.outputBuffer = "";
    state.currentAssistantContent = "";
    // If it's already connected, we don't want history to duplicate everything.
    // However, since we re-subscribe to SSE, the server will send history catchups.
    // To handle this, the server will use `?activeOnly=1` for resumed sessions,
    // which streams the currently generating (active) turn (if any) and omits past turns.
    
    setSessionId(sid);
    setViewingLiveSession(true);
    syncSessionToReact(sid);
  }, [getOrCreateSessionState, syncSessionToReact]);

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
      if (displayedSessionIdRef.current === sid) {
        setLiveSessionMessages([...state.messages]);
        setTypingIndicator(true);
        currentAssistantContentRef.current = next;
        liveMessagesRef.current = state.messages;
      }
    },
    [getOrCreateSessionState]
  );
  appendAssistantTextRef.current = appendAssistantText;

  const finalizeAssistantMessage = useCallback(
    () => {
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
    },
    [getOrCreateSessionState]
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

  // ===== EventSource Connection Setup (multi-SSE: do not close on session switch) ===== //
  useEffect(() => {
    if (!sessionId || !viewingLiveSession) {
      // Do NOT close any SSE - keep all connections open
      setConnected(sessionId != null && eventSourceMapRef.current.has(sessionId));
      return;
    }

    // Sync displayed session state when switching
    if (prevSessionIdRef.current != null && prevSessionIdRef.current !== sessionId) {
      syncSessionToReact(sessionId);
    }
    prevSessionIdRef.current = sessionId;

    // Create SSE only if we don't already have one for this session
    if (eventSourceMapRef.current.has(sessionId)) {
      setConnected(true);
      return;
    }

    if (__DEV__) console.log("[sse] effect mount", { serverUrl, sessionId });

    const sid = sessionId;
    // Mutable ref so handlers use current session id after re-key (session-started can migrate sid)
    const connectionSessionIdRef = { current: sid };

    const handlers = createSessionHandlers(connectionSessionIdRef);
    const state = getOrCreateSessionState(sid);

    const sse = new EventSource(`${serverUrl}/api/sessions/${sid}/stream?activeOnly=1`);
    eventSourceMapRef.current.set(sid, sse);

    const setSessionIdWithRekey = (newId: string | null) => {
      const currentSid = connectionSessionIdRef.current;
      if (newId && newId !== currentSid && !newId.startsWith("temp-")) {
        const existing = eventSourceMapRef.current.get(currentSid);
        if (existing) {
          eventSourceMapRef.current.delete(currentSid);
          eventSourceMapRef.current.set(newId, existing);
        }
        const s = sessionStatesRef.current.get(currentSid);
        if (s) {
          sessionStatesRef.current.delete(currentSid);
          sessionStatesRef.current.set(newId, s);
        }
        connectionSessionIdRef.current = newId;
      }
      setSessionId(newId);
    };

    const dispatchProviderEvent = createEventDispatcher({
      setPermissionDenials: (d) => setPermissionDenials(d ? deduplicateDenialsRef.current(d) : null),
      setModelName,
      setWaitingForUserInput: (v) => {
        state.waitingForUserInput = v;
        if (displayedSessionIdRef.current === connectionSessionIdRef.current) setWaitingForUserInput(v);
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

    sse.addEventListener("open", () => {
      if (__DEV__) console.log("[sse] connected", { sessionId: connectionSessionIdRef.current });
      if (displayedSessionIdRef.current === connectionSessionIdRef.current) setConnected(true);
    });

    sse.addEventListener("error", (err) => {
      if (__DEV__) console.log("[sse] disconnected (error)", { sessionId: connectionSessionIdRef.current });
      console.error("[sse] error:", err);
      if (displayedSessionIdRef.current === connectionSessionIdRef.current) setConnected(false);
    });

    sse.addEventListener("message", (event: any) => {
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
            state.claudeRunning = true;
            state.typingIndicator = true;
            state.waitingForUserInput = false;
            state.lastSessionTerminated = false;
            if (displayedSessionIdRef.current === connectionSessionIdRef.current) {
              setClaudeRunning(true);
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
    });

    const handleStreamEnd = (event: { data?: string }, exitCodeDefault = 0) => {
      let exitCode = exitCodeDefault;
      try {
        if (event?.data) {
          const parsed = JSON.parse(event.data);
          exitCode = parsed.exitCode ?? exitCodeDefault;
        }
      } catch (e) {}

      state.claudeRunning = false;
      state.typingIndicator = false;
      state.currentActivity = null;
      state.waitingForUserInput = false;
      if (exitCode !== 0) state.lastSessionTerminated = true;
      if (!state.hasCompletedFirstRun && exitCode === 0) state.hasCompletedFirstRun = true;

      if (displayedSessionIdRef.current === connectionSessionIdRef.current) {
        setClaudeRunning(false);
        setTypingIndicator(false);
        setCurrentActivity(null);
        setWaitingForUserInput(false);
        if (exitCode !== 0) setLastSessionTerminated(true);
      }
      queueMicrotask(() => handlers.finalizeAssistantMessageForSession());
    };

    // @ts-ignore - custom event type sent by our backend on terminate/agent_end
    sse.addEventListener("end", (event: any) => handleStreamEnd(event, 0));
    // @ts-ignore - react-native-sse fires "done" when server closes connection
    sse.addEventListener("done", (event: any) => handleStreamEnd(event ?? {}, 0));

    // Do NOT close SSE on effect cleanup (session switch / viewingLiveSession) - keep connections open
    return () => {
      // No-op: we keep all SSEs open
    };
  }, [serverUrl, sessionId, viewingLiveSession, createSessionHandlers, getOrCreateSessionState, syncSessionToReact]);

  // Close all SSEs only on unmount
  useEffect(() => {
    return () => {
      eventSourceMapRef.current.forEach((sse, id) => {
        if (__DEV__) console.log("[sse] disconnected (unmount)", { sessionId: id });
        sse.close();
      });
      eventSourceMapRef.current.clear();
    };
  }, []);

  // Sync displayed session state when sessionId or viewingLiveSession changes
  useEffect(() => {
    if (viewingLiveSession && sessionId) {
      syncSessionToReact(sessionId);
      setConnected(eventSourceMapRef.current.has(sessionId));
    } else if (!viewingLiveSession) {
      setConnected(false);
    }
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

      const payload = {
        prompt: fullPrompt,
        permissionMode,
        allowedTools,
        provider,
        model,
        approvalMode,
        sessionId,
        ...((provider === "pi" || provider === "codex") && { effort: codexOptions?.effort ?? "medium" }),
        ...(codexOptions && {
          askForApproval: codexOptions.askForApproval,
          fullAuto: codexOptions.fullAuto,
          yolo: codexOptions.yolo,
        }),
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
            // If viewingLiveSession was false, we should have carried over savedSessionMessages
            if (!viewingLiveSession) {
              newState.messages = [...savedSessionMessages, ...pendingMessagesForNewSessionRef.current];
            } else {
              // Usually we don't switch session ids mid-stream unless the server forks, but typically we want empty.
              // However, if we just typed a message after a reset, preserve pending.
              newState.messages = [...pendingMessagesForNewSessionRef.current];
            }
            pendingMessagesForNewSessionRef.current = [];
            newState.outputBuffer = "";
            newState.currentAssistantContent = "";
            setLiveSessionMessages([...newState.messages]);
            outputBufferRef.current = "";
            currentAssistantContentRef.current = "";
          } else if (sessionId == null) {
            // First prompt - migrate user message(s) to new session
            const newState = getOrCreateSessionState(newSessionId);
            // Also include saved session messages if we were viewing a past session
            newState.messages = viewingLiveSession ? [...pendingMessagesForNewSessionRef.current] : [...savedSessionMessages, ...pendingMessagesForNewSessionRef.current];
            pendingMessagesForNewSessionRef.current = [];
            setLiveSessionMessages([...newState.messages]);
          }
          setSessionId(newSessionId);
        }
      } catch (err) {
        console.error("Failed to submit prompt", err);
      }
    },
    [addMessage, provider, model, serverUrl, sessionId]
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

      try {
        const res = await fetch(`${serverUrl}/api/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.ok && data.sessionId) {
          setSessionId(data.sessionId);
        }
      } catch (err) {
        console.error("Failed to retry after permission", err);
      }
      
      setPermissionDenials(null);
    },
    [permissionDenials, lastRunOptions, provider, model, serverUrl, sessionId]
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
      // Close SSE for this session on reset
      const sse = eventSourceMapRef.current.get(sessionId);
      if (sse) {
        if (__DEV__) console.log("[sse] disconnected (reset)", { sessionId });
        sse.close();
        eventSourceMapRef.current.delete(sessionId);
      }
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
  }, [sessionId, serverUrl]);

  const loadSession = useCallback((loadedMessages: Message[]) => {
    if (__DEV__) console.log("[sse] loadSession", loadedMessages.length, "msgs");
    let maxN = 0;
    for (const m of loadedMessages) {
      const match = /^msg-(\\d+)$/.exec(m.id);
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

  const switchToLiveSession = useCallback(() => {
    if (__DEV__) console.log("[sse] switchToLiveSession", { sessionId, openCount: eventSourceMapRef.current.size });
    setViewingLiveSession(true);
  }, [sessionId]);

  return {
    connected,
    messages,
    claudeRunning,
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
    lastSessionTerminated,
    submitPrompt,
    submitAskQuestionAnswer,
    dismissAskQuestion,
    retryAfterPermission,
    dismissPermission,
    terminateAgent,
    resetSession,
    loadSession,
    resumeLiveSession,
    switchToLiveSession,
    viewingLiveSession,
    liveSessionMessages,
  };
}
