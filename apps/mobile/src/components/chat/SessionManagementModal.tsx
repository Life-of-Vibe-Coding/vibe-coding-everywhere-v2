import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
  Alert,
  FlatList,
  Platform,
} from "react-native";
import { AppButton } from "../../design-system";
import { triggerHaptic } from "../../design-system";
import { useTheme } from "../../theme/index";
import { TrashIcon } from "../icons/ChatActionIcons";
import type { StoredSession } from "../../services/sessionStore";
import type { Message } from "../../core/types";

/** Get relative path from root to fullPath. */
function getRelativePath(fullPath: string, root: string): string {
  const rootNorm = root.replace(/\/$/, "");
  if (fullPath === rootNorm || fullPath === root) return "";
  if (fullPath.startsWith(rootNorm + "/")) {
    return fullPath.slice(rootNorm.length + 1);
  }
  return fullPath;
}

export interface SessionManagementModalProps {
  visible: boolean;
  onClose: () => void;
  /** Current messages (for saving when switching). */
  currentMessages: Message[];
  /** Current session id if we're viewing a persisted session. */
  currentSessionId: string | null;
  /** Current workspace path for display. */
  workspacePath?: string | null;
  /** Base URL for API (e.g. http://localhost:3456) for workspace picker. */
  serverBaseUrl?: string;
  /** Loading state for workspace path. */
  workspaceLoading?: boolean;
  /** Called to refresh workspace path. */
  onRefreshWorkspace?: () => void;
  /** Called when user taps "Change workspace" - opens full-screen picker. */
  onOpenWorkspacePicker?: () => void;
  /** Called when user selects a session to switch to. */
  onSelectSession: (session: StoredSession) => void;
  /** Called when user creates new session (clear and close). */
  onNewSession: () => void;
  /** Session store - loadSessions, deleteSession, saveSession, setLastActiveSession. */
  sessionStore: Pick<
    typeof import("../../services/sessionStore"),
    "loadSessions" | "deleteSession" | "saveSession" | "setLastActiveSession"
  >;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

export function SessionManagementModal({
  visible,
  onClose,
  currentMessages,
  currentSessionId,
  workspacePath,
  serverBaseUrl,
  workspaceLoading,
  onRefreshWorkspace,
  onOpenWorkspacePicker,
  onSelectSession,
  onNewSession,
  sessionStore,
}: SessionManagementModalProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [allowedRoot, setAllowedRoot] = useState<string | null>(null);
  /** Session id being selected - shown highlighted for 1s before switching. */
  const [selectedForTransition, setSelectedForTransition] = useState<string | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      setSelectedForTransition(null);
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
    }
  }, [visible]);

  useEffect(() => {
    if (visible && serverBaseUrl) {
      fetch(`${serverBaseUrl}/api/workspace-path`)
        .then((res) => res.json())
        .then((data) => setAllowedRoot(data?.allowedRoot ?? null))
        .catch(() => setAllowedRoot(null));
    }
  }, [visible, serverBaseUrl]);

  const currentRelativePath =
    allowedRoot && workspacePath ? getRelativePath(workspacePath, allowedRoot) : "";

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { sessions: list } = await sessionStore.loadSessions();
      setSessions(list);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [sessionStore]);

  useEffect(() => {
    if (visible) void refresh();
  }, [visible, refresh]);

  const handleSelect = useCallback(
    (session: StoredSession) => {
      triggerHaptic("selection");
      if (session.id === currentSessionId) {
        onClose();
        return;
      }
      // Cancel any in-flight transition
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
      // 1. Highlight the selected session for 1 second
      setSelectedForTransition(session.id);
      transitionTimeoutRef.current = setTimeout(async () => {
        transitionTimeoutRef.current = null;
        setSelectedForTransition(null);
        // 2. Then switch and return to chat
        if (currentMessages.length > 0) {
          await sessionStore.saveSession(currentMessages, currentSessionId, workspacePath);
        }
        await sessionStore.setLastActiveSession(session.id);
        onSelectSession(session);
        onClose();
      }, 300);
    },
    [currentSessionId, currentMessages, workspacePath, sessionStore, onSelectSession, onClose]
  );

  const handleDelete = useCallback(
    (session: StoredSession) => {
      triggerHaptic("medium");
      Alert.alert(
        "Delete session",
        `Remove "${session.title.slice(0, 50)}${session.title.length > 50 ? "…" : ""}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await sessionStore.deleteSession(session.id);
              if (session.id === currentSessionId) {
                onNewSession();
              }
              await refresh();
            },
          },
        ]
      );
    },
    [sessionStore, currentSessionId, onNewSession, refresh]
  );

  const handleNewSession = useCallback(async () => {
    triggerHaptic("selection");
    if (currentMessages.length > 0) {
      await sessionStore.saveSession(currentMessages, currentSessionId, workspacePath);
    }
    await sessionStore.setLastActiveSession(null);
    onNewSession();
    onClose();
  }, [currentMessages, currentSessionId, workspacePath, sessionStore, onNewSession, onClose]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <Text style={styles.title}>Sessions</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Workspace - path, change button, and new session merged in one box */}
          <View style={styles.workspaceSection}>
            <Text style={styles.sectionTitle}>Workspace</Text>
            <View style={styles.workspaceBox}>
              <Text style={styles.workspacePathText} numberOfLines={2}>
                {workspaceLoading ? "Loading…" : allowedRoot ? (currentRelativePath || "(root)") : (workspacePath ?? "—")}
              </Text>
              <View style={styles.workspaceActions}>
                {onOpenWorkspacePicker && (
                  <View style={styles.workspaceActionBtn}>
                    <AppButton
                      label="Change workspace…"
                      variant="secondary"
                      size="sm"
                      onPress={onOpenWorkspacePicker}
                    />
                  </View>
                )}
                <View style={styles.workspaceActionBtn}>
                  <AppButton
                    label="New session"
                    variant="primary"
                    size="sm"
                    onPress={handleNewSession}
                    style={{ backgroundColor: theme.colors.accentSoft }}
                    labelStyle={{ color: theme.colors.textPrimary }}
                  />
                </View>
              </View>
            </View>
          </View>

          {loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Loading…</Text>
            </View>
          ) : sessions.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No saved sessions yet.</Text>
              <Text style={styles.emptySub}>Start a conversation to save it.</Text>
            </View>
          ) : (
            <FlatList
              data={sessions}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <View style={[styles.row, styles.sessionCard, item.id === (selectedForTransition ?? currentSessionId) && styles.sessionCardActive]}>
                  <TouchableOpacity
                    style={styles.sessionCardContent}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.sessionTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.sessionId}>{item.id}</Text>
                    {item.workspacePath != null && item.workspacePath !== "" && (
                      <Text style={styles.sessionWorkspace}>
                        Workspace: {item.workspacePath}
                      </Text>
                    )}
                    <Text style={styles.sessionMeta}>
                      {item.messages.length} messages · {formatDate(item.updatedAt)}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(item)}
                    hitSlop={8}
                    accessibilityLabel={`Delete session ${item.title}`}
                  >
                    <TrashIcon color={theme.colors.textMuted} size={20} />
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
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
    workspaceSection: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderColor,
    },
    sectionTitle: {
      ...theme.typography.label,
      fontSize: theme.typography.label.fontSize,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.sm,
      textTransform: "uppercase" as const,
      letterSpacing: 0.6,
    },
    workspaceBox: {
      padding: theme.spacing.sm,
      borderRadius: theme.radii.md,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    workspacePathText: {
      ...theme.typography.mono,
      fontSize: 13,
      color: theme.colors.textPrimary,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      letterSpacing: 0.3,
      lineHeight: 20,
      marginBottom: theme.spacing.xs,
    },
    workspaceActions: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    workspaceActionBtn: {
      flex: 1,
      minWidth: 0,
    },
    list: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    sessionCard: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    sessionCardContent: {
      flex: 1,
    },
    sessionCardActive: {
      borderColor: theme.accent,
      backgroundColor: theme.accentLight,
    },
    sessionTitle: {
      fontSize: 15,
      fontWeight: "500",
      color: theme.colors.textPrimary,
    },
    sessionId: {
      fontSize: 11,
      color: theme.colors.textMuted,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      marginTop: 2,
    },
    sessionWorkspace: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 4,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      letterSpacing: 0.2,
      lineHeight: 16,
    },
    sessionMeta: {
      fontSize: 12,
      color: theme.colors.textMuted,
      marginTop: 4,
    },
    deleteBtn: {
      padding: 8,
      marginLeft: 8,
    },
    empty: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    emptyText: {
      fontSize: 16,
      color: theme.colors.textMuted,
    },
    emptySub: {
      fontSize: 14,
      color: theme.colors.textMuted,
      marginTop: 8,
    },
  });
}
