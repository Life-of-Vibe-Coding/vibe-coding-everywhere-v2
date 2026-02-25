import { useEffect, useRef } from "react";

import { usePerformanceMonitor } from "../../design-system";
import { notifyAgentFinished, notifyApprovalNeeded } from "../../services/agentNotifications";
import { getDefaultServerConfig } from "../../core";
import { useSessionManagementSync } from "../../features/app/useSessionManagementSync";
import type { ThemeSessionStateState } from "./ThemeSessionState";
import type { SseSessionControllerState } from "./SseSessionController";

type SessionManagerServerConfig = ReturnType<typeof getDefaultServerConfig>;

export type SessionSideEffectManagerInput = {
  serverConfig: SessionManagerServerConfig;
  sseState: SseSessionControllerState;
  themeState: ThemeSessionStateState;
  workspacePath: string | null;
};

function useAgentFinishedSideEffect({
  agentRunning,
  sessionId,
  serverConfig,
}: {
  agentRunning: boolean;
  sessionId: string | null;
  serverConfig: SessionManagerServerConfig;
}): void {
  const prevAgentRunningRef = useRef(false);

  useEffect(() => {
    if (prevAgentRunningRef.current && !agentRunning) {
      void notifyAgentFinished();
      if (sessionId && !sessionId.startsWith("temp-")) {
        const baseUrl = serverConfig.getBaseUrl();
        fetch(`${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/finished`, { method: "POST" }).catch(() => {});
      }
    }
    prevAgentRunningRef.current = agentRunning;
  }, [agentRunning, sessionId, serverConfig]);
}

function useApprovalNeededSideEffect({
  pendingAskQuestion,
  waitingForUserInput,
  permissionDenials,
}: {
  pendingAskQuestion: SessionSideEffectManagerInput["sseState"]["pendingAskQuestion"];
  waitingForUserInput: SessionSideEffectManagerInput["sseState"]["waitingForUserInput"];
  permissionDenials: SessionSideEffectManagerInput["sseState"]["permissionDenials"];
}): void {
  const prevApprovalNeededRef = useRef(false);

  useEffect(() => {
    const approvalNeeded =
      pendingAskQuestion != null ||
      waitingForUserInput ||
      (permissionDenials != null && permissionDenials.length > 0);

    if (approvalNeeded && !prevApprovalNeededRef.current) {
      const q = pendingAskQuestion?.questions?.[0];
      const title =
        typeof (q?.header ?? q?.question) === "string"
          ? (q?.header ?? q?.question)
          : permissionDenials && permissionDenials.length > 0
            ? "Permission decision needed"
            : undefined;
      void notifyApprovalNeeded(title);
    }

    prevApprovalNeededRef.current = approvalNeeded;
  }, [pendingAskQuestion, waitingForUserInput, permissionDenials]);
}

export function useSessionSideEffects({
  serverConfig,
  sseState,
  themeState,
  workspacePath,
}: SessionSideEffectManagerInput): void {
  const { provider, model } = themeState;
  const {
    connected,
    messages,
    permissionDenials,
    waitingForUserInput,
    pendingAskQuestion,
    agentRunning,
    sessionId,
    liveSessionMessages,
    viewingLiveSession,
    sessionStatuses,
    setSessionStatuses,
    storeProvider,
    storeModel,
    storeSessionId,
    typingIndicator,
  } = sseState;

  usePerformanceMonitor(__DEV__);

  useAgentFinishedSideEffect({
    agentRunning,
    sessionId,
    serverConfig,
  });

  useApprovalNeededSideEffect({
    pendingAskQuestion,
    waitingForUserInput,
    permissionDenials,
  });

  useSessionManagementSync({
    connected,
    serverConfig,
    sessionId,
    sessionStatuses,
    setSessionStatuses,
    viewingLiveSession,
    workspacePath,
    storeProvider: storeProvider ?? "codex",
    storeModel: storeModel ?? "",
    storeSessionId,
    provider,
    model,
    additionalSnapshot: {
      messages,
      typingIndicator,
      liveMessages: liveSessionMessages.length,
    },
  });
}
