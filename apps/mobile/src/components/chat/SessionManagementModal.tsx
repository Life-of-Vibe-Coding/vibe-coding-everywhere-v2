import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  FlatList,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton } from "../../design-system";
import { triggerHaptic } from "../../design-system";
import { useTheme } from "../../theme/index";
import { TrashIcon } from "../icons/ChatActionIcons";
import type { Message } from "../../core/types";

/** Session from GET /api/sessions (disk .pi/sessions) */
export interface ApiSession {
  id: string;
  fileStem: string;
  firstUserInput: string;
  provider: string | null;
  model: string | null;
  mtime: number;
  sseConnected: boolean;
  running: boolean;
}

/** Loaded session passed to onSelectSession (id + messages from GET /api/sessions/:id/messages) */
export interface LoadedSession {
  id: string;
  messages: Message[];
  provider?: string | null;
  model?: string | null;
  /** Whether session is running on server (enables SSE connect for live stream). */
  running?: boolean;
  /** Whether session has SSE subscribers. */
  sseConnected?: boolean;
}

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
  /** Current messages (unused - we don't save to client storage). */
  currentMessages: Message[];
  /** Current session id if we're viewing a persisted session. */
  currentSessionId: string | null;
  /** Current workspace path for display. */
  workspacePath?: string | null;
  /** Current AI provider (unused). */
  provider?: string | null;
  /** Current AI model (unused). */
  model?: string | null;
  /** Base URL for API (e.g. http://localhost:3456). */
  serverBaseUrl?: string;
  /** Loading state for workspace path. */
  workspaceLoading?: boolean;
  /** Called to refresh workspace path. */
  onRefreshWorkspace?: () => void;
  /** Called when user taps "Change workspace" - opens full-screen picker. */
  onOpenWorkspacePicker?: () => void;
  /** Called when user selects a session (fetches messages from API first). */
  onSelectSession: (session: LoadedSession) => void;
  /** Called when user creates new session (clear and close). */
  onNewSession: () => void;
  /** When true, show an "Active chat" card to switch back to the live session. */
  showActiveChat?: boolean;
  /** Called when user taps "Active chat" to switch back to the live session. */
  onSelectActiveChat?: () => void;
  /** Whether a session is currently running (for display). */
  sessionRunning?: boolean;
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
  currentSessionId,
  workspacePath,
  serverBaseUrl,
  workspaceLoading,
  onOpenWorkspacePicker,
  onSelectSession,
  onNewSession,
  showActiveChat = false,
  onSelectActiveChat,
  sessionRunning = false,
}: SessionManagementModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [sessions, setSessions] = useState<ApiSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [allowedRoot, setAllowedRoot] = useState<string | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
      setSelectError(null);
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
    if (!serverBaseUrl) return;
    setLoading(true);
    try {
      const res = await fetch(`${serverBaseUrl}/api/sessions`);
      const data = (await res.json()) as { sessions?: ApiSession[] };
      setSessions(data.sessions ?? []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [serverBaseUrl]);

  useEffect(() => {
    if (visible) void refresh();
  }, [visible, refresh]);

  // Poll sessions while modal is open so running status stays up to date
  useEffect(() => {
    if (!visible || !serverBaseUrl) return;
    const interval = setInterval(() => {
      fetch(`${serverBaseUrl}/api/sessions`)
        .then((res) => res.json())
        .then((data: { sessions?: ApiSession[] }) => {
          const next = data.sessions ?? [];
          setSessions((prev) => {
            if (prev.length !== next.length) return next;
            const byId = (arr: ApiSession[]) => new Map(arr.map((s) => [s.id, s]));
            const prevMap = byId(prev);
            const changed = next.some(
              (n) => {
                const p = prevMap.get(n.id);
                return !p || p.running !== n.running || p.sseConnected !== n.sseConnected;
              }
            );
            return changed ? next : prev;
          });
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [visible, serverBaseUrl]);

  const handleSelect = useCallback(
    (session: ApiSession) => {
      triggerHaptic("selection");
      if (session.id === currentSessionId) {
        onClose();
        return;
      }
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
      setSelectError(null);
      setLoadingSessionId(session.id);
      fetch(`${serverBaseUrl}/api/sessions/${encodeURIComponent(session.id)}/messages`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load session");
          return res.json();
        })
        .then((data: { messages?: Message[]; sessionId?: string; provider?: string | null; model?: string | null; running?: boolean; sseConnected?: boolean }) => {
          const messages = data.messages ?? [];
          const id = data.sessionId ?? session.id;
          onSelectSession({
            id,
            messages,
            provider: data.provider ?? session.provider,
            model: data.model ?? session.model,
            running: data.running ?? session.running,
            sseConnected: data.sseConnected ?? session.sseConnected,
          });
          onClose();
        })
        .catch((err) => {
          setSelectError(err?.message ?? "Failed to load session");
        })
        .finally(() => {
          setLoadingSessionId(null);
        });
    },
    [currentSessionId, serverBaseUrl, onSelectSession, onClose]
  );

  const handleDelete = useCallback(
    (session: ApiSession) => {
      triggerHaptic("medium");
      const title = session.firstUserInput.slice(0, 50) + (session.firstUserInput.length > 50 ? "…" : "");
      Alert.alert(
        "Delete session",
        `Remove "${title}" from .pi/sessions?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              if (!serverBaseUrl) return;
              try {
                const res = await fetch(`${serverBaseUrl}/api/sessions/${encodeURIComponent(session.id)}`, {
                  method: "DELETE",
                });
                if (!res.ok) throw new Error("Delete failed");
                if (session.id === currentSessionId) {
                  onNewSession();
                }
                await refresh();
              } catch {
                setSelectError("Failed to delete session");
              }
            },
          },
        ]
      );
    },
    [serverBaseUrl, currentSessionId, onNewSession, refresh]
  );

  const handleNewSession = useCallback(() => {
    triggerHaptic("selection");
    onNewSession();
    onClose();
  }, [onNewSession, onClose]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
          <View style={styles.header}>
            <Text style={styles.title}>Sessions</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {selectError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{selectError}</Text>
            </View>
          )}

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
                      label="Change workspace"
                      variant="secondary"
                      size="sm"
                      onPress={onOpenWorkspacePicker}
                      style={{ height: 52 }}
                      labelStyle={{ textAlign: "center" }}
                    />
                  </View>
                )}
                <View style={styles.workspaceActionBtn}>
                  <AppButton
                    label="New session"
                    variant="primary"
                    size="sm"
                    onPress={handleNewSession}
                    style={{ backgroundColor: theme.colors.accentSoft, height: 52 }}
                    labelStyle={{ color: theme.colors.textPrimary, textAlign: "center" }}
                  />
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>From .pi/sessions</Text>

          {loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Loading…</Text>
            </View>
          ) : sessions.length === 0 && !showActiveChat ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No sessions in .pi/sessions.</Text>
              <Text style={styles.emptySub}>Start a conversation to create one.</Text>
            </View>
          ) : (
            <>
              {showActiveChat && onSelectActiveChat && (
                <TouchableOpacity
                  style={[styles.row, styles.sessionCard, styles.activeChatCard]}
                  onPress={onSelectActiveChat}
                  activeOpacity={0.8}
                >
                  <View style={styles.sessionCardContent}>
                    <Text style={[styles.sessionTitle, { color: theme.colors.accent }]} numberOfLines={1}>
                      Active chat
                    </Text>
                    <Text style={styles.sessionMeta}>
                      {sessionRunning ? "Receiving updates — tap to view" : "Tap to view"}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              <FlatList
                data={sessions}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => {
                  const isLoading = loadingSessionId === item.id;
                  return (
                    <View style={[styles.row, styles.sessionCard, item.id === currentSessionId && styles.sessionCardActive]}>
                      <TouchableOpacity
                        style={styles.sessionCardContent}
                        onPress={() => handleSelect(item)}
                        disabled={isLoading}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.sessionTitle} numberOfLines={1}>
                          {item.firstUserInput || "(no input)"}
                        </Text>
                        <Text style={styles.sessionId}>{item.id}</Text>
                        <Text style={styles.sessionMeta}>
                          {item.running ? (
                            <Text style={[styles.sessionMeta, { color: theme.colors.accent, fontWeight: "600" }]}>
                              Running{item.sseConnected ? " · streaming" : ""} ·{" "}
                            </Text>
                          ) : null}
                          {item.model ?? ""}
                          {item.model ? " · " : ""}
                          {formatDate(item.mtime)}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => handleDelete(item)}
                        hitSlop={8}
                        accessibilityLabel={`Delete session ${item.firstUserInput.slice(0, 30)}`}
                      >
                        <TrashIcon color={theme.colors.textMuted} size={20} />
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
            </>
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
    errorBanner: {
      padding: 12,
      marginHorizontal: 20,
      marginTop: 8,
      backgroundColor: "rgba(228, 86, 73, 0.12)",
      borderRadius: 8,
    },
    errorText: {
      fontSize: 14,
      color: theme.colors.danger ?? "#E45649",
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
      marginTop: theme.spacing.sm,
      marginHorizontal: 20,
      textTransform: "uppercase" as const,
      letterSpacing: 0.6,
    },
    workspaceBox: {
      marginHorizontal: 20,
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
    activeChatCard: {
      borderColor: theme.accent,
      backgroundColor: theme.accentLight,
      marginHorizontal: 20,
      marginBottom: 12,
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
