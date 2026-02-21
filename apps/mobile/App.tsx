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
  Modal,
  TextInput,
  Keyboard,
  Alert,
  Dimensions,
  StatusBar,
} from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";

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
  getTerminalInputState,
  type PendingAskUserQuestion,
} from "./src/core";

// Component Imports
import { MessageBubble, hasFileActivityContent, hasCodeBlockContent } from "./src/components/chat/MessageBubble";
import { TypingIndicator } from "./src/components/chat/TypingIndicator";
import { PermissionDenialBanner } from "./src/components/common/PermissionDenialBanner";
import { AskQuestionModal } from "./src/components/chat/AskQuestionModal";
import { InputPanel } from "./src/components/chat/InputPanel";
import { PreviewWebViewModal } from "./src/components/preview/PreviewWebViewModal";
import { RunOutputView } from "./src/components/preview/RunOutputView";
import { WorkspaceSidebar } from "./src/components/file/WorkspaceSidebar";
import { FileViewerModal, type CodeRefPayload } from "./src/components/file/FileViewerModal";
import { SettingsModal, type PermissionModeUI } from "./src/components/settings/SettingsModal";
import { SkillConfigurationModal } from "./src/components/settings/SkillConfigurationModal";
import { SkillDetailSheet } from "./src/components/settings/SkillDetailSheet";
import { MenuIcon, SettingsIcon } from "./src/components/icons/HeaderIcons";

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

// Terminal layout constants
const TERMINAL_CARD_GAP = 12;
const TERMINAL_CARD_WIDTH =
  (Dimensions.get("window").width - 32 - TERMINAL_CARD_GAP * 2) / 3;
const TERMINAL_CARD_STEP = TERMINAL_CARD_WIDTH + TERMINAL_CARD_GAP;

// ============================================================================
// Utility Functions
// ============================================================================

function getBackendPermissionMode(
  ui: PermissionModeUI,
  provider: BrandProvider
): {
  permissionMode?: string;
  approvalMode?: string;
  askForApproval?: string;
  fullAuto?: boolean;
  yolo?: boolean;
} {
  if (provider === "pi" || provider === "codex") {
    if (ui === "yolo") return { yolo: true };
    if (ui === "always_ask") return { askForApproval: "untrusted" };
    return { askForApproval: "on-request" };
  }
  if (ui === "yolo") {
    return provider === "claude"
      ? { permissionMode: "bypassPermissions" }
      : { approvalMode: "auto_edit" };
  }
  if (ui === "always_ask") {
    return provider === "claude"
      ? { permissionMode: "acceptEdits" }
      : { approvalMode: "plan" };
  }
  // ask_once_per_session: Claude "default" = prompts on first use of each tool per session
  return provider === "claude"
    ? { permissionMode: "default" }
    : { approvalMode: "default" };
}

function normalizePathSeparators(input: string): string {
  return input.replace(/\\/g, "/");
}

function isAbsolutePath(input: string): boolean {
  const p = normalizePathSeparators(input.trim());
  return p.startsWith("/") || /^[A-Za-z]:\//.test(p);
}

function dirnamePath(input: string): string {
  const p = normalizePathSeparators(input).replace(/\/+$/, "");
  const idx = p.lastIndexOf("/");
  if (idx <= 0) return p.startsWith("/") ? "/" : ".";
  return p.slice(0, idx);
}

function basenamePath(input: string): string {
  const p = normalizePathSeparators(input).replace(/\/+$/, "");
  const idx = p.lastIndexOf("/");
  return idx >= 0 ? p.slice(idx + 1) : p;
}

function toWorkspaceRelativePath(inputPath: string, workspaceRoot: string): string | null {
  const file = normalizePathSeparators(inputPath).trim();
  const root = normalizePathSeparators(workspaceRoot).replace(/\/$/, "");
  if (!file || !root) return null;
  if (file === root) return "";
  if (!file.startsWith(root + "/")) return null;
  return file.slice(root.length + 1);
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
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [skillsConfigVisible, setSkillsConfigVisible] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [terminalFullScreen, setTerminalFullScreen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
  const [pendingRunApprovalCommand, setPendingRunApprovalCommand] = useState<string | null>(null);

  // Terminal State
  const [terminalCommandInput, setTerminalCommandInput] = useState("");

  // Refs
  const flatListRef = useRef<FlatList>(null);
  const terminalCarouselRef = useRef<FlatList>(null);
  const terminalSelectedByTapRef = useRef(false);
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
    terminals,
    selectedTerminalId,
    setSelectedTerminalId,
    runOutputLines,
    runCommand,
    runProcessActive,
    submitPrompt,
    pendingAskQuestion,
    submitAskQuestionAnswer,
    dismissAskQuestion,
    retryAfterPermission,
    dismissPermission,
    runNewTerminal,
    runCommandInNewTerminal,
    runUserCommand,
    terminateRunProcess,
    terminateAgent,
    resetSession,
    canRunInSelectedTerminal,
    lastSessionTerminated,
  } = useSocket({ provider, model });

  // Performance Monitoring
  const performanceMetrics = usePerformanceMonitor(__DEV__);

  // Effects
  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  const selectedTerminalIndex =
    selectedTerminalId != null
      ? terminals.findIndex((t) => t.id === selectedTerminalId)
      : terminals.length > 0
        ? terminals.length - 1
        : 0;

  useEffect(() => {
    if (terminals.length === 0 || selectedTerminalIndex < 0) return;
    const index = Math.min(selectedTerminalIndex, terminals.length - 1);
    requestAnimationFrame(() => {
      try {
        terminalCarouselRef.current?.scrollToIndex({ index, animated: true });
      } catch (_) {
        // List may not be laid out yet
      }
    });
  }, [selectedTerminalId, terminals.length, selectedTerminalIndex]);

  useEffect(() => {
    if (!selectedFilePath) return;
    setFileLoading(true);
    setFileError(null);
    setFileContent(null);
    setFileIsImage(false);
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
  }, [selectedFilePath, workspaceFileService]);

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
            setSelectedFilePath(rel || basenamePath(normalized));
            return;
          }
        }

        // Absolute path outside current workspace: switch workspace to file directory first.
        const targetWorkspace = dirnamePath(normalized);
        const switchRes = await fetch(`${baseUrl}/api/workspace-path`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: targetWorkspace }),
        });
        if (switchRes.ok) {
          const switched = (await switchRes.json()) as { path?: string };
          if (typeof switched?.path === "string") setWorkspacePath(switched.path);
          setSelectedFilePath(basenamePath(normalized));
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

  /** When always_ask + Codex, show approval before running command from Run button (run-render-command path). */
  const handleRunCommandWithApproval = useCallback(
    (command: string) => {
      const backend = getBackendPermissionMode(permissionModeUI, provider);
      const needsApproval = (provider === "pi" || provider === "codex") && backend.askForApproval === "untrusted";
      if (needsApproval) {
        setPendingRunApprovalCommand(command);
      } else {
        runCommandInNewTerminal(command);
      }
    },
    [permissionModeUI, provider, runCommandInNewTerminal]
  );

  const pendingLocalRunApproval = useMemo<PendingAskUserQuestion | null>(() => {
    if (!pendingRunApprovalCommand) return null;
    return {
      tool_use_id: "local-run-command-approval",
      questions: [
        {
          header: "Command approval",
          question: `Allow running this command?\n${pendingRunApprovalCommand}`,
          options: [
            { label: "Approve", description: "Run this command in a new terminal." },
            { label: "Deny", description: "Do not run this command." },
          ],
          multiSelect: false,
        },
      ],
    };
  }, [pendingRunApprovalCommand]);

  const activePendingAskQuestion = pendingAskQuestion ?? pendingLocalRunApproval;

  useEffect(() => {
    if (pendingAskQuestion && pendingRunApprovalCommand) {
      setPendingRunApprovalCommand(null);
    }
  }, [pendingAskQuestion, pendingRunApprovalCommand]);

  const handleAskQuestionSubmit = useCallback(
    (answers: Array<{ header: string; selected: string[] }>) => {
      if (pendingAskQuestion) {
        submitAskQuestionAnswer(answers);
        return;
      }
      if (!pendingRunApprovalCommand) return;
      const selected = answers.flatMap((a) => (Array.isArray(a.selected) ? a.selected : []));
      const normalized = selected.map((s) => String(s).trim().toLowerCase());
      const approved = normalized.some((s) => s === "approve" || s === "accept" || s === "allow");
      if (approved) {
        runCommandInNewTerminal(pendingRunApprovalCommand);
      }
      setPendingRunApprovalCommand(null);
    },
    [pendingAskQuestion, pendingRunApprovalCommand, submitAskQuestionAnswer, runCommandInNewTerminal]
  );

  const handleAskQuestionCancel = useCallback(() => {
    if (pendingAskQuestion) {
      dismissAskQuestion();
      return;
    }
    setPendingRunApprovalCommand(null);
  }, [pendingAskQuestion, dismissAskQuestion]);

  const handleClosePreview = useCallback(() => {
    setPreviewUrl(null);
  }, []);

  const handleRequestTerminate = useCallback(
    (terminalId: string) => {
      const term = terminals.find((t) => t.id === terminalId);
      const message =
        term?.pid != null
          ? `Are you sure you want to terminate this process (PID ${term.pid})?`
          : "Are you sure you want to terminate this process?";
      
      triggerHaptic("warning");
      Alert.alert("Close terminal?", message, [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Kill", 
          style: "destructive", 
          onPress: () => {
            triggerHaptic("error");
            terminateRunProcess(terminalId);
          }
        },
      ]);
    },
    [terminals, terminateRunProcess]
  );

  const handleCloseFullScreenTerminal = useCallback(() => {
    Keyboard.dismiss();
    setTerminalFullScreen(false);
  }, []);

  const fetchWorkspacePath = useCallback(() => {
    setWorkspacePathLoading(true);
    fetch(`${serverConfig.getBaseUrl()}/api/workspace-path`)
      .then((res) => res.json())
      .then((data) => setWorkspacePath(data?.path ?? null))
      .catch(() => setWorkspacePath(null))
      .finally(() => setWorkspacePathLoading(false));
  }, [serverConfig]);

  useEffect(() => {
    if (settingsVisible) fetchWorkspacePath();
  }, [settingsVisible, fetchWorkspacePath]);

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
                      {sessionId != null ? `Session: ${sessionId.split("-")[0] ?? sessionId}` : "Start a new conversation"}
                    </Text>
                  </View>
                  <HeaderButton
                    icon={<SettingsIcon color={theme.colors.textPrimary} />}
                    onPress={() => setSettingsVisible(true)}
                    accessibilityLabel="Settings"
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
                        onRunBashCommand={handleRunCommandWithApproval}
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
                onPermissionModeChange={() => {}}
                onSubmit={handleSubmit}
                pendingCodeRefs={pendingCodeRefs}
                onRemoveCodeRef={handleRemoveCodeRef}
                showTerminalButton={terminals.length > 0}
                runProcessActive={runProcessActive}
                onShowTerminal={() => flatListRef.current?.scrollToEnd({ animated: true })}
                onOpenTerminal={() => setTerminalFullScreen(true)}
                onTerminateAgent={terminateAgent}
                onOpenWebPreview={() => setPreviewUrl("")}
                provider={provider}
                model={model}
                modelOptions={modelOptions}
                onModelChange={setModel}
                onOpenSkillsConfig={() => setSkillsConfigVisible(true)}
              />
            </View>
          </View>

          {/* Ask Question Modal */}
          <AskQuestionModal
            pending={activePendingAskQuestion}
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

          {/* Settings Modal */}
          <SettingsModal
            visible={settingsVisible}
            onClose={() => setSettingsVisible(false)}
            provider={provider}
            setProviderAndModel={setProviderAndModel}
            model={model}
            setModel={setModel}
            modelOptions={modelOptions}
            permissionMode={permissionModeUI}
            onPermissionModeChange={setPermissionModeUI}
            onStopSession={terminateAgent}
            onNewSession={() => {
              resetSession();
              setSettingsVisible(false);
            }}
            claudeRunning={claudeRunning}
            workspacePath={workspacePath}
            workspaceLoading={workspacePathLoading}
            onRefreshWorkspace={fetchWorkspacePath}
            serverBaseUrl={serverConfig.getBaseUrl()}
          />

          {/* Preview WebView Modal */}
          <PreviewWebViewModal
            visible={previewUrl != null}
            url={previewUrl ?? ""}
            title="Preview"
            onClose={handleClosePreview}
            resolvePreviewUrl={serverConfig.resolvePreviewUrl}
          />

          {/* Full Screen Terminal Modal */}
          <Modal
            visible={terminalFullScreen}
            animationType="slide"
            onRequestClose={handleCloseFullScreenTerminal}
          >
            <SafeAreaView style={styles.fullScreenTerminalSafe}>
              {/* Terminal Header */}
              <View style={styles.fullScreenTerminalHeader}>
                <Text style={styles.fullScreenTerminalTitle}>Terminal</Text>
                <View style={styles.fullScreenTerminalHeaderActions}>
                  <TouchableOpacity
                    onPress={() => {
                      triggerHaptic("selection");
                      runNewTerminal();
                    }}
                    hitSlop={8}
                    style={styles.fullScreenNewTerminalButton}
                  >
                    <Text style={styles.fullScreenNewTerminalText}>New</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleCloseFullScreenTerminal}
                    hitSlop={12}
                    style={styles.fullScreenCloseButton}
                  >
                    <Text style={styles.fullScreenCloseText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Terminal Content */}
              <View style={styles.fullScreenTerminalContent}>
                {terminals.length > 0 ? (
                  <>
                    {/* Terminal Carousel */}
                    <View style={styles.fullScreenTerminalListHeader}>
                      <Text style={styles.fullScreenTerminalListTitle}>Processes</Text>
                    </View>
                    <FlatList
                      ref={terminalCarouselRef}
                      data={terminals}
                      keyExtractor={(t) => t.id}
                      horizontal
                      pagingEnabled={false}
                      snapToInterval={TERMINAL_CARD_STEP}
                      snapToAlignment="start"
                      decelerationRate="fast"
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.fullScreenTerminalCarouselContent}
                      style={styles.fullScreenTerminalCarousel}
                      getItemLayout={(_, index: number) => ({
                        length: TERMINAL_CARD_STEP,
                        offset: TERMINAL_CARD_STEP * index,
                        index,
                      })}
                      onMomentumScrollEnd={(e) => {
                        if (terminalSelectedByTapRef.current) {
                          terminalSelectedByTapRef.current = false;
                          return;
                        }
                        const index = Math.round(
                          e.nativeEvent.contentOffset.x / TERMINAL_CARD_STEP
                        );
                        if (index >= 0 && index < terminals.length) {
                          setSelectedTerminalId(terminals[index].id);
                        }
                      }}
                      renderItem={({ item: term }) => {
                        const isSelected = term.id === selectedTerminalId;
                        return (
                          <TouchableOpacity
                            style={[
                              styles.fullScreenTerminalCard,
                              { width: TERMINAL_CARD_WIDTH },
                              isSelected && styles.fullScreenTerminalCardSelected,
                            ]}
                            onPress={() => {
                              terminalSelectedByTapRef.current = true;
                              setSelectedTerminalId(term.id);
                              triggerHaptic("selection");
                            }}
                          >
                            <View style={styles.fullScreenTerminalCardInner}>
                              <View style={styles.fullScreenTerminalCardTopRow}>
                                <View
                                  style={[
                                    styles.fullScreenTerminalStatusBadge,
                                    term.active
                                      ? styles.fullScreenTerminalStatusRunning
                                      : styles.fullScreenTerminalStatusIdle,
                                  ]}
                                >
                                  <Text style={styles.fullScreenTerminalStatusText}>
                                    {term.active ? "Running" : "Idle"}
                                  </Text>
                                </View>
                                <TouchableOpacity
                                  onPress={() => handleRequestTerminate(term.id)}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  style={styles.fullScreenTerminalCloseRowButton}
                                >
                                  <Text style={styles.fullScreenTerminalCloseRowIcon}>×</Text>
                                </TouchableOpacity>
                              </View>
                              {term.pid != null && (
                                <Text style={styles.fullScreenTerminalPid}>PID {term.pid}</Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      }}
                    />

                    {/* Terminal Output: show selected terminal's lines so each process has its own output */}
                    <View style={styles.fullScreenTerminalOutputWrap}>
                      <RunOutputView
                        lines={
                          selectedTerminalId
                            ? (terminals.find((t) => t.id === selectedTerminalId)?.lines ?? [])
                            : runOutputLines
                        }
                        command={
                          selectedTerminalId
                            ? (terminals.find((t) => t.id === selectedTerminalId)?.lastCommand ?? null)
                            : runCommand
                        }
                        title="Output"
                        showWhenEmpty
                        flexOutput
                        isExecuting={
                          selectedTerminalId
                            ? (terminals.find((t) => t.id === selectedTerminalId)?.active ?? false)
                            : runProcessActive
                        }
                        onTerminate={
                          (selectedTerminalId ?? terminals[terminals.length - 1]?.id)
                            ? () =>
                                handleRequestTerminate(
                                  selectedTerminalId ?? terminals[terminals.length - 1]!.id
                                )
                            : undefined
                        }
                        onOpenUrl={handleOpenPreviewInApp}
                      />

                      {/* Terminal Input */}
                      {(() => {
                        const inputState = getTerminalInputState(
                          selectedTerminalId,
                          terminals,
                          canRunInSelectedTerminal
                        );
                        if (inputState === "disabled") {
                          return (
                            <View style={styles.terminalCommandDisabledHint}>
                              <Text style={styles.terminalCommandDisabledText}>
                                Command running. Terminate to run another.
                              </Text>
                            </View>
                          );
                        }
                        if (inputState !== "enabled") return null;
                        return (
                          <View style={styles.terminalCommandRow}>
                            <TextInput
                              style={styles.terminalCommandInput}
                              placeholder="Type a command…"
                              placeholderTextColor={theme.colors.textMuted}
                              value={terminalCommandInput}
                              onChangeText={setTerminalCommandInput}
                              onSubmitEditing={() => {
                                if (terminalCommandInput.trim()) {
                                  triggerHaptic("light");
                                  runUserCommand(terminalCommandInput.trim());
                                  setTerminalCommandInput("");
                                }
                              }}
                              returnKeyType="send"
                            />
                            <TouchableOpacity
                              style={styles.terminalCommandRunButton}
                              onPress={() => {
                                if (terminalCommandInput.trim()) {
                                  triggerHaptic("success");
                                  runUserCommand(terminalCommandInput.trim());
                                  setTerminalCommandInput("");
                                }
                              }}
                            >
                              <Text style={styles.terminalCommandRunText}>Run</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })()}
                    </View>
                  </>
                ) : (
                  <View style={styles.fullScreenTerminalEmpty}>
                    <Text style={styles.fullScreenTerminalEmptyText}>
                      No terminals. Run a command from the chat or tap "New" to open a shell.
                    </Text>
                  </View>
                )}
              </View>
            </SafeAreaView>
          </Modal>
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
    fullScreenTerminalSafe: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    fullScreenTerminalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
    },
    fullScreenTerminalTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    fullScreenTerminalHeaderActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    fullScreenNewTerminalButton: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.accent,
    },
    fullScreenNewTerminalText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.accent,
    },
    fullScreenCloseButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      backgroundColor: theme.colors.accent,
      borderRadius: 8,
    },
    fullScreenCloseText: {
      fontSize: 15,
      color: "#fff",
      fontWeight: "600",
    },
    fullScreenTerminalContent: {
      flex: 1,
      paddingHorizontal: 16,
      paddingBottom: 16,
      minHeight: 0,
    },
    fullScreenTerminalListHeader: {
      paddingVertical: 8,
    },
    fullScreenTerminalListTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textMuted,
    },
    fullScreenTerminalCarousel: {
      maxHeight: 72,
      marginBottom: 12,
    },
    fullScreenTerminalCarouselContent: {
      paddingRight: 16,
    },
    fullScreenTerminalCard: {
      marginRight: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
      overflow: "hidden",
      paddingTop: 6,
      paddingBottom: 8,
      paddingHorizontal: 10,
    },
    fullScreenTerminalCardSelected: {
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.background,
      borderWidth: 1.5,
    },
    fullScreenTerminalCardInner: {
      flex: 1,
      flexDirection: "column",
      justifyContent: "space-between",
      minHeight: 44,
    },
    fullScreenTerminalCardTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    fullScreenTerminalStatusBadge: {
      alignSelf: "flex-start",
      marginLeft: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    fullScreenTerminalStatusRunning: {
      backgroundColor: theme.colors.success + "28",
    },
    fullScreenTerminalStatusIdle: {
      backgroundColor: theme.colors.textMuted + "20",
    },
    fullScreenTerminalStatusText: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.textPrimary,
      letterSpacing: 0.2,
    },
    fullScreenTerminalPid: {
      fontSize: 12,
      color: theme.colors.textMuted,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      letterSpacing: 0.3,
      alignSelf: "center",
    },
    fullScreenTerminalCloseRowButton: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.colors.danger + "22",
      justifyContent: "center",
      alignItems: "center",
    },
    fullScreenTerminalCloseRowIcon: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.colors.danger,
      lineHeight: 14,
    },
    fullScreenTerminalOutputWrap: {
      flex: 1,
      minHeight: 0,
    },
    fullScreenTerminalEmpty: {
      flex: 1,
      justifyContent: "center",
      padding: 24,
    },
    fullScreenTerminalEmptyText: {
      fontSize: 15,
      color: theme.colors.textMuted,
      textAlign: "center",
    },
    terminalCommandDisabledHint: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    terminalCommandDisabledText: {
      fontSize: 13,
      color: theme.colors.textMuted,
      textAlign: "center",
    },
    terminalCommandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
    },
    terminalCommandInput: {
      flex: 1,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 14,
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    terminalCommandRunButton: {
      paddingVertical: 10,
      paddingHorizontal: 18,
      backgroundColor: theme.colors.accent,
      borderRadius: 8,
    },
    terminalCommandRunText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#fff",
    },
  });
}
