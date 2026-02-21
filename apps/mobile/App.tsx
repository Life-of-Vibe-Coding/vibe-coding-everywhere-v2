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
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
  Dimensions,
  StatusBar,
} from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import * as ScreenOrientation from "expo-screen-orientation";

// Design System Imports
import {
  ThemeProvider,
  getTheme,
  useTheme,
  type Provider as BrandProvider,
} from "./src/theme/index";

import {
  AnimatedPressableView,
  triggerHaptic,
  EntranceAnimation,
  usePerformanceMonitor,
  spacing,
} from "./src/design-system";

// Service Imports
import { useSocket } from "./src/services/socket/hooks";
import {
  getDefaultServerConfig,
  createWorkspaceFileService,
  type PendingAskUserQuestion,
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
import * as sessionStore from "./src/services/sessionStore";
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
  // Theme and Provider State
  const [provider, setProvider] = useState<BrandProvider>("pi");
  const [model, setModel] = useState(DEFAULT_PI_MODEL);
  const theme = useMemo(() => getTheme(provider, "light"), [provider]);
  const styles = useMemo(() => createAppStyles(theme), [theme]);

  // Model Management
  const modelOptions =
    provider === "claude" ? CLAUDE_MODELS : provider === "pi" || provider === "codex" ? PI_MODELS : GEMINI_MODELS;

  const setProviderAndModel = useCallback((p: BrandProvider) => {
    setProvider(p);
    setModel(
      p === "claude" ? DEFAULT_CLAUDE_MODEL : p === "pi" || p === "codex" ? DEFAULT_PI_MODEL : DEFAULT_GEMINI_MODEL
    );
    triggerHaptic("selection");
  }, []);

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
  const didOpenInitialPreview = useRef(false);

  // Socket Hook
  const {
    connected,
    messages,
    claudeRunning,
    waitingForUserInput,
    typingIndicator,
    currentActivity,
    sessionId,
    permissionDenials,
    submitPrompt,
    pendingAskQuestion,
    submitAskQuestionAnswer,
    dismissAskQuestion,
    retryAfterPermission,
    dismissPermission,
    terminateAgent,
    resetSession,
    loadSession,
    lastSessionTerminated,
  } = useSocket({ provider, model });

  // Load last active session on mount
  const hasRestoredSession = useRef(false);
  useEffect(() => {
    if (hasRestoredSession.current) return;
    hasRestoredSession.current = true;
    sessionStore.loadLastActiveSession().then((session) => {
      if (session && session.messages.length > 0) {
        loadSession(session.messages);
        setCurrentSessionId(session.id);
      }
    }).catch(() => {});
  }, [loadSession]);

  // Persist current session when messages change (debounced)
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (messages.length === 0) return;
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    persistTimeoutRef.current = setTimeout(() => {
      persistTimeoutRef.current = null;
      sessionStore.saveSession(messages, currentSessionId, workspacePath).then((s) => {
        if (s.id) setCurrentSessionId(s.id);
      }).catch(() => {});
    }, 1500);
    return () => {
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    };
  }, [messages, currentSessionId, workspacePath]);

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
    [submitPrompt, permissionModeUI, provider, pendingCodeRefs, handleCloseFileViewer]
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

  useEffect(() => {
    if (sessionManagementVisible) fetchWorkspacePath();
  }, [sessionManagementVisible, fetchWorkspacePath]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <ThemeProvider provider={provider} colorMode="light">
      <SafeAreaView style={styles.safeArea}>
        <ExpoStatusBar style={theme.mode === "dark" ? "light" : "dark"} />
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          <View style={styles.page}>
            {/* Main Content Area */}
            <View style={styles.contentArea}>
              {/* Header: Menu (left) | Session ID (center) | Settings (right) */}
              {!sidebarVisible && (
                <View style={styles.menuButtonOverlay} pointerEvents="box-none">
                  <HeaderButton
                    icon={<MenuIcon color={theme.colors.textPrimary} />}
                    onPress={() => setSidebarVisible(true)}
                    accessibilityLabel="Open Explorer"
                    delay={100}
                  />
                  <View style={styles.sessionIdCenter} pointerEvents="none">
                    <Text
                      style={styles.sessionIdText}
                      numberOfLines={1}
                      accessibilityLabel={sessionId != null ? `Session ${sessionId}` : "No session"}
                    >
                      {sessionId != null
                        ? `Session: ${sessionId.split("-")[0] ?? sessionId}`
                        : workspacePath != null
                          ? basename(workspacePath)
                          : "Start a new conversation"}
                    </Text>
                  </View>
                  <HeaderButton
                    icon={<SettingsIcon color={theme.colors.textPrimary} />}
                    onPress={() => setSessionManagementVisible(true)}
                    accessibilityLabel="Manage sessions"
                    delay={200}
                  />
                </View>
              )}

              {/* Chat Area */}
              <View style={styles.chatShell}>
                <FlatList
                  ref={flatListRef}
                  style={styles.chatArea}
                  contentContainerStyle={styles.chatMessages}
                  showsVerticalScrollIndicator={false}
                  showsHorizontalScrollIndicator={false}
                  keyboardDismissMode="on-drag"
                  keyboardShouldPersistTaps="handled"
                  data={messages}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item, index }) => {
                    const isLast = index === messages.length - 1;
                    const showTerminated =
                      lastSessionTerminated && isLast && item.role === "assistant" && !item.content;
                    const messageToShow = showTerminated
                      ? { ...item, content: "Terminated" }
                      : item;
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
                        tailBoxMaxHeight={Dimensions.get("window").height * 0.5}
                        provider={provider}
                        onOpenUrl={handleOpenPreviewInApp}
                        onFileSelect={handleFileSelectFromChat}
                      />
                    );
                  }}
                  ListFooterComponent={
                    <>
                      <TypingIndicator visible={typingIndicator} provider={provider} activity={currentActivity} />
                      {permissionDenials && permissionDenials.length > 0 && (
                        <PermissionDenialBanner
                          denials={permissionDenials}
                          onDismiss={dismissPermission}
                          onAccept={() => {
                            const backend = getBackendPermissionMode(permissionModeUI, provider);
                            retryAfterPermission(backend.permissionMode, backend.approvalMode);
                          }}
                        />
                      )}
                    </>
                  }
                  onContentSizeChange={() => {
                    const now = Date.now();
                    if (now - lastScrollToEndTimeRef.current < 400) return;
                    lastScrollToEndTimeRef.current = now;
                    flatListRef.current?.scrollToEnd({ animated: true });
                  }}
                />
              </View>

              {/* Sidebar Overlay */}
              <View style={styles.sidebarOverlay} pointerEvents={sidebarVisible ? "auto" : "none"}>
                <WorkspaceSidebar
                  visible={sidebarVisible}
                  embedded
                  onClose={() => setSidebarVisible(false)}
                  onFileSelect={handleFileSelect}
                  onCommitByAI={handleCommitByAI}
                />
              </View>

              {/* File Viewer Overlay */}
              {selectedFilePath != null && (
                <View style={styles.fileViewerOverlay} pointerEvents="box-none">
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
                </View>
              )}
            </View>

            {/* Input Panel */}
            <View style={styles.inputBar}>
              <InputPanel
                connected={connected}
                claudeRunning={claudeRunning}
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
                onProviderChange={setProviderAndModel}
                onModelChange={setModel}
                onOpenSkillsConfig={() => setSkillsConfigVisible(true)}
                onOpenDocker={() => setDockerVisible(true)}
              />
            </View>
          </View>

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
          />

          <DockerManagerModal
            visible={dockerVisible}
            onClose={() => setDockerVisible(false)}
            serverBaseUrl={serverConfig.getBaseUrl()}
          />

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
            serverBaseUrl={serverConfig.getBaseUrl()}
            workspaceLoading={workspacePathLoading}
            onRefreshWorkspace={fetchWorkspacePath}
            onOpenWorkspacePicker={() => {
              setSessionManagementVisible(false);
              setWorkspacePickerVisible(true);
            }}
            onSelectSession={(s) => {
              loadSession(s.messages);
              setCurrentSessionId(s.id);
            }}
            onNewSession={() => {
              setCurrentSessionId(null);
              resetSession();
            }}
            sessionStore={sessionStore}
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
    </ThemeProvider>
  );
}

// ============================================================================
// Styles
// ============================================================================

function createAppStyles(theme: ReturnType<typeof getTheme>) {
  return StyleSheet.create({
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
    contentArea: {
      flex: 1,
      flexShrink: 1,
      minHeight: 0,
      position: "relative",
      overflow: "hidden",
    },
    sidebarOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
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
    sessionIdText: {
      fontSize: 12,
      fontWeight: "400",
      letterSpacing: 0.2,
      lineHeight: 16,
      textAlign: "center",
      color: theme.colors.textMuted,
    },
    menuButtonOverlay: {
      position: "absolute",
      top: -8,
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
      marginTop: 22,
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
      gap: 16,
      paddingBottom: 24,
    },
  });
}
