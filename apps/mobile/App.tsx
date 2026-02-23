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
  StyleSheet,
  View,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  StatusBar,
  InteractionManager,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import * as ScreenOrientation from "expo-screen-orientation";
// Design System Imports
import {
  ThemeProvider,
  getTheme,
  useTheme,
  type Provider as BrandProvider,
} from "./src/theme/index";
import { GluestackUIProvider } from "./components/ui/gluestack-ui-provider";
import { HStack } from "./components/ui/hstack";
import { VStack } from "./components/ui/vstack";

import {
  AnimatedPressableView,
  triggerHaptic,
  EntranceAnimation,
  FlashAnimation,
  usePerformanceMonitor,
  spacing,
} from "./src/design-system";
import { Box } from "./components/ui/box";
import { Text as GluestackText } from "./components/ui/text";
import { cn } from "./src/utils/cn";

// Service Imports
import { useSocket } from "./src/services/socket/hooks";
import {
  getDefaultServerConfig,
  createWorkspaceFileService,
  type PendingAskUserQuestion,
  type Message,
} from "./src/core";

// Component Imports
import { MessageBubble, hasFileActivityContent, hasCodeBlockContent } from "./src/components/chat/MessageBubble";
import { TypingIndicator } from "./src/components/chat/TypingIndicator";
import { PermissionDenialBanner } from "./src/components/common/PermissionDenialBanner";
import { AskQuestionModal } from "./src/components/chat/AskQuestionModal";
import { InputPanel } from "./src/components/chat/InputPanel";
import { PreviewWebViewModal } from "./src/components/preview/PreviewWebViewModal";
import { WorkspaceSidebar } from "./src/components/file/WorkspaceSidebar";
import { FileViewerModal, type CodeRefPayload } from "./src/components/file/FileViewerModal";
import type { PermissionModeUI } from "./src/utils/permission";
import { WorkspacePickerModal } from "./src/components/settings/WorkspacePickerModal";
import { SkillConfigurationModal } from "./src/components/settings/SkillConfigurationModal";
import { DockerManagerModal } from "./src/components/docker/DockerManagerModal";
import { ProcessesDashboardModal } from "./src/components/processes/ProcessesDashboardModal";
import { SkillDetailSheet } from "./src/components/settings/SkillDetailSheet";
import { SessionManagementModal } from "./src/components/chat/SessionManagementModal";
import { MenuIcon, SettingsIcon } from "./src/components/icons/HeaderIcons";
import { ClaudeIcon, GeminiIcon, CodexIcon } from "./src/components/icons/ProviderIcons";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
  ActionsheetScrollView,
} from "./components/ui/actionsheet";
import * as sessionStore from "./src/services/sessionStore";
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

const CLAUDE_MODELS: { value: string; label: string }[] = [
  { value: "sonnet4.5", label: "Sonnet 4.5" },
  { value: "opus4.5", label: "Opus 4.5" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
];

const GEMINI_MODELS: { value: string; label: string }[] = [
  { value: "gemini-2.5-flash", label: "2.5 Flash" },
  { value: "gemini-2.5-pro", label: "2.5 Pro" },
];

const PI_MODELS: { value: string; label: string }[] = [
  { value: "gpt-5.1-codex-mini", label: "GPT-5.1 Codex Mini" },
  { value: "gpt-5.2-codex", label: "GPT-5.2 Codex" },
];

const DEFAULT_CLAUDE_MODEL = "sonnet4.5";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_PI_MODEL = "gpt-5.1-codex-mini";

/** Theme mode - light only (no dark mode) */
function getThemeModeForProvider(_provider: BrandProvider): "light" | "dark" {
  return "light";
}

// ============================================================================
// Enhanced Header Button Component
// ============================================================================

interface HeaderButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  delay?: number;
}

function HeaderButton({ icon, onPress, accessibilityLabel, delay = 0 }: HeaderButtonProps) {
  return (
    <EntranceAnimation variant="scale" delay={delay}>
      <AnimatedPressableView
        onPress={() => {
          triggerHaptic("light");
          onPress();
        }}
        haptic={undefined}
        scaleTo={0.92}
        style={{
          width: 40,
          height: 40,
          justifyContent: "center",
          alignItems: "center",
        }}
        accessibilityLabel={accessibilityLabel}
      >
        {icon}
      </AnimatedPressableView>
    </EntranceAnimation>
  );
}

// ============================================================================
// Main App Component
// ============================================================================

export default function App() {
  const insets = useSafeAreaInsets();

  // Theme and Provider State
  const [provider, setProvider] = useState<BrandProvider>("pi");
  const [model, setModel] = useState(DEFAULT_PI_MODEL);
  const themeMode = useMemo(() => getThemeModeForProvider(provider), [provider]);
  const theme = useMemo(() => getTheme(provider, themeMode), [provider, themeMode]);
  const styles = useMemo(() => createAppStyles(theme), [theme]);

  // Model picker visibility (lifted from InputPanel to fix overlay stacking)
  const [modelPickerVisible, setModelPickerVisible] = useState(false);

  // Model Management
  const modelOptions =
    provider === "claude" ? CLAUDE_MODELS : provider === "pi" || provider === "codex" ? PI_MODELS : GEMINI_MODELS;

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

  const [permissionModeUI, setPermissionModeUI] = useState<PermissionModeUI>(defaultPermissionModeUI);

  // UI State
  const [sessionManagementVisible, setSessionManagementVisible] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
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
  } = useSocket({ provider, model });

  messagesRef.current = messages;

  /** When user switches provider: start new session, update provider+model. */
  const handleProviderChange = useCallback(
    (p: BrandProvider) => {
      const newModel =
        p === "claude" ? DEFAULT_CLAUDE_MODEL : p === "pi" || p === "codex" ? DEFAULT_PI_MODEL : DEFAULT_GEMINI_MODEL;
      const isChanging = p !== provider || newModel !== model;
      if (isChanging) {
        setCurrentSessionId(null);
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
      setCurrentSessionId(null);
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

  // Sync currentSessionId from Pi agent session_id when conversation begins (live session only)
  useEffect(() => {
    if (viewingLiveSession && sessionId != null && liveSessionMessages.length > 0) {
      setCurrentSessionId(sessionId);
    }
  }, [viewingLiveSession, sessionId, liveSessionMessages.length]);

  // Clean up empty sessions 3 minutes after creation, unless it is the current page
  const EMPTY_SESSION_CLEANUP_MS = 3 * 60 * 1000;
  useEffect(() => {
    const baseUrl = serverConfig.getBaseUrl();
    const currentPageId = viewingLiveSession ? sessionId : currentSessionId;
    const cleanup = async () => {
      try {
        const res = await fetch(`${baseUrl}/api/sessions`);
        const data = (await res.json()) as { sessions?: Array<{ id: string; firstUserInput: string; mtime: number }> };
        const list = data.sessions ?? [];
        const now = Date.now();
        for (const s of list) {
          const isNoInput = s.firstUserInput === "(no input)";
          const isOld = now - s.mtime >= EMPTY_SESSION_CLEANUP_MS;
          const isCurrentPage = s.id === currentPageId;
          if (isNoInput && isOld && !isCurrentPage) {
            try {
              await fetch(`${baseUrl}/api/sessions/${encodeURIComponent(s.id)}`, { method: "DELETE" });
            } catch (_) {
              /* ignore */
            }
          }
        }
      } catch (_) {
        /* ignore */
      }
    };
    const interval = setInterval(cleanup, 60_000);
    void cleanup();
    return () => clearInterval(interval);
  }, [serverConfig, viewingLiveSession, sessionId, currentSessionId]);

  // Load last used provider/model on mount (sessions come from server .pi/agent/sessions) (sessions come from server .pi/agent/sessions)
  const hasRestoredProviderModel = useRef(false);
  useEffect(() => {
    if (hasRestoredProviderModel.current) return;
    hasRestoredProviderModel.current = true;
    sessionStore.loadLastUsedProviderModel().then((lastUsed) => {
      if (lastUsed) {
        const validProvider: BrandProvider =
          lastUsed.provider === "claude" || lastUsed.provider === "gemini" || lastUsed.provider === "pi" || lastUsed.provider === "codex"
            ? lastUsed.provider
            : "pi";
        setProvider(validProvider);
        setModel(lastUsed.model);
      }
    }).catch(() => { });
  }, []);

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
      const backend = getBackendPermissionMode(permissionModeUI, provider);
      const codexOptions =
        provider === "pi" || provider === "codex"
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
    [submitPrompt, permissionModeUI, provider, pendingCodeRefs, handleCloseFileViewer, switchToLiveSession]
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

  // Always show full conversation (user input + previous turns), including while streaming.
  const displayMessages = messages;

  const flatListExtraData = useMemo(
    () => `${lastSessionTerminated}-${displayMessages.length}`,
    [lastSessionTerminated, displayMessages.length]
  );

  const renderMessageItem = useCallback(
    ({ item, index }: { item: (typeof messages)[number]; index: number }) => {
      const isLast = index === displayMessages.length - 1;
      const showTerminated =
        lastSessionTerminated && isLast && item.role === "assistant" && !item.content;
      const messageToShow = showTerminated ? { ...item, content: "Terminated" } : item;
      const hasCodeOrFileContent =
        hasFileActivityContent(item.content) || hasCodeBlockContent(item.content);
      const showTailBox =
        isLast &&
        item.role === "assistant" &&
        !!(item.content && item.content.trim()) &&
        hasCodeOrFileContent;
      return (
        <MessageBubble
          message={messageToShow}
          isTerminatedLabel={showTerminated}
          showAsTailBox={showTailBox}
          tailBoxMaxHeight={tailBoxMaxHeight}
          provider={provider}
          onOpenUrl={handleOpenPreviewInApp}
          onFileSelect={handleFileSelectFromChat}
          isStreaming={typingIndicator && isLast && item.role === "assistant"}
        />
      );
    },
    [
      displayMessages.length,
      lastSessionTerminated,
      typingIndicator,
      provider,
      handleOpenPreviewInApp,
      handleFileSelectFromChat,
      tailBoxMaxHeight,
    ]
  );

  const chatListFooter = useMemo(
    () => (
      <>
        {typingIndicator && (
          <EntranceAnimation variant="fade" duration={200}>
            <TypingIndicator visible provider={provider} activity={currentActivity} />
          </EntranceAnimation>
        )}
        {permissionDenials && permissionDenials.length > 0 && (
          <PermissionDenialBanner
            denials={permissionDenials}
            onDismiss={dismissPermission}
            onAccept={() => {
              const backend = getBackendPermissionMode(permissionModeUI, provider);
              const lastUserMsg = [...messagesRef.current].reverse().find((m) => m.role === "user");
              retryAfterPermission(backend.permissionMode, backend.approvalMode, lastUserMsg?.content);
            }}
          />
        )}
      </>
    ),
    [
      typingIndicator,
      provider,
      currentActivity,
      permissionDenials,
      dismissPermission,
      permissionModeUI,
      retryAfterPermission,
    ]
  );

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
                {!sidebarVisible && (
                  <HStack style={styles.menuButtonOverlay} pointerEvents="box-none">
                    <HeaderButton
                      icon={<MenuIcon color={theme.colors.textPrimary} />}
                      onPress={() => setSidebarVisible(true)}
                      accessibilityLabel="Open Explorer"
                      delay={100}
                    />
                    <Box style={[styles.sessionIdCenter, { flexShrink: 1 }]} className="min-w-0 flex-1">
                      <VStack style={styles.headerStatusStack} className="gap-0.5 items-center">
                        <GluestackText
                          size="xs"
                          numberOfLines={2}
                          style={{ color: theme.colors.accent }}
                          className="font-medium text-center"
                        >
                          {workspacePath ? basename(workspacePath) : "—"}
                        </GluestackText>
                        {typingIndicator ? (
                          <FlashAnimation style={styles.headerStatusRow} duration={600}>
                            <HStack style={styles.headerStatusRow} className="items-center gap-1.5">
                              <Box
                                style={[
                                  styles.runningDot,
                                  { backgroundColor: theme.colors.success },
                                ]}
                              />
                              <GluestackText size="xs" style={{ color: theme.colors.success }} className="font-medium">
                                Running
                              </GluestackText>
                            </HStack>
                          </FlashAnimation>
                        ) : (
                          <GluestackText
                            size="xs"
                            numberOfLines={1}
                            ellipsizeMode="middle"
                            style={{
                              color: agentRunning && waitingForUserInput
                                ? theme.colors.warning
                                : theme.colors.textMuted,
                            }}
                            className="font-medium"
                          >
                            {agentRunning && waitingForUserInput ? "Wait" : "Idle"}
                            {": "}
                            {((viewingLiveSession ? sessionId : currentSessionId) ?? "")
                              .split("-")[0] || "—"}
                          </GluestackText>
                        )}
                      </VStack>
                    </Box>
                    <HeaderButton
                      icon={<SettingsIcon color={theme.colors.textPrimary} />}
                      onPress={() => setSessionManagementVisible(true)}
                      accessibilityLabel="Manage sessions"
                      delay={200}
                    />
                  </HStack>
                )}

                {/* Chat Area */}
                <Box style={styles.chatShell}>
                  <FlatList
                    key="chat"
                    ref={flatListRef}
                    style={styles.chatArea}
                    contentContainerStyle={styles.chatMessages}
                    showsVerticalScrollIndicator={false}
                    showsHorizontalScrollIndicator={false}
                    keyboardDismissMode="on-drag"
                    keyboardShouldPersistTaps="handled"
                    data={displayMessages}
                    extraData={flatListExtraData}
                    keyExtractor={(item) => item.id}
                    renderItem={renderMessageItem}
                    initialNumToRender={15}
                    maxToRenderPerBatch={10}
                    windowSize={10}
                    removeClippedSubviews={Platform.OS === "android"}
                    ListFooterComponent={chatListFooter}
                    onContentSizeChange={() => {
                      const now = Date.now();
                      if (now - lastScrollToEndTimeRef.current < 400) return;
                      lastScrollToEndTimeRef.current = now;
                      flatListRef.current?.scrollToEnd({ animated: true });
                    }}
                  />
                </Box>

                {selectedFilePath != null && (
                  <Box style={styles.fileViewerOverlay} pointerEvents="box-none">
                    <FileViewerModal
                      visible
                      embedded
                      path={selectedFilePath}
                      content={fileContent}
                      isImage={fileIsImage}
                      loading={fileLoading}
                      error={fileError}
                      onClose={handleCloseFileViewer}
                      onAddCodeReference={handleAddCodeReference}
                    />
                  </Box>
                )}

                {/* Sidebar overlay - fills topSection, never overlaps InputPanel */}
                <Box style={styles.sidebarOverlay} pointerEvents={sidebarVisible ? "auto" : "none"}>
                  <WorkspaceSidebar
                    visible={sidebarVisible}
                    embedded
                    onClose={() => setSidebarVisible(false)}
                    onFileSelect={handleFileSelect}
                    onCommitByAI={handleCommitByAI}
                    onActiveTabChange={setSidebarActiveTab}
                  />
                </Box>
              </Box>
            </Box>

            {/* Group 2: Input Panel - only show at file explorer, not during staging/commit */}
            {(!sidebarVisible || sidebarActiveTab === "files") && (
            <View style={styles.inputBar}>
              <InputPanel
                connected={connected}
                agentRunning={agentRunning}
                waitingForUserInput={waitingForUserInput}
                permissionMode={(() => {
                  const b = getBackendPermissionMode(permissionModeUI, provider);
                  return b.permissionMode ?? b.approvalMode ?? null;
                })()}
                onPermissionModeChange={() => { }}
                onSubmit={handleSubmit}
                pendingCodeRefs={pendingCodeRefs}
                onRemoveCodeRef={handleRemoveCodeRef}
                onTerminateAgent={terminateAgent}
                onOpenProcesses={() => setProcessesVisible(true)}
                onOpenWebPreview={() => setPreviewUrl("")}
                provider={provider}
                model={model}
                modelOptions={modelOptions}
                providerModelOptions={{
                  claude: CLAUDE_MODELS,
                  gemini: GEMINI_MODELS,
                  codex: PI_MODELS,
                }}
                onProviderChange={handleProviderChange}
                onModelChange={handleModelChange}
                onOpenModelPicker={() => setModelPickerVisible(true)}
                onOpenSkillsConfig={() => setSkillsConfigVisible(true)}
                onOpenDocker={() => setDockerVisible(true)}
              />
            </View>
            )}
          </Box>

          {/* Ask Question Modal */}
          <AskQuestionModal
            pending={pendingAskQuestion}
            onSubmit={handleAskQuestionSubmit}
            onCancel={handleAskQuestionCancel}
          />

          {/* Skill Configuration Modal */}
          <SkillConfigurationModal
            visible={skillsConfigVisible}
            onClose={() => setSkillsConfigVisible(false)}
            onSelectSkill={(id) => setSelectedSkillId(id)}
            selectedSkillId={selectedSkillId}
            onCloseSkillDetail={() => setSelectedSkillId(null)}
            serverBaseUrl={serverConfig.getBaseUrl()}
          />

          <WorkspacePickerModal
            visible={workspacePickerVisible}
            onClose={() => setWorkspacePickerVisible(false)}
            serverBaseUrl={serverConfig.getBaseUrl()}
            workspacePath={workspacePath}
            onRefreshWorkspace={fetchWorkspacePath}
            onWorkspaceSelected={() => {
              setCurrentSessionId(null);
              resetSession();
            }}
          />

          <DockerManagerModal
            visible={dockerVisible}
            onClose={() => setDockerVisible(false)}
            serverBaseUrl={serverConfig.getBaseUrl()}
          />

          {/* Model picker - rendered at root to fix overlay stacking above InputPanel */}
          <Actionsheet
            isOpen={modelPickerVisible}
            onClose={() => setModelPickerVisible(false)}
            snapPoints={[75]}
          >
            <ActionsheetBackdrop />
            <ActionsheetContent
              style={{ backgroundColor: theme.colors.surface, opacity: 1 }}
            >
              <ActionsheetDragIndicatorWrapper>
                <ActionsheetDragIndicator />
              </ActionsheetDragIndicatorWrapper>
              <ActionsheetScrollView
                contentContainerStyle={{ paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}
              >
                {(["claude", "gemini", "codex"] as const).map((p) => {
                  const opts =
                    p === "claude" ? CLAUDE_MODELS : p === "gemini" ? GEMINI_MODELS : PI_MODELS;
                  if (opts.length === 0) return null;
                  const currentProvider = provider === "pi" ? "codex" : provider;
                  const ProviderIcon = p === "claude" ? ClaudeIcon : p === "gemini" ? GeminiIcon : CodexIcon;
                  const accent = getTheme(p, themeMode).colors.accent;
                  return (
                    <Box key={p} className="mb-4">
                      <Box className="flex-row items-center gap-2 mb-1.5 px-0.5">
                        <ProviderIcon size={18} color={accent} />
                        <GluestackText size="xs" bold className="text-typography-600">
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </GluestackText>
                      </Box>
                      {opts.map((opt) => {
                        const isActive = currentProvider === p && model === opt.value;
                        return (
                          <ActionsheetItem
                            key={opt.value}
                            onPress={() => {
                              triggerHaptic("selection");
                              if (currentProvider !== p) handleProviderChange(p);
                              handleModelChange(opt.value);
                              setModelPickerVisible(false);
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={{ minHeight: 48 }}
                          >
                            <ActionsheetItemText bold={isActive}>{opt.label}</ActionsheetItemText>
                          </ActionsheetItem>
                        );
                      })}
                    </Box>
                  );
                })}
              </ActionsheetScrollView>
            </ActionsheetContent>
          </Actionsheet>

          <ProcessesDashboardModal
            visible={processesVisible}
            onClose={() => setProcessesVisible(false)}
            serverBaseUrl={serverConfig.getBaseUrl()}
          />

          <SessionManagementModal
            visible={sessionManagementVisible}
            onClose={() => setSessionManagementVisible(false)}
            currentMessages={messages}
            currentSessionId={currentSessionId}
            workspacePath={workspacePath}
            provider={provider}
            model={model}
            serverBaseUrl={serverConfig.getBaseUrl()}
            workspaceLoading={workspacePathLoading}
            onRefreshWorkspace={fetchWorkspacePath}
            onOpenWorkspacePicker={() => {
              setSessionManagementVisible(false);
              setWorkspacePickerVisible(true);
            }}
            onSelectSession={async (s) => {
              // Switch workspace to session's cwd when different from current
              const sessionCwd = s.cwd ?? null;
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
                  // Proceed with load even if switch fails; session may still be viewable
                }
              }
              lastSwitchedSessionRef.current = {
                id: s.id,
                provider: s.provider ?? undefined,
                model: s.model ?? undefined,
              };
              setCurrentSessionId(s.id);
              if (s.provider) setProvider(s.provider as BrandProvider);
              if (s.model) setModel(s.model);
              if (s.provider && s.model) sessionStore.setLastUsedProviderModel(s.provider, s.model);
              if (s.running || s.sseConnected) {
                resumeLiveSession(s.id, s.messages);
              } else {
                loadSession(s.messages);
              }
              // Scroll to bottom after modal closes and list has laid out
              InteractionManager.runAfterInteractions(() => {
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: false });
                }, 100);
              });
            }}
            onNewSession={() => {
              setCurrentSessionId(null);
              startNewSession();
            }}
            showActiveChat={false}
            sessionRunning={agentRunning || typingIndicator}
            onSelectActiveChat={() => {
              switchToLiveSession();
              setCurrentSessionId(null);
              setSessionManagementVisible(false);
              // Scroll to bottom after modal closes and list has laid out
              InteractionManager.runAfterInteractions(() => {
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: false });
                }, 100);
              });
            }}
          />

          {/* Preview WebView Modal */}
          <PreviewWebViewModal
            visible={previewUrl != null}
            url={previewUrl ?? ""}
            title="Preview"
            onClose={handleClosePreview}
            resolvePreviewUrl={serverConfig.resolvePreviewUrl}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
      </GluestackUIProvider>
    </ThemeProvider>
  );
}

// ============================================================================
// Styles
// ============================================================================

function createAppStyles(theme: ReturnType<typeof getTheme>) {
  return StyleSheet.create({
    providerTintOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 58,
      backgroundColor: theme.colors.pageAccentTint,
    },
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    keyboardView: {
      flex: 1,
    },
    page: {
      flex: 1,
      flexDirection: "column",
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 16,
    },
    topSection: {
      flex: 1,
      minHeight: 0,
      position: "relative",
      overflow: Platform.OS === "ios" ? "visible" : "hidden",
      paddingBottom: 130,
    },
    contentArea: {
      ...StyleSheet.absoluteFillObject,
      overflow: Platform.OS === "ios" ? "visible" : "hidden",
    },
    sidebarOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 5,
    },
    fileViewerOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 6,
    },
    sessionIdCenter: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: spacing[1],
      minHeight: 40,
    },
    headerStatusStack: {
      maxWidth: "100%",
    },
    headerStatusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    runningDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    menuButtonOverlay: {
      position: "absolute",
      top: 8,
      left: 0,
      right: 0,
      height: 44,
      zIndex: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
    },
    chatShell: {
      flex: 1,
      marginTop: 58,
      minHeight: 0,
    },
    chatArea: {
      flex: 1,
    },
    inputBar: {
      flexShrink: 0,
      flexGrow: 0,
      paddingTop: 12,
      paddingBottom: 8,
    },
    chatMessages: {
      paddingVertical: 12,
      paddingHorizontal: spacing["4"],
      gap: 16,
      paddingBottom: 48,
    },
  });
}
