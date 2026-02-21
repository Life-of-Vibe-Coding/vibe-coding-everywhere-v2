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
} from "react-native";
import { AppButton, AppPressable, AppText } from "../../design-system";
import { useTheme } from "../../theme/index";
import { GeminiIcon, ClaudeIcon, CodexIcon } from "../icons/ProviderIcons";
import type { Provider } from "../../theme/index";
import type { PermissionModeUI } from "../../utils/permission";

export type { PermissionModeUI };

const PERMISSION_OPTIONS: { value: PermissionModeUI; label: string }[] = [
  { value: "always_ask", label: "Always ask" },
  { value: "ask_once_per_session", label: "Ask once per permission during session" },
  { value: "yolo", label: "YOLO" },
];

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
  /** Called when user taps "Change workspace" - opens full-screen picker */
  onOpenWorkspacePicker?: () => void;
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
  onOpenWorkspacePicker,
}: SettingsModalProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [allowedRoot, setAllowedRoot] = useState<string | null>(null);

  // Fetch workspace-path when Settings visible (for root + current path display)
  useEffect(() => {
    if (visible) {
      fetch(`${serverBaseUrl}/api/workspace-path`)
        .then((res) => res.json())
        .then((data) => setAllowedRoot(data?.allowedRoot ?? null))
        .catch(() => setAllowedRoot(null));
    }
  }, [visible, serverBaseUrl]);

  const currentRelativePath =
    allowedRoot && workspacePath ? getRelativePath(workspacePath, allowedRoot) : "";

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
                      onPress={() => onOpenWorkspacePicker?.()}
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
