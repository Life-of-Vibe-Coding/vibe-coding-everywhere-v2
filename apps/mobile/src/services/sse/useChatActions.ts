import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { getAllowedToolsFromDenials } from "@/services/providers/stream";
import type {
  LastRunOptions,
  Message,
  PendingAskUserQuestion,
  PermissionDenial,
  CodeReference,
} from "@/core/types";
import type { CodeRefPayload } from "@/components/file/FileViewerModal";
import type { SessionLiveState, SessionRuntimeState } from "./hooks-types";
import type { Provider } from "@/theme/index";
import { appendCodeRefsToPrompt } from "./hooks-utils";
import { normalizeSubmitPayload, stableStringify } from "./hooks-serialization";

type UseChatActionsParams = {
  serverUrl: string;
  provider: Provider;
  model: string;
  sessionId: string | null;
  pendingAskQuestion: PendingAskUserQuestion | null;
  permissionDenials: PermissionDenial[] | null;
  lastRunOptionsRef: MutableRefObject<LastRunOptions>;
  liveMessagesRef: MutableRefObject<Message[]>;
  sessionStatesRef: MutableRefObject<Map<string, SessionLiveState>>;
  sessionMessagesRef: MutableRefObject<Map<string, Message[]>>;
  sessionDraftRef: MutableRefObject<Map<string, string>>;
  pendingMessagesForNewSessionRef: MutableRefObject<Message[]>;
  currentAssistantContentRef: MutableRefObject<string>;
  outputBufferRef: MutableRefObject<string>;
  displayedSessionIdRef: MutableRefObject<string | null>;
  addMessage: (role: Message["role"], content: string, codeReferences?: CodeReference[]) => string;
  deduplicateMessageIds: (messages: Message[]) => Message[];
  getOrCreateSessionState: (sid: string) => SessionLiveState;
  getOrCreateSessionMessages: (sid: string) => Message[];
  setSessionMessages: (sid: string, messages: Message[]) => void;
  setSessionDraft: (sid: string, draft: string) => void;
  setSessionId: Dispatch<SetStateAction<string | null>>;
  setLiveSessionMessages: Dispatch<SetStateAction<Message[]>>;
  setPermissionDenials: Dispatch<SetStateAction<PermissionDenial[] | null>>;
  setPendingAskQuestion: Dispatch<SetStateAction<PendingAskUserQuestion | null>>;
  setLastSessionTerminated: Dispatch<SetStateAction<boolean>>;
  setWaitingForUserInput: Dispatch<SetStateAction<boolean>>;
  setSessionStateForSession: (sid: string | null, next: SessionRuntimeState) => void;
  setConnectionIntent: (sid: string | null, shouldConnect: boolean) => void;
  clearConnectionIntent: (sid: string | null) => void;
  closeActiveSse: (reason?: string) => void;
};

export function useChatActions(params: UseChatActionsParams) {
  const {
    serverUrl,
    provider,
    model,
    sessionId,
    pendingAskQuestion,
    permissionDenials,
    lastRunOptionsRef,
    liveMessagesRef,
    sessionStatesRef,
    sessionMessagesRef,
    sessionDraftRef,
    pendingMessagesForNewSessionRef,
    currentAssistantContentRef,
    outputBufferRef,
    displayedSessionIdRef,
    addMessage,
    deduplicateMessageIds,
    getOrCreateSessionState,
    getOrCreateSessionMessages,
    setSessionMessages,
    setSessionDraft,
    setSessionId,
    setLiveSessionMessages,
    setPermissionDenials,
    setPendingAskQuestion,
    setLastSessionTerminated,
    setWaitingForUserInput,
    setSessionStateForSession,
    setConnectionIntent,
    clearConnectionIntent,
    closeActiveSse,
  } = params;

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
      setPermissionDenials,
      setLastSessionTerminated,
      setWaitingForUserInput,
      displayedSessionIdRef,
      liveMessagesRef,
      pendingMessagesForNewSessionRef,
      outputBufferRef,
      currentAssistantContentRef,
      setLiveSessionMessages,
      setSessionId,
    ]
  );

  const submitAskQuestionAnswer = useCallback(
    async (answers: Array<{ header: string; selected: string[] }>) => {
      if (!sessionId || !pendingAskQuestion) return;

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
    [sessionId, pendingAskQuestion, serverUrl, setPendingAskQuestion, setWaitingForUserInput]
  );

  const dismissAskQuestion = useCallback(() => {
    setPendingAskQuestion(null);
    setWaitingForUserInput(false);
  }, [setPendingAskQuestion, setWaitingForUserInput]);

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
          })
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
      lastRunOptionsRef,
      setSessionId,
      setWaitingForUserInput,
      setPermissionDenials,
    ]
  );

  const dismissPermission = useCallback(() => {
    setPermissionDenials(null);
  }, [setPermissionDenials]);

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
  }, [sessionId, serverUrl, setConnectionIntent, setLastSessionTerminated]);

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
  }, [
    closeActiveSse,
    sessionId,
    serverUrl,
    setConnectionIntent,
    clearConnectionIntent,
    sessionStatesRef,
    sessionMessagesRef,
    sessionDraftRef,
    setLiveSessionMessages,
    setSessionId,
    setPermissionDenials,
    lastRunOptionsRef,
    setPendingAskQuestion,
    setLastSessionTerminated,
    currentAssistantContentRef,
  ]);

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
  }, [
    closeActiveSse,
    sessionId,
    serverUrl,
    setConnectionIntent,
    clearConnectionIntent,
    sessionStatesRef,
    sessionMessagesRef,
    sessionDraftRef,
    pendingMessagesForNewSessionRef,
    setLiveSessionMessages,
    setPermissionDenials,
    lastRunOptionsRef,
    setPendingAskQuestion,
    setLastSessionTerminated,
    currentAssistantContentRef,
    setSessionId,
  ]);

  return {
    submitPrompt,
    submitAskQuestionAnswer,
    dismissAskQuestion,
    retryAfterPermission,
    dismissPermission,
    terminateAgent,
    resetSession,
    startNewSession,
  };
}
