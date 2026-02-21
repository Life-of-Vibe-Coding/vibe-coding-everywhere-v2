import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  SafeAreaView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { AppButton, AppPressable, AppText } from "../../design-system";
import { useTheme } from "../../theme/index";
import { GeminiIcon, ClaudeIcon, CodexIcon } from "../icons/ProviderIcons";
import type { Provider } from "../../theme/index";

export type PermissionModeUI = "always_ask" | "ask_once_per_session" | "yolo";

const PERMISSION_OPTIONS: { value: PermissionModeUI; label: string }[] = [
  { value: "always_ask", label: "Always ask" },
  { value: "ask_once_per_session", label: "Ask once per permission during session" },
  { value: "yolo", label: "YOLO" },
];

type WorkspaceChild = { name: string; path: string };

/** Get relative path from root to fullPath. */
function getRelativePath(fullPath: string, root: string): string {
  const rootNorm = root.replace(/\/$/, "");
  if (fullPath === rootNorm || fullPath === root) return "";
  if (fullPath.startsWith(rootNorm + "/")) {
    return fullPath.slice(rootNorm.length + 1);
  }
  return fullPath;
}

export interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  provider: Provider;
  setProviderAndModel: (p: Provider) => void;
  model: string;
  setModel: (m: string) => void;
  modelOptions: { value: string; label: string }[];
  permissionMode: PermissionModeUI;
  onPermissionModeChange: (mode: PermissionModeUI) => void;
  onStopSession: () => void;
  onNewSession: () => void;
  claudeRunning: boolean;
  workspacePath: string | null;
  workspaceLoading?: boolean;
  onRefreshWorkspace?: () => void;
  /** Base URL for API (e.g. http://localhost:3456) for workspace picker */
  serverBaseUrl: string;
}

export function SettingsModal({
  visible,
  onClose,
  provider,
  setProviderAndModel,
  model,
  setModel,
  modelOptions,
  permissionMode,
  onPermissionModeChange,
  onStopSession,
  onNewSession,
  claudeRunning,
  workspacePath,
  workspaceLoading,
  onRefreshWorkspace,
  serverBaseUrl,
}: SettingsModalProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false);
  const [allowedRoot, setAllowedRoot] = useState<string | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [treeCache, setTreeCache] = useState<Record<string, WorkspaceChild[]>>({});
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [selectingWorkspace, setSelectingWorkspace] = useState(false);

  // Fetch workspace-path when Settings visible (for root + current path display)
  useEffect(() => {
    if (visible) {
      fetch(`${serverBaseUrl}/api/workspace-path`)
        .then((res) => res.json())
        .then((data) => setAllowedRoot(data?.allowedRoot ?? null))
        .catch(() => setAllowedRoot(null));
    }
  }, [visible, serverBaseUrl]);

  const fetchPickerChildren = useCallback(
    async (parentPath: string): Promise<WorkspaceChild[]> => {
      const parentRel = allowedRoot && parentPath.startsWith(allowedRoot)
        ? parentPath.slice(allowedRoot.length).replace(/^\//, "")
        : parentPath;
      const q = parentRel ? `?parent=${encodeURIComponent(parentRel)}` : "";
      const res = await fetch(`${serverBaseUrl}/api/workspace-allowed-children${q}`);
      const data = await res.json();
      const children = data?.children ?? [];
      return children;
    },
    [serverBaseUrl, allowedRoot]
  );

  const handleToggleFolder = useCallback(
    async (child: WorkspaceChild) => {
      if (!allowedRoot) return;
      const isExpanded = expandedPaths.has(child.path);
      if (isExpanded) {
        setExpandedPaths((prev) => {
          const next = new Set(prev);
          next.delete(child.path);
          return next;
        });
        return;
      }
      setLoadingPaths((prev) => new Set(prev).add(child.path));
      try {
        const children = await fetchPickerChildren(child.path);
        setTreeCache((prev) => ({ ...prev, [child.path]: children }));
        setExpandedPaths((prev) => new Set(prev).add(child.path));
      } catch (e) {
        setPickerError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoadingPaths((prev) => {
          const next = new Set(prev);
          next.delete(child.path);
          return next;
        });
      }
    },
    [allowedRoot, expandedPaths, fetchPickerChildren]
  );

  const handleSelectWorkspace = useCallback(
    (path: string) => {
      setSelectingWorkspace(true);
      fetch(`${serverBaseUrl}/api/workspace-path`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      })
        .then((res) => {
          if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d?.error ?? res.statusText)));
          setShowWorkspacePicker(false);
          onRefreshWorkspace?.();
        })
        .catch((e) => setPickerError(e?.message ?? "Failed to set workspace"))
        .finally(() => setSelectingWorkspace(false));
    },
    [serverBaseUrl, onRefreshWorkspace]
  );

  const pickerLoading = loadingPaths.has("") || selectingWorkspace;
  const currentRelativePath =
    allowedRoot && workspacePath ? getRelativePath(workspacePath, allowedRoot) : "";

  // Load root children when picker opens
  const rootChildren = treeCache[""] ?? [];
  useEffect(() => {
    if (showWorkspacePicker && allowedRoot) {
      setPickerError(null);
      setLoadingPaths((prev) => new Set(prev).add(""));
      fetchPickerChildren(allowedRoot)
        .then((children) => setTreeCache((prev) => ({ ...prev, "": children })))
        .catch((e) => setPickerError(e?.message ?? "Failed to load"))
        .finally(() => setLoadingPaths((prev) => { const n = new Set(prev); n.delete(""); return n; }));
    } else if (!showWorkspacePicker) {
      setTreeCache({});
      setExpandedPaths(new Set());
      setLoadingPaths(new Set());
    }
  }, [showWorkspacePicker, allowedRoot, fetchPickerChildren]);

  const renderTreeRow = useCallback(
    (child: WorkspaceChild, depth: number) => {
      const isExpanded = expandedPaths.has(child.path);
      const children = treeCache[child.path];
      const isLoading = loadingPaths.has(child.path);
      return (
        <View key={child.path}>
          <View style={[styles.pickerRow, { paddingLeft: 12 + depth * 16 }]}>
            <TouchableOpacity
              style={styles.pickerRowExpand}
              onPress={() => handleToggleFolder(child)}
              disabled={isLoading}
            >
              <Text style={styles.pickerRowChevron}>{isExpanded ? "▼" : "▶"}</Text>
              <Text style={styles.pickerRowName} numberOfLines={1}>
                {child.name}
              </Text>
              {isLoading ? (
                <ActivityIndicator size="small" color={theme.accent} style={styles.pickerRowLoader} />
              ) : null}
            </TouchableOpacity>
            <AppButton
              label="Select"
              variant="primary"
              size="sm"
              onPress={() => handleSelectWorkspace(child.path)}
              disabled={pickerLoading}
            />
          </View>
          {isExpanded && children && children.length > 0 && (
            <View style={styles.pickerTreeChildren}>
              {children.map((c) => renderTreeRow(c, depth + 1))}
            </View>
          )}
        </View>
      );
    },
    [expandedPaths, treeCache, loadingPaths, handleToggleFolder, handleSelectWorkspace, pickerLoading, theme, styles]
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.fullScreen}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
              <Text style={styles.title}>Settings</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* 1. Code Agent Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Code Agent Selection</Text>
                <View style={styles.row}>
                  <TouchableOpacity
                    style={[styles.agentOption, provider === "claude" && styles.agentOptionActive]}
                    onPress={() => setProviderAndModel("claude")}
                    activeOpacity={0.8}
                  >
                    <View style={provider === "claude" ? undefined : styles.providerIconMuted}>
                      <ClaudeIcon size={18} />
                    </View>
                    <Text style={[styles.agentOptionText, provider === "claude" && styles.agentOptionTextActive]}>
                      Claude
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.agentOption, provider === "gemini" && styles.agentOptionActive]}
                    onPress={() => setProviderAndModel("gemini")}
                    activeOpacity={0.8}
                  >
                    <View style={provider === "gemini" ? undefined : styles.providerIconMuted}>
                      <GeminiIcon size={18} />
                    </View>
                    <Text style={[styles.agentOptionText, provider === "gemini" && styles.agentOptionTextActive]}>
                      Gemini
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.agentOption, provider === "pi" && styles.agentOptionActive]}
                    onPress={() => setProviderAndModel("pi")}
                    activeOpacity={0.8}
                  >
                    <View style={provider === "pi" ? undefined : styles.providerIconMuted}>
                      <CodexIcon size={18} />
                    </View>
                    <Text style={[styles.agentOptionText, provider === "pi" && styles.agentOptionTextActive]}>
                      Pi
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.modelRow}>
                  {modelOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.modelChip, model === opt.value && styles.modelChipActive]}
                      onPress={() => setModel(opt.value)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.modelChipText, model === opt.value && styles.modelChipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 2. Session Management */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Session Management</Text>
                <View style={styles.row}>
                  <AppButton
                    label="Stop current session"
                    variant={claudeRunning ? "danger" : "secondary"}
                    onPress={onStopSession}
                    disabled={!claudeRunning}
                  />
                  <AppButton
                    label="New session"
                    variant="primary"
                    onPress={onNewSession}
                  />
                </View>
              </View>

              {/* 3. Workspace Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Workspace Selection</Text>
                <View style={styles.workspaceBox}>
                  <View style={styles.workspaceRow}>
                    <Text style={styles.workspaceLabel}>Root</Text>
                    <Text style={styles.workspacePath} numberOfLines={1}>
                      {allowedRoot ?? "—"}
                    </Text>
                  </View>
                  <View style={styles.workspaceRow}>
                    <Text style={styles.workspaceLabel}>Selected folder</Text>
                    <Text style={styles.workspacePath} numberOfLines={2}>
                      {workspaceLoading ? "Loading…" : allowedRoot ? (currentRelativePath || "(root)") : (workspacePath ?? "—")}
                    </Text>
                  </View>
                  <View style={styles.workspaceActions}>
                    <AppButton
                      label="Change workspace…"
                      variant="secondary"
                      size="sm"
                      onPress={() => setShowWorkspacePicker(true)}
                    />
                    {onRefreshWorkspace && (
                      <AppButton
                        label="Refresh"
                        variant="secondary"
                        size="sm"
                        onPress={onRefreshWorkspace}
                      />
                    )}
                  </View>
                </View>
              </View>

              {/* Workspace folder selection: shown as a separate modal when "Change workspace" is tapped */}
              <Modal
                visible={showWorkspacePicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowWorkspacePicker(false)}
              >
                <View style={styles.pickerModalBackdrop}>
                  <View style={styles.pickerModalContent}>
                    <View style={styles.pickerHeader}>
                      <Text style={styles.pickerTitle}>Select workspace</Text>
                      <TouchableOpacity
                        onPress={() => setShowWorkspacePicker(false)}
                        style={styles.pickerCloseBtn}
                        hitSlop={12}
                        accessibilityLabel="Close"
                      >
                        <Text style={styles.pickerCloseBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                    {allowedRoot && (
                      <>
                        <View style={styles.breadcrumb}>
                          <Text style={styles.breadcrumbPath} numberOfLines={1}>
                            Root → {currentRelativePath || "(root)"}
                          </Text>
                        </View>
                        <View style={styles.pickerRootRow}>
                          <Text style={styles.pickerRootLabel}>📁 (root)</Text>
                          <AppButton
                            label="Select"
                            variant="primary"
                            size="sm"
                            onPress={() => handleSelectWorkspace(allowedRoot)}
                            disabled={pickerLoading}
                          />
                        </View>
                        {pickerError ? (
                          <Text style={styles.pickerError}>{pickerError}</Text>
                        ) : pickerLoading && rootChildren.length === 0 ? (
                          <ActivityIndicator size="small" color={theme.accent} style={styles.pickerLoader} />
                        ) : (
                          <ScrollView style={styles.pickerList} nestedScrollEnabled>
                            {rootChildren.map((child) => renderTreeRow(child, 0))}
                          </ScrollView>
                        )}
                      </>
                    )}
                  </View>
                </View>
              </Modal>

              {/* 4. Permission Mode Selection */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Permission Mode</Text>
                {PERMISSION_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.permissionOption, permissionMode === opt.value && styles.permissionOptionActive]}
                    onPress={() => onPermissionModeChange(opt.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.permissionOptionText, permissionMode === opt.value && styles.permissionOptionTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 5. Brand Theme */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Brand Theme</Text>
                <Text style={styles.themeNote}>Theme follows Code Agent selection ({provider})</Text>
              </View>
            </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    fullScreen: {
      flex: 1,
      backgroundColor: theme.beigeBg,
    },
    safe: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderColor,
    },
    title: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.textPrimary,
    },
    closeBtn: {
      padding: 8,
    },
    closeBtnText: {
      fontSize: 20,
      color: theme.textMuted,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      ...theme.typography.label,
      fontSize: theme.typography.label.fontSize,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.sm,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    agentOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: theme.cardBg,
    },
    agentOptionActive: {
      backgroundColor: theme.accentLight,
    },
    agentOptionText: {
      fontSize: 15,
      color: theme.textMuted,
    },
    agentOptionTextActive: {
      color: theme.accent,
      fontWeight: "600",
    },
    providerIconMuted: {
      opacity: 0.56,
    },
    modelRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 10,
    },
    modelChip: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    modelChipActive: {
      backgroundColor: theme.accentLight,
      borderColor: theme.accent,
    },
    modelChipText: {
      fontSize: 13,
      color: theme.textMuted,
    },
    modelChipTextActive: {
      color: theme.accent,
      fontWeight: "600",
    },
    actionBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    actionBtnDanger: {
      borderColor: theme.danger,
      backgroundColor: theme.beigeBg,
    },
    actionBtnText: {
      fontSize: 14,
      color: theme.textPrimary,
    },
    workspaceBox: {
      padding: theme.spacing.sm,
      borderRadius: theme.radii.md,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    workspaceRow: {
      marginBottom: theme.spacing.sm,
    },
    workspaceLabel: {
      ...theme.typography.label,
      color: theme.colors.textSecondary,
      marginBottom: 4,
      textTransform: "uppercase",
    },
    workspacePath: {
      ...theme.typography.mono,
      color: theme.colors.textPrimary,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
    workspaceActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
      marginTop: theme.spacing.xs,
      paddingTop: theme.spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.borderColor,
    },
    pickerModalBackdrop: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.sm,
    },
    pickerModalContent: {
      width: "100%",
      maxWidth: 400,
      maxHeight: "80%",
      backgroundColor: theme.cardBg,
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.borderColor,
      padding: theme.spacing.sm,
    },
    pickerHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    pickerTitle: {
      ...theme.typography.callout,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    pickerCloseBtn: {
      padding: theme.spacing.xs,
      minWidth: 44,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    pickerCloseBtnText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
    breadcrumb: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: theme.spacing.xs,
      paddingVertical: 4,
    },
    breadcrumbPath: {
      flex: 1,
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
    useThisFolderBtn: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: theme.accentLight,
      borderWidth: 1,
      borderColor: theme.accent,
      marginBottom: 8,
      alignSelf: "flex-start",
    },
    useThisFolderText: {
      fontSize: 14,
      color: theme.accent,
      fontWeight: "600",
    },
    pickerError: {
      ...theme.typography.callout,
      color: theme.danger,
      marginBottom: theme.spacing.xs,
    },
    pickerLoader: {
      marginVertical: theme.spacing.sm,
    },
    pickerList: {
      maxHeight: 180,
    },
    pickerRootRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xs,
      marginBottom: theme.spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderColor,
    },
    pickerRootLabel: {
      ...theme.typography.callout,
      flex: 1,
      color: theme.colors.textPrimary,
    },
    pickerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderColor,
    },
    pickerRowExpand: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    pickerRowChevron: {
      ...theme.typography.caption,
      color: theme.colors.textSecondary,
      width: 16,
    },
    pickerRowName: {
      ...theme.typography.callout,
      flex: 1,
      color: theme.colors.textPrimary,
    },
    pickerRowLoader: {
      marginLeft: 4,
    },
    pickerTreeChildren: {
      marginLeft: 0,
    },
    pickerRowActions: {
      flexDirection: "row",
      gap: 8,
    },
    pickerRowBtn: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 6,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    pickerRowBtnPrimary: {
      backgroundColor: theme.accentLight,
      borderColor: theme.accent,
    },
    pickerRowBtnText: {
      fontSize: 12,
      color: theme.textMuted,
    },
    pickerRowBtnTextPrimary: {
      fontSize: 12,
      color: theme.accent,
      fontWeight: "600",
    },
    permissionOption: {
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.borderColor,
      marginBottom: 8,
    },
    permissionOptionActive: {
      backgroundColor: theme.accentLight,
      borderColor: theme.accent,
    },
    permissionOptionText: {
      fontSize: 14,
      color: theme.textPrimary,
    },
    permissionOptionTextActive: {
      color: theme.accent,
      fontWeight: "600",
    },
    themeNote: {
      fontSize: 14,
      color: theme.textMuted,
    },
  });
}
