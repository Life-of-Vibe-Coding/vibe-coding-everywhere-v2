import "./global.css";

/**
 * Main Application Component - Enhanced with Modern Design System
 * 
 * Features:
 * - Comprehensive design system integration
 * - 60fps smooth animations
 * - Haptic feedback throughout
 * - WCAG 2.1 AA accessibility
 * - Dark/light mode support
 * - Performance monitoring
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  View,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  InteractionManager,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import * as ScreenOrientation from "expo-screen-orientation";
// Design System Imports
import {
  ThemeProvider,
  getTheme,
  type Provider as BrandProvider,
} from "./src/theme/index";
import { GluestackUIProvider } from "./components/ui/gluestack-ui-provider";

import {
  triggerHaptic,
  usePerformanceMonitor,
} from "./src/design-system";
import { Box } from "./components/ui/box";
import { AppHeaderBar } from "./components/app/AppHeaderBar";
import { ChatInputDock } from "./components/app/ChatInputDock";
import { ChatMessageList } from "./components/app/ChatMessageList";
import { createAppStyles } from "./components/app/appStyles";
import { FileViewerOverlay } from "./components/app/FileViewerOverlay";
import { SessionModals } from "./components/app/SessionModals";
import { WorkspaceSidebarOverlay } from "./components/app/WorkspaceSidebarOverlay";
import {
  DEFAULT_CLAUDE_MODEL,
  DEFAULT_CODEX_MODEL,
  DEFAULT_GEMINI_MODEL,
  CLAUDE_MODELS,
  GEMINI_MODELS,
  CODEX_MODELS,
  MODEL_OPTIONS_BY_PROVIDER,
} from "./src/constants/modelOptions";

// Service Imports
import { useSocket } from "./src/services/socket/hooks";
import {
  getDefaultServerConfig,
  createWorkspaceFileService,
  type PendingAskUserQuestion,
  type Message,
} from "./src/core";

import type { CodeRefPayload } from "./src/components/file/FileViewerModal";
import type { PermissionModeUI } from "./src/utils/permission";
import * as sessionStore from "./src/services/sessionStore";
import { useSessionManagementStore, type SessionStatus } from "./src/state/sessionManagementStore";
import { notifyAgentFinished, notifyApprovalNeeded } from "./src/services/agentNotifications";
import {
  normalizePathSeparators,
  isAbsolutePath,
  dirname,
  basename,
  toWorkspaceRelativePath,
} from "./src/utils/path";
import { getBackendPermissionMode } from "./src/utils/permission";

// ============================================================================
// Constants
// ============================================================================

/** Theme mode - light only (no dark mode) */
function getThemeModeForProvider(_provider: BrandProvider): "light" | "dark" {
  return "light";
}

type ModalSessionItem = {
  id: string;
  provider?: string | null;
  model?: string | null;
  running?: boolean;
  sseConnected?: boolean;
  messages?: Message[];
  cwd?: string | null;
};

// ============================================================================
// Main App Component
// ============================================================================

export default function App() {
  const insets = useSafeAreaInsets();

  // Theme and Provider State
  const [provider, setProvider] = useState<BrandProvider>("codex");
  const [model, setModel] = useState(DEFAULT_CODEX_MODEL);
  const themeMode = useMemo(() => getThemeModeForProvider(provider), [provider]);
  const theme = useMemo(() => getTheme(provider, themeMode), [provider, themeMode]);
  const styles = useMemo(() => createAppStyles(theme), [theme]);

  // Model picker visibility (lifted from InputPanel to fix overlay stacking)
  const [modelPickerVisible, setModelPickerVisible] = useState(false);

  // Model Management
  const modelOptions =
    provider === "claude" ? CLAUDE_MODELS : provider === "codex" ? CODEX_MODELS : GEMINI_MODELS;

  // Server Configuration
  const serverConfig = useMemo(() => getDefaultServerConfig(), []);
  const workspaceFileService = useMemo(
    () => createWorkspaceFileService(serverConfig),
    [serverConfig]
  );
  // Permission Mode State (default: always allow / yolo)
  const defaultPermissionModeUI: PermissionModeUI =
    typeof process !== "undefined" &&
      (process.env?.EXPO_PUBLIC_DEFAULT_PERMISSION_MODE === "always_ask" ||
        process.env?.EXPO_PUBLIC_DEFAULT_PERMISSION_MODE === "acceptEdits" ||
        process.env?.EXPO_PUBLIC_DEFAULT_PERMISSION_MODE === "acceptPermissions")
      ? "always_ask"
      : "yolo";

  const [permissionModeUI] = useState<PermissionModeUI>(defaultPermissionModeUI);
  const setGlobalSessionId = useSessionManagementStore((state) => state.setSessionId);
  const setGlobalProvider = useSessionManagementStore((state) => state.setProvider);
  const setGlobalModel = useSessionManagementStore((state) => state.setModel);
  const storeSessionId = useSessionManagementStore((state) => state.sessionId);
  const storeProvider = useSessionManagementStore((state) => state.provider);
  const storeModel = useSessionManagementStore((state) => state.model);
  const sessionStatuses = useSessionManagementStore((state) => state.sessionStatuses);
  const setSessionStatuses = useSessionManagementStore((state) => state.setSessionStatuses);
  const [selectedSseSessionId, setSelectedSseSessionId] = useState<string | null>(storeSessionId);
  const [selectedSseSessionRunning, setSelectedSseSessionRunning] = useState(false);

  // UI State
  const [sessionManagementVisible, setSessionManagementVisible] = useState(false);
  const sessionStorePayloadRef = useRef("");
  const sessionStoreUploadedAtRef = useRef(0);
  const [workspacePickerVisible, setWorkspacePickerVisible] = useState(false);
  const [dockerVisible, setDockerVisible] = useState(false);
  const [processesVisible, setProcessesVisible] = useState(false);
  const [skillsConfigVisible, setSkillsConfigVisible] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [sidebarActiveTab, setSidebarActiveTab] = useState<"files" | "changes" | "commits">("files");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Lock to portrait except when browser preview is open (allow landscape for wide-screen view)
  useEffect(() => {
    if (Platform.OS === "web") return;
    const lock = async () => {
      try {
        if (previewUrl != null) {
          await ScreenOrientation.unlockAsync();
        } else {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        }
      } catch {
        // Ignore if lock/unlock fails
      }
    };
    lock();
  }, [previewUrl]);

  // Workspace State
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [workspacePathLoading, setWorkspacePathLoading] = useState(false);

  // File Viewer State
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileIsImage, setFileIsImage] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [pendingCodeRefs, setPendingCodeRefs] = useState<CodeRefPayload[]>([]);

  // Refs
  const flatListRef = useRef<FlatList>(null);
  const lastScrollToEndTimeRef = useRef(0);
  const messagesRef = useRef<Message[]>([]);
  const didOpenInitialPreview = useRef(false);
  /** When switching sessions, store the selected session's provider/model so the persist effect uses them instead of possibly stale state. */
  const lastSwitchedSessionRef = useRef<{ id: string; provider?: string | null; model?: string | null } | null>(null);

  // Socket Hook
  const {
    connected,
    messages,
    agentRunning,
    waitingForUserInput,
    typingIndicator,
    currentActivity,
    sessionId,
    sessionInitLoading,
    permissionDenials,
    submitPrompt,
    pendingAskQuestion,
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
    lastSessionTerminated,
  } = useSocket({
    provider,
    model,
    sessionid: selectedSseSessionId,
    status: selectedSseSessionRunning,
  });

  messagesRef.current = messages;

  useEffect(() => {
    setGlobalProvider(provider);
    setGlobalModel(model);
    setGlobalSessionId(selectedSseSessionId ?? sessionId);
  }, [provider, model, sessionId, selectedSseSessionId, setGlobalProvider, setGlobalModel, setGlobalSessionId]);

  useEffect(() => {
    if (!selectedSseSessionRunning) return;
    if (sessionId != null && sessionId !== selectedSseSessionId) {
      setSelectedSseSessionId(sessionId);
    }
  }, [selectedSseSessionRunning, sessionId, selectedSseSessionId]);

  /** When user switches provider: start new session, update provider+model. */
  const handleProviderChange = useCallback(
    (p: BrandProvider) => {
      const newModel =
        p === "claude" ? DEFAULT_CLAUDE_MODEL : p === "codex" ? DEFAULT_CODEX_MODEL : DEFAULT_GEMINI_MODEL;
      const isChanging = p !== provider || newModel !== model;
      if (isChanging) {
        setSelectedSseSessionId(null);
        setSelectedSseSessionRunning(false);
        resetSession();
      }
      setProvider(p);
      setModel(newModel);
      sessionStore.setLastUsedProviderModel(p, newModel);
      triggerHaptic("selection");
    },
    [provider, model, resetSession]
  );

  /** When user switches model: always init new session, update model. */
  const handleModelChange = useCallback(
    (newModel: string) => {
      if (newModel === model) return;
      setSelectedSseSessionId(null);
      setSelectedSseSessionRunning(false);
      resetSession();
      setModel(newModel);
      sessionStore.setLastUsedProviderModel(provider, newModel);
      triggerHaptic("selection");
    },
    [model, provider, resetSession]
  );

  // Agent notifications: when agent finishes or needs approval
  const prevAgentRunningRef = useRef<boolean>(false);
  const prevApprovalNeededRef = useRef<boolean>(false);

  useEffect(() => {
    if (prevAgentRunningRef.current && !agentRunning) {
      void notifyAgentFinished();
      // Notify server that this session is observed as finished (chat panel showing Idle)
      if (sessionId && !sessionId.startsWith("temp-")) {
        const baseUrl = serverConfig.getBaseUrl();
        fetch(`${baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/finished`, { method: "POST" }).catch(() => {});
      }
    }
    prevAgentRunningRef.current = agentRunning;
  }, [agentRunning, sessionId, serverConfig]);

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

  // Sync selectedSseSessionId from Pi agent session_id when conversation begins (live session only)
  useEffect(() => {
    if (viewingLiveSession && sessionId != null && liveSessionMessages.length > 0) {
      setSelectedSseSessionId(sessionId);
    }
  }, [viewingLiveSession, sessionId, liveSessionMessages.length]);

  // Clean up empty sessions 3 minutes after creation, unless it is the current page
  const EMPTY_SESSION_CLEANUP_MS = 3 * 60 * 1000;
  useEffect(() => {
    const baseUrl = serverConfig.getBaseUrl();
    const currentPageId = viewingLiveSession ? sessionId : selectedSseSessionId;
    const cleanup = async () => {
      const now = Date.now();
      for (const s of sessionStatuses) {
        const isNoInput = s.title === "(no input)";
        const isOld = now - s.lastAccess >= EMPTY_SESSION_CLEANUP_MS;
        const isCurrentPage = s.id === currentPageId;
        if (isNoInput && isOld && !isCurrentPage) {
          try {
            await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(s.id)}`, { method: "DELETE" });
          } catch (_) {
            /* ignore */
          }
        }
      }
    };
    const interval = setInterval(cleanup, 60_000);
    void cleanup();
    return () => clearInterval(interval);
  }, [serverConfig, viewingLiveSession, sessionId, selectedSseSessionId, sessionStatuses]);

  // Load last used provider/model on mount (sessions come from server .pi/agent/sessions) (sessions come from server .pi/agent/sessions)
  const hasRestoredProviderModel = useRef(false);
  useEffect(() => {
    if (hasRestoredProviderModel.current) return;
    hasRestoredProviderModel.current = true;
    sessionStore.loadLastUsedProviderModel().then((lastUsed) => {
      if (lastUsed) {
        const validProvider: BrandProvider =
          lastUsed.provider === "claude" || lastUsed.provider === "gemini" || lastUsed.provider === "codex"
            ? lastUsed.provider
            : "codex";
        setProvider(validProvider);
        setModel(lastUsed.model);
      }
    }).catch(() => { });
  }, []);

  // Keep session statuses fresh in the background for shared session management.
  useEffect(() => {
    const baseUrl = serverConfig.getBaseUrl();
    const poll = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/sessions/status`);
        if (!res.ok) return;
        const data = (await res.json()) as { sessions?: SessionStatus[] };
        if (Array.isArray(data?.sessions)) {
          setSessionStatuses(data.sessions);
        }
      } catch {
        // Keep previous data on failure.
      }
    };
    void poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [serverConfig, setSessionStatuses]);

  // Persist provider/model preference when they change (sessions come from server .pi/agent/sessions)
  useEffect(() => {
    sessionStore.setLastUsedProviderModel(provider, model);
  }, [provider, model]);

  // Performance Monitoring
  const performanceMetrics = usePerformanceMonitor(__DEV__);

  // Effects
  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  useEffect(() => {
    if (!selectedFilePath) return;
    setFileLoading(true);
    setFileError(null);
    setFileContent(null);
    setFileIsImage(false);

    if (selectedFilePath.startsWith("__diff__:staged:") || selectedFilePath.startsWith("__diff__:unstaged:")) {
      const isStaged = selectedFilePath.startsWith("__diff__:staged:");
      const file = selectedFilePath.substring(`__diff__:${isStaged ? 'staged' : 'unstaged'}:`.length);
      fetch(`${serverConfig.getBaseUrl()}/api/git/diff?staged=${isStaged}&file=${encodeURIComponent(file)}`)
        .then(res => res.json())
        .then(data => {
          if (data.error) throw new Error(data.error);
          setFileContent(data.diff || "(No differences)");
          setFileLoading(false);
        })
        .catch((err) => {
          setFileError(err?.message ?? "Failed to load diff");
          setFileLoading(false);
        });
      return;
    }

    workspaceFileService
      .fetchFile(selectedFilePath)
      .then(({ content, isImage }) => {
        setFileContent(content);
        setFileIsImage(isImage);
        setFileLoading(false);
      })
      .catch((err) => {
        setFileError(err?.message ?? "Failed to load file");
        setFileLoading(false);
      });
  }, [selectedFilePath, workspaceFileService, serverConfig]);

  // Callbacks
  const handleFileSelect = useCallback((path: string) => {
    triggerHaptic("selection");
    setSelectedFilePath(path);
  }, []);

  /** When user taps a file in chat, open explorer and ensure file path is readable by workspace API. */
  const handleFileSelectFromChat = useCallback((path: string) => {
    triggerHaptic("selection");
    setSidebarVisible(true);
    void (async () => {
      const raw = typeof path === "string" ? path.trim() : "";
      if (!raw) return;
      const normalized = normalizePathSeparators(raw);

      // Relative path: directly open in current workspace.
      if (!isAbsolutePath(normalized)) {
        setSelectedFilePath(normalized.replace(/^\/+/, ""));
        return;
      }

      try {
        const baseUrl = serverConfig.getBaseUrl();
        const wsRes = await fetch(`${baseUrl}/api/workspace-path`);
        const wsData = (await wsRes.json()) as { path?: string };
        if (typeof wsData?.path === "string") {
          setWorkspacePath(wsData.path);
          const rel = toWorkspaceRelativePath(normalized, wsData.path);
          if (rel != null) {
            setSelectedFilePath(rel || basename(normalized));
            return;
          }
        }

        // Absolute path outside current workspace: switch workspace to file directory first.
        const targetWorkspace = dirname(normalized);
        const switchRes = await fetch(`${baseUrl}/api/workspace-path`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: targetWorkspace }),
        });
        if (switchRes.ok) {
          const switched = (await switchRes.json()) as { path?: string };
          if (typeof switched?.path === "string") setWorkspacePath(switched.path);
          setSelectedFilePath(basename(normalized));
          return;
        }
      } catch {
        // Fall back below.
      }

      // Last fallback: keep original path (may still fail if server rejects it).
      setSelectedFilePath(normalized);
    })();
  }, [serverConfig]);

  const handleCloseFileViewer = useCallback(() => {
    setSelectedFilePath(null);
    setFileContent(null);
    setFileIsImage(false);
    setFileError(null);
  }, []);

  const handleAddCodeReference = useCallback((ref: CodeRefPayload) => {
    triggerHaptic("light");
    setPendingCodeRefs((prev) => [...prev, ref]);
  }, []);

  const handleRemoveCodeRef = useCallback((index: number) => {
    triggerHaptic("selection");
    setPendingCodeRefs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(
    (prompt: string) => {
      switchToLiveSession();
      setSelectedSseSessionRunning(true);
      if (selectedSseSessionId == null && sessionId != null) {
        setSelectedSseSessionId(sessionId);
      }
        const backend = getBackendPermissionMode(permissionModeUI, provider);
        const codexOptions =
          provider === "codex"
            ? {
              askForApproval: backend.askForApproval,
              fullAuto: backend.fullAuto,
              yolo: backend.yolo,
            }
            : undefined;

      const doSubmit = () => {
        submitPrompt(
          prompt,
          backend.permissionMode,
          undefined,
          pendingCodeRefs.length ? pendingCodeRefs : undefined,
          backend.approvalMode,
          codexOptions
        );
        if (pendingCodeRefs.length) setPendingCodeRefs([]);
        setSidebarVisible(false);
        handleCloseFileViewer();
      };

      doSubmit();
    },
    [
      selectedSseSessionId,
      sessionId,
      submitPrompt,
      permissionModeUI,
      provider,
      pendingCodeRefs,
      handleCloseFileViewer,
      switchToLiveSession,
    ]
  );

  const handleOpenPreviewInApp = useCallback((u: string) => {
    if (u) setPreviewUrl(u);
  }, []);

  const handleAskQuestionSubmit = useCallback(
    (answers: Array<{ header: string; selected: string[] }>) => {
      submitAskQuestionAnswer(answers);
    },
    [submitAskQuestionAnswer]
  );

  const handleAskQuestionCancel = useCallback(() => {
    dismissAskQuestion();
  }, [dismissAskQuestion]);

  const handleClosePreview = useCallback(() => {
    setPreviewUrl(null);
  }, []);

  const handleCommitByAI = useCallback(
    (userRequest: string) => {
      setSelectedSseSessionRunning(false);
      setSelectedSseSessionId(null);
      resetSession();
      handleSubmit(userRequest);
      setSidebarVisible(false);
    },
    [handleSubmit, resetSession]
  );

  const fetchWorkspacePath = useCallback(() => {
    setWorkspacePathLoading(true);
    fetch(`${serverConfig.getBaseUrl()}/api/workspace-path`)
      .then((res) => res.json())
      .then((data) => setWorkspacePath(data?.path ?? null))
      .catch(() => setWorkspacePath(null))
      .finally(() => setWorkspacePathLoading(false));
  }, [serverConfig]);

  // Fetch workspace on mount for header display; also refetch when session management opens
  useEffect(() => {
    fetchWorkspacePath();
  }, [fetchWorkspacePath]);
  useEffect(() => {
    if (sessionManagementVisible) fetchWorkspacePath();
  }, [sessionManagementVisible, fetchWorkspacePath]);

  // FlatList performance: compute once to avoid per-item Dimensions.get
  const tailBoxMaxHeight = useMemo(() => Dimensions.get("window").height * 0.5, []);

  const handleRetryPermission = useCallback(() => {
    const backend = getBackendPermissionMode(permissionModeUI, provider);
    const lastUserMsg = [...messagesRef.current].reverse().find((m) => m.role === "user");
    retryAfterPermission(backend.permissionMode, backend.approvalMode, lastUserMsg?.content);
  }, [permissionModeUI, provider, retryAfterPermission]);

  const handleChatContentSizeChange = useCallback(() => {
    const now = Date.now();
    if (now - lastScrollToEndTimeRef.current < 400) return;
    lastScrollToEndTimeRef.current = now;
    flatListRef.current?.scrollToEnd({ animated: true });
  }, []);

  const handleSelectSession = useCallback(
    async (session: ModalSessionItem) => {
      const selectedProvider = typeof session.provider === "string" && session.provider.length > 0 ? session.provider : null;
      const selectedModel = typeof session.model === "string" && session.model.length > 0 ? session.model : null;
      const sessionMessages = Array.isArray(session.messages) ? session.messages : [];
      // Switch workspace to session's cwd when different from current.
      const sessionCwd = session.cwd ?? null;
      if (sessionCwd && sessionCwd !== workspacePath) {
        try {
          const res = await fetch(`${serverConfig.getBaseUrl()}/api/workspace-path`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: sessionCwd }),
          });
          if (res.ok) {
            const data = (await res.json()) as { path?: string };
            if (typeof data?.path === "string") setWorkspacePath(data.path);
          }
        } catch {
          // Proceed with load even if switch fails; session may still be viewable.
        }
      }

      lastSwitchedSessionRef.current = {
        id: session.id,
        provider: selectedProvider,
        model: selectedModel,
      };
      setSelectedSseSessionId(session.id);
      setSelectedSseSessionRunning(Boolean(session.running || session.sseConnected));
      if (selectedProvider) setProvider(selectedProvider as BrandProvider);
      if (selectedModel) setModel(selectedModel);
      if (selectedProvider && selectedModel) {
        sessionStore.setLastUsedProviderModel(selectedProvider, selectedModel);
      }
      // Conversation was already loaded from disk (GET /api/sessions/:id/messages).
      // Connect SSE only when session is running; otherwise show persisted messages only (no SSE).
      if (session.running || session.sseConnected) {
        resumeLiveSession(session.id, sessionMessages);
      } else {
        setSelectedSseSessionRunning(false);
        loadSession(sessionMessages, session.id);
      }
      InteractionManager.runAfterInteractions(() => {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }, 100);
      });
    },
    [resumeLiveSession, loadSession, serverConfig, workspacePath]
  );

  const handleSelectActiveChat = useCallback(() => {
    switchToLiveSession();
    if (sessionId == null) {
      setSelectedSseSessionRunning(false);
      setSelectedSseSessionId(null);
    } else {
      setSelectedSseSessionRunning(true);
      setSelectedSseSessionId(sessionId);
    }
    setSessionManagementVisible(false);
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    });
  }, [sessionId, switchToLiveSession]);

  useEffect(() => {
    const snapshot = {
      provider: storeProvider,
      model: storeModel,
      currentSessionId: selectedSseSessionId,
      sessionId: storeSessionId,
      count: sessionStatuses.length,
      sessions: sessionStatuses,
      path: workspacePath,
      connected,
      sseConnected: connected,
      sessionManagement: {
        visible: sessionManagementVisible,
        currentProvider: provider,
        currentModel: model,
        activeSessionId: viewingLiveSession ? sessionId : selectedSseSessionId,
      },
    };
    const signature = JSON.stringify(snapshot);
    const now = Date.now();
    const shouldUpload =
      sessionStorePayloadRef.current !== signature ||
      now - sessionStoreUploadedAtRef.current >= 30000;
    if (shouldUpload) {
      sessionStorePayloadRef.current = signature;
      sessionStoreUploadedAtRef.current = now;
      console.log("[session-management] store snapshot:", snapshot);
      const endpoint = `${serverConfig.getBaseUrl()}/api/session-management-store`;
      console.log("[session-management] uploading snapshot to:", endpoint);
      void fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      })
        .then(async (res) => {
          if (!res.ok) {
            const text = await res.text();
            console.error(
              "[session-management] failed to upload snapshot:",
              res.status,
              text
            );
          }
        })
        .catch((error) => {
          console.error(
            "[session-management] failed to upload snapshot:",
            String(error),
            "to",
            endpoint
          );
        });
    }
  }, [
    sessionStatuses,
    selectedSseSessionId,
    storeModel,
    storeProvider,
    storeSessionId,
    selectedSseSessionId,
    connected,
    provider,
    model,
    workspacePath,
    sessionManagementVisible,
    viewingLiveSession,
    sessionId,
    serverConfig,
  ]);

  // ============================================================================
  // Render
  // ============================================================================
  return (
    <ThemeProvider provider={provider} colorMode={themeMode}>
      <GluestackUIProvider mode={themeMode}>
      <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
        <ExpoStatusBar style={theme.mode === "dark" ? "light" : "dark"} />
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
            <Box style={[styles.page, { paddingTop: insets.top }]}>
              {/* Provider-themed subtle gradient tint at top */}
              <Box style={styles.providerTintOverlay} pointerEvents="none" />
              {/* Group 1: Main content + overlays (flex: 1) */}
              <Box style={styles.topSection}>
                {/* Main Content Area */}
                <Box style={styles.contentArea}>
                  {/* Header: Menu (left) | Session ID (center) | Settings (right) */}
                  <AppHeaderBar
                    visible={!sidebarVisible}
                    theme={theme}
                    styles={{
                      menuButtonOverlay: styles.menuButtonOverlay,
                      sessionIdCenter: styles.sessionIdCenter,
                      headerStatusStack: styles.headerStatusStack,
                      headerStatusRow: styles.headerStatusRow,
                      runningDot: styles.runningDot,
                    }}
                    workspaceName={workspacePath ? basename(workspacePath) : "—"}
                    typingIndicator={typingIndicator}
                    agentRunning={agentRunning}
                    waitingForUserInput={waitingForUserInput}
                    sessionIdLabel={
                      ((viewingLiveSession ? sessionId : selectedSseSessionId) ?? "").split("-")[0] ||
                      "—"
                    }
                    onOpenExplorer={() => setSidebarVisible(true)}
                    onOpenSessionManagement={() => setSessionManagementVisible(true)}
                  />

                  {/* Chat Area */}
                  <Box style={styles.chatShell}>
                    <ChatMessageList
                      messages={messages}
                      provider={provider}
                      typingIndicator={typingIndicator}
                      currentActivity={currentActivity}
                      permissionDenials={permissionDenials ?? []}
                      lastSessionTerminated={lastSessionTerminated}
                      onOpenUrl={handleOpenPreviewInApp}
                      onFileSelect={handleFileSelectFromChat}
                      onRetryPermission={handleRetryPermission}
                      onDismissPermission={dismissPermission}
                      tailBoxMaxHeight={tailBoxMaxHeight}
                      flatListRef={flatListRef}
                      onContentSizeChange={handleChatContentSizeChange}
                      style={styles.chatArea}
                      contentContainerStyle={styles.chatMessages}
                    />
                  </Box>

                  <FileViewerOverlay
                    visible={selectedFilePath != null}
                    style={styles.fileViewerOverlay}
                    path={selectedFilePath ?? ""}
                    content={fileContent}
                    isImage={fileIsImage}
                    loading={fileLoading}
                    error={fileError}
                    onClose={handleCloseFileViewer}
                    onAddCodeReference={handleAddCodeReference}
                  />

                  {/* Sidebar overlay - fills topSection, never overlaps InputPanel */}
                  <WorkspaceSidebarOverlay
                    visible={sidebarVisible}
                    style={styles.sidebarOverlay}
                    pointerEvents={sidebarVisible ? "auto" : "none"}
                    onClose={() => setSidebarVisible(false)}
                    onFileSelect={handleFileSelect}
                    onCommitByAI={handleCommitByAI}
                    onActiveTabChange={setSidebarActiveTab}
                    sidebarActiveTab={sidebarActiveTab}
                  />
                </Box>
              </Box>
                {/* Group 2: Input Panel - only show at file explorer, not during staging/commit */}
                {(!sidebarVisible || sidebarActiveTab === "files") && (
                  <View style={styles.inputBar}>
                    <ChatInputDock
                      connected={connected}
                      agentRunning={agentRunning}
                      waitingForUserInput={waitingForUserInput}
                      permissionModeUI={permissionModeUI}
                      onSubmit={handleSubmit}
                      pendingCodeRefs={pendingCodeRefs}
                      onRemoveCodeRef={handleRemoveCodeRef}
                      onTerminateAgent={terminateAgent}
                      onOpenProcesses={() => setProcessesVisible(true)}
                      onOpenWebPreview={() => setPreviewUrl("")}
                      provider={provider}
                      model={model}
                      modelOptions={modelOptions}
                      providerModelOptions={MODEL_OPTIONS_BY_PROVIDER}
                      onProviderChange={handleProviderChange}
                      onModelChange={handleModelChange}
                      onOpenModelPicker={() => setModelPickerVisible(true)}
                      onOpenSkillsConfig={() => setSkillsConfigVisible(true)}
                      onOpenDocker={() => setDockerVisible(true)}
                    />
                  </View>
                )}
              </Box>

              <SessionModals
                pendingAskQuestion={pendingAskQuestion}
                onSubmitAskQuestion={handleAskQuestionSubmit}
                onCancelAskQuestion={handleAskQuestionCancel}
                skillsConfigVisible={skillsConfigVisible}
                onCloseSkillsConfig={() => setSkillsConfigVisible(false)}
                selectedSkillId={selectedSkillId}
                onSelectSkill={(id) => setSelectedSkillId(id)}
                onCloseSkillDetail={() => setSelectedSkillId(null)}
                serverBaseUrl={serverConfig.getBaseUrl()}
                workspacePickerVisible={workspacePickerVisible}
                onCloseWorkspacePicker={() => setWorkspacePickerVisible(false)}
                workspacePath={workspacePath}
                onRefreshWorkspace={fetchWorkspacePath}
                onWorkspaceSelected={() => {
                  setSelectedSseSessionId(null);
                  setSelectedSseSessionRunning(false);
                  resetSession();
                }}
                dockerVisible={dockerVisible}
                onCloseDocker={() => setDockerVisible(false)}
                modelPickerVisible={modelPickerVisible}
                onCloseModelPicker={() => setModelPickerVisible(false)}
                provider={provider}
                model={model}
                themeMode={themeMode}
                surfaceColor={theme.colors.surface}
                providerModelOptions={MODEL_OPTIONS_BY_PROVIDER}
                onModelProviderChange={handleProviderChange}
                onModelChange={(nextModel) => {
                  handleModelChange(nextModel);
                  setModelPickerVisible(false);
                }}
                processesVisible={processesVisible}
                onCloseProcesses={() => setProcessesVisible(false)}
                sessionManagementVisible={sessionManagementVisible}
                onCloseSessionManagement={() => setSessionManagementVisible(false)}
                currentMessages={messages}
                currentSessionId={selectedSseSessionId}
                workspacePathForSessionManagement={workspacePath}
                sessionProvider={provider}
                sessionModel={model}
                workspaceLoading={workspacePathLoading}
                onRefreshSessionManagementWorkspace={fetchWorkspacePath}
                onOpenWorkspacePicker={() => {
                  setSessionManagementVisible(false);
                  setWorkspacePickerVisible(true);
                }}
                onSelectSession={handleSelectSession}
                onNewSession={() => {
                  setSelectedSseSessionId(null);
                  setSelectedSseSessionRunning(false);
                  startNewSession();
                }}
                showActiveChat={false}
                sessionRunning={agentRunning || typingIndicator}
                onSelectActiveChat={handleSelectActiveChat}
                previewVisible={previewUrl != null}
                previewUrl={previewUrl ?? ""}
                onClosePreview={handleClosePreview}
                resolvePreviewUrl={serverConfig.resolvePreviewUrl}
              />
        </KeyboardAvoidingView>
      </SafeAreaView>
      </GluestackUIProvider>
    </ThemeProvider>
  );
}
