import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, InteractionManager, type FlatList as RNFlatList } from "react-native";
import { FlatList } from "@/components/ui/flat-list";

import { getModelForProvider, ModalSessionItem } from "@/features/app/appConfig";
import { triggerHaptic } from "@/design-system";
import { useSessionManagementStore, type SessionStatus } from "@/state/sessionManagementStore";
import * as sessionStore from "@/services/sessionStore";
import { useChat, type Message, type PermissionDenial, type PendingAskUserQuestion } from "@/services/chat/hooks";
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
  sessionRunning: boolean;
  waitingForUserInput: boolean;
  permissionDenials: PermissionDenial[] | null;
  lastSessionTerminated: boolean;
  sessionId: string | null;
  pendingAskQuestion: PendingAskUserQuestion | null;
  submitPrompt: ReturnType<typeof useChat>["submitPrompt"];
  submitAskQuestionAnswer: ReturnType<typeof useChat>["submitAskQuestionAnswer"];
  dismissAskQuestion: ReturnType<typeof useChat>["dismissAskQuestion"];
  retryAfterPermission: ReturnType<typeof useChat>["retryAfterPermission"];
  dismissPermission: ReturnType<typeof useChat>["dismissPermission"];
  terminateAgent: ReturnType<typeof useChat>["terminateAgent"];
  resetSession: ReturnType<typeof useChat>["resetSession"];
  loadSession: ReturnType<typeof useChat>["loadSession"];
  startNewSession: ReturnType<typeof useChat>["startNewSession"];
  tailBoxMaxHeight: number;
  flatListRef: React.RefObject<RNFlatList<Message> | null>;
  onContentSizeChange: () => void;
  sessionStatuses: SessionStatus[];
  setSessionStatuses: (sessions: SessionStatus[]) => void;
  storeProvider: BrandProvider | null;
  storeModel: string | null;
  storeSessionId: string | null;
  handleProviderChange: (provider: BrandProvider) => void;
  handleModelChange: (model: string) => void;
  handleSelectSession: (session: ModalSessionItem | null) => Promise<void>;
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
  const [connected, setConnected] = useState(false);
  const [sessionRunning, setSessionRunning] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [waitingForUserInput, setWaitingForUserInput] = useState(false);
  const [permissionDenials, setPermissionDenials] = useState<PermissionDenial[] | null>(null);
  const [lastSessionTerminated, setLastSessionTerminated] = useState(false);
  const [pendingAskQuestion, setPendingAskQuestion] = useState<PendingAskUserQuestion | null>(null);
  const { 
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
  } = useChat({
    provider,
    model,
    onConnectedChange: setConnected,
    onSessionRunningChange: setSessionRunning,
    onMessagesChange: setMessages,
    onWaitingForUserInputChange: setWaitingForUserInput,
    onPermissionDenialsChange: setPermissionDenials,
    onLastSessionTerminatedChange: setLastSessionTerminated,
    onPendingAskQuestionChange: setPendingAskQuestion,
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
  const flatListRef = useRef<RNFlatList<Message> | null>(null);
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
      resetSession();
      setModel(nextModel);
      sessionStore.setLastUsedProviderModel(provider, nextModel);
      triggerHaptic("selection");
    },
    [model, provider, resetSession, setModel]
  );

  const handleSelectSession = useCallback(
    async (session: ModalSessionItem | null) => {
      if (!session || typeof session.id !== "string" || session.id.length === 0) {
        return;
      }
      const selectedProvider =
        typeof session.provider === "string" && session.provider.length > 0 ? session.provider : null;
      const selectedModel =
        typeof session.model === "string" && session.model.length > 0 ? session.model : null;
      const sessionMessages = Array.isArray(session.messages) ? session.messages : [];
      const sessionWorkspace =
        typeof session.cwd === "string" && session.cwd.trim().length > 0 ? session.cwd.trim() : null;

      if (sessionWorkspace) {
        await switchWorkspaceForSession?.(sessionWorkspace);
      }


      if (selectedProvider) {
        setProvider(selectedProvider as BrandProvider);
      }
      if (selectedModel) {
        setModel(selectedModel);
      }
      if (selectedProvider && selectedModel) {
        sessionStore.setLastUsedProviderModel(selectedProvider, selectedModel);
      }

      loadSession(sessionMessages, session.id, session.running || session.sseConnected);

      runAfterInteractionScroll();
    },
    [
      loadSession,
      runAfterInteractionScroll,
      setModel,
      setProvider,
      switchWorkspaceForSession,
    ]
  );

  const handleSelectActiveChat = useCallback(() => {
    runAfterInteractionScroll();
  }, [runAfterInteractionScroll]);

  const handleNewSession = useCallback(() => {
    startNewSession();
  }, [startNewSession]);

  const state: SseSessionControllerState = {
    connected,
    messages,
    sessionRunning,
    waitingForUserInput,
    permissionDenials,
    lastSessionTerminated,
    sessionId,
    pendingAskQuestion,
    submitPrompt,
    submitAskQuestionAnswer,
    dismissAskQuestion,
    retryAfterPermission,
    dismissPermission,
    terminateAgent,
    resetSession,
    loadSession,
    startNewSession,
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
