import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, FlatList, InteractionManager } from "react-native";

import { getModelForProvider, ModalSessionItem } from "@/features/app/appConfig";
import { triggerHaptic } from "@/design-system";
import { useSessionManagementStore, type SessionStatus } from "@/state/sessionManagementStore";
import * as sessionStore from "@/services/sessionStore";
import { useSse, type Message, type PermissionDenial, type PendingAskUserQuestion } from "@/services/sse/hooks";
import type { BrandProvider } from "@/theme/index";

export type SseSessionControllerProps = {
  provider: BrandProvider;
  model: string;
  serverConfig: {
    getBaseUrl: () => string;
  };
  setProvider: (provider: BrandProvider) => void;
  setModel: (model: string) => void;
  switchWorkspaceForSession?: (workspacePath: string) => Promise<void>;
  children: (state: SseSessionControllerState) => React.ReactNode;
};

export type SseSessionControllerState = {
  connected: boolean;
  messages: Message[];
  agentRunning: boolean;
  waitingForUserInput: boolean;
  typingIndicator: boolean;
  currentActivity: string | null;
  permissionDenials: PermissionDenial[] | null;
  lastSessionTerminated: boolean;
  sessionId: string | null;
  sessionInitLoading: boolean;
  pendingAskQuestion: PendingAskUserQuestion | null;
  submitPrompt: ReturnType<typeof useSse>["submitPrompt"];
  submitAskQuestionAnswer: ReturnType<typeof useSse>["submitAskQuestionAnswer"];
  dismissAskQuestion: ReturnType<typeof useSse>["dismissAskQuestion"];
  retryAfterPermission: ReturnType<typeof useSse>["retryAfterPermission"];
  dismissPermission: ReturnType<typeof useSse>["dismissPermission"];
  terminateAgent: ReturnType<typeof useSse>["terminateAgent"];
  resetSession: ReturnType<typeof useSse>["resetSession"];
  loadSession: ReturnType<typeof useSse>["loadSession"];
  resumeLiveSession: ReturnType<typeof useSse>["resumeLiveSession"];
  switchToLiveSession: ReturnType<typeof useSse>["switchToLiveSession"];
  viewingLiveSession: boolean;
  liveSessionMessages: Message[];
  startNewSession: ReturnType<typeof useSse>["startNewSession"];
  selectedSseSessionRunning: boolean;
  setSelectedSseSessionRunning: (running: boolean) => void;
  tailBoxMaxHeight: number;
  flatListRef: React.RefObject<FlatList<Message> | null>;
  onContentSizeChange: () => void;
  sessionStatuses: SessionStatus[];
  setSessionStatuses: (sessions: SessionStatus[]) => void;
  storeProvider: BrandProvider | null;
  storeModel: string | null;
  storeSessionId: string | null;
  handleProviderChange: (provider: BrandProvider) => void;
  handleModelChange: (model: string) => void;
  handleSelectSession: (session: ModalSessionItem) => Promise<void>;
  handleSelectActiveChat: () => void;
  handleNewSession: () => void;
};

export function SseSessionController({
  provider,
  model,
  serverConfig,
  setProvider,
  setModel,
  switchWorkspaceForSession,
  children,
}: SseSessionControllerProps) {
  const storeSessionId = useSessionManagementStore((state) => state.sessionId);
  const setGlobalSessionId = useSessionManagementStore((state) => state.setSessionId);
  const setGlobalProvider = useSessionManagementStore((state) => state.setProvider);
  const setGlobalModel = useSessionManagementStore((state) => state.setModel);
  const storeProvider = useSessionManagementStore((state) => state.provider);
  const storeModel = useSessionManagementStore((state) => state.model);
  const sessionStatuses = useSessionManagementStore((state) => state.sessionStatuses);
  const setSessionStatuses = useSessionManagementStore((state) => state.setSessionStatuses);

  const [selectedSseSessionRunning, setSelectedSseSessionRunning] = useState(false);

  const {
    connected,
    messages,
    agentRunning,
    waitingForUserInput,
    typingIndicator,
    currentActivity,
    permissionDenials,
    lastSessionTerminated,
    sessionId,
    sessionInitLoading,
    pendingAskQuestion,
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
  } = useSse({
    provider,
    model,
    status: selectedSseSessionRunning,
  });

  useEffect(() => {
    setGlobalProvider(provider);
    setGlobalModel(model);
    setGlobalSessionId(sessionId);
  }, [provider, model, sessionId, setGlobalProvider, setGlobalModel, setGlobalSessionId]);

  const hasRestoredProviderModel = useRef(false);
  useEffect(() => {
    if (hasRestoredProviderModel.current) return;
    hasRestoredProviderModel.current = true;
    sessionStore
      .loadLastUsedProviderModel()
      .then((lastUsed) => {
        if (lastUsed) {
          const validProvider: BrandProvider =
            lastUsed.provider === "claude" || lastUsed.provider === "gemini" || lastUsed.provider === "codex"
              ? lastUsed.provider
              : "codex";
          setProvider(validProvider);
          setModel(lastUsed.model);
        }
      })
      .catch(() => {
        // Ignore restore failures.
      });
  }, [setModel, setProvider]);

  useEffect(() => {
    sessionStore.setLastUsedProviderModel(provider, model);
  }, [provider, model]);

  const tailBoxMaxHeight = useMemo(() => Dimensions.get("window").height * 0.5, []);
  const flatListRef = useRef<FlatList<Message> | null>(null);
  const lastScrollToEndTimeRef = useRef(0);

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  const scrollToEnd = useCallback((animated = true) => {
    flatListRef.current?.scrollToEnd({ animated });
  }, []);

  const onContentSizeChange = useCallback(() => {
    const now = Date.now();
    if (now - lastScrollToEndTimeRef.current < 400) {
      return;
    }
    lastScrollToEndTimeRef.current = now;
    scrollToEnd(true);
  }, [scrollToEnd]);

  const runAfterInteractionScroll = useCallback(() => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    });
  }, []);

  const handleProviderChange = useCallback(
    (nextProvider: BrandProvider) => {
      const newModel = getModelForProvider(nextProvider);
      const isChanging = nextProvider !== provider || newModel !== model;
      if (isChanging) {
        setSelectedSseSessionRunning(false);
        resetSession();
      }
      setProvider(nextProvider);
      setModel(newModel);
      sessionStore.setLastUsedProviderModel(nextProvider, newModel);
      triggerHaptic("selection");
    },
    [model, provider, resetSession, setProvider, setModel]
  );

  const handleModelChange = useCallback(
    (nextModel: string) => {
      if (nextModel === model) {
        return;
      }
      setSelectedSseSessionRunning(false);
      resetSession();
      setModel(nextModel);
      sessionStore.setLastUsedProviderModel(provider, nextModel);
      triggerHaptic("selection");
    },
    [model, provider, resetSession, setModel]
  );

  const handleSelectSession = useCallback(
    async (session: ModalSessionItem) => {
      const selectedProvider =
        typeof session.provider === "string" && session.provider.length > 0 ? session.provider : null;
      const selectedModel =
        typeof session.model === "string" && session.model.length > 0 ? session.model : null;
      const sessionMessages = Array.isArray(session.messages) ? session.messages : [];

      if (session.cwd) {
        await switchWorkspaceForSession?.(session.cwd);
      }

      setSelectedSseSessionRunning(Boolean(session.running || session.sseConnected));

      if (selectedProvider) {
        setProvider(selectedProvider as BrandProvider);
      }
      if (selectedModel) {
        setModel(selectedModel);
      }
      if (selectedProvider && selectedModel) {
        sessionStore.setLastUsedProviderModel(selectedProvider, selectedModel);
      }

      if (session.running || session.sseConnected) {
        resumeLiveSession(session.id, sessionMessages);
      } else {
        setSelectedSseSessionRunning(false);
        loadSession(sessionMessages, session.id);
      }

      runAfterInteractionScroll();
    },
    [
      loadSession,
      resumeLiveSession,
      runAfterInteractionScroll,
      setModel,
      setProvider,
      switchWorkspaceForSession,
    ]
  );

  const handleSelectActiveChat = useCallback(() => {
    switchToLiveSession();
    if (sessionId == null) {
      setSelectedSseSessionRunning(false);
    } else {
      setSelectedSseSessionRunning(true);
    }
    runAfterInteractionScroll();
  }, [runAfterInteractionScroll, sessionId, switchToLiveSession]);

  const handleNewSession = useCallback(() => {
    setSelectedSseSessionRunning(false);
    startNewSession();
  }, [startNewSession]);

  const state: SseSessionControllerState = {
    connected,
    messages,
    agentRunning,
    waitingForUserInput,
    typingIndicator,
    currentActivity,
    permissionDenials,
    lastSessionTerminated,
    sessionId,
    sessionInitLoading,
    pendingAskQuestion,
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
    startNewSession,
    selectedSseSessionRunning,
    setSelectedSseSessionRunning,
    tailBoxMaxHeight,
    flatListRef,
    onContentSizeChange,
    sessionStatuses,
    setSessionStatuses,
    storeProvider,
    storeModel,
    storeSessionId,
    handleProviderChange,
    handleModelChange,
    handleSelectSession,
    handleSelectActiveChat,
    handleNewSession,
  };

  return <>{children(state)}</>;
}
