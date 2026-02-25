import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  Modal,
  Alert,
  ScrollView,
  RefreshControl,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  triggerHaptic,
  Skeleton,
  SkeletonText,
  EntranceAnimation,
  AnimatedPressableView,
  Divider,
  spacing,
  radii,
} from "../../design-system";
import { Badge, BadgeText } from "../../../components/ui/badge";
import { Box } from "../../../components/ui/box";
import { Button, ButtonIcon, ButtonText } from "../../../components/ui/button";
import { Pressable } from "../../../components/ui/pressable";
import { Text } from "../../../components/ui/text";
import { VStack } from "../../../components/ui/vstack";
import { HStack } from "../../../components/ui/hstack";
import { useTheme } from "../../theme/index";
import {
  TrashIcon,
  CloseIcon,
  RefreshCwIcon,
  SessionManagementIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "../icons/ChatActionIcons";
import { getFileName } from "../../utils/path";
import { useSessionManagementStore } from "../../state/sessionManagementStore";
import type { Message } from "../../core/types";

/** Session status entry from /api/sessions/status. */
export interface ApiSession {
  id: string;
  cwd: string | null;
  model: string | null;
  lastAccess: number;
  status: "running" | "idling";
  title: string;
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
  /** Workspace cwd this session belongs to. Used to auto-switch workspace when selecting. */
  cwd?: string | null;
}

/** Insert break opportunities after path separators so wrapping avoids mid-segment breaks. */
function formatPathForWrap(path: string): string {
  return path.split("/").join("/\u200B");
}

/** Strip provider prefix from model id for display (e.g. claude-sonnet-4-5 → sonnet-4-5). */
function modelDisplayName(model: string | null | undefined): string {
  if (!model) return "";
  const m = model.trim();
  if (!m) return "";
  if (m.startsWith("claude-")) return m.slice(7);
  if (m.startsWith("anthropic/")) return m.slice(10);
  if (m.startsWith("gemini-")) return m.slice(8);
  if (m.startsWith("gpt-")) return m.slice(4);
  return m;
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

/** Group sessions by workspace cwd for sectioned list. */
function groupSessionsByWorkspace(
  sessions: ApiSession[],
  fallbackWorkspacePath?: string
): { title: string; data: ApiSession[] }[] {
  const byCwd = new Map<string, ApiSession[]>();
  for (const s of sessions) {
    // Use cwd from API; fallback to current workspace when missing
    const key = (typeof s.cwd === "string" && s.cwd.trim()) ? s.cwd : (fallbackWorkspacePath ?? "");
    if (!byCwd.has(key)) byCwd.set(key, []);
    byCwd.get(key)!.push(s);
  }
  const entries = Array.from(byCwd.entries()).sort((a, b) => {
    if (a[0] === "") return 1;
    if (b[0] === "") return -1;
    return a[0].localeCompare(b[0]);
  });
  return entries.map(([cwd, data]) => ({
    title: cwd || "(no workspace)",
    data,
  }));
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

  const sessions = useSessionManagementStore((state) => state.sessionStatuses);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [allowedRoot, setAllowedRoot] = useState<string | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [hoveredHeaderCwd, setHoveredHeaderCwd] = useState<string | null>(null);
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set());
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sections = useMemo(
    () => groupSessionsByWorkspace(sessions, workspacePath ?? undefined),
    [sessions, workspacePath]
  );

  // Expand current workspace and any section containing current session on first load
  useEffect(() => {
    if (!visible || sections.length === 0) return;
    setExpandedWorkspaces((prev) => {
      const next = new Set(prev);
      const currentCwd = (workspacePath ?? "").trim();
      if (currentCwd) next.add(currentCwd);
      const sectionWithCurrent = sections.find((s) =>
        s.data.some((session) => session.id === currentSessionId)
      );
      if (sectionWithCurrent) next.add(sectionWithCurrent.title);
      return next.size > prev.size ? next : prev;
    });
  }, [visible, sections, workspacePath, currentSessionId]);

  useEffect(() => {
    if (!visible) {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
      setSelectError(null);
      setListError(null);
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

  const refresh = useCallback(async (isPullRefresh = false) => {
    if (isPullRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setListError(null);
    setTimeout(() => {
      setLoading(false);
      setRefreshing(false);
    }, 120);
  }, [setLoading, setRefreshing, setListError]);

  useEffect(() => {
    if (visible) {
      setLoading(sessions.length === 0);
    } else {
      setLoading(false);
      setRefreshing(false);
    }
  }, [visible, sessions.length]);

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
      // Always load conversation from disk first (GET /messages reads .pi/agent/sessions).
      // Then onSelectSession will connect SSE only if session is running.
      fetch(`${serverBaseUrl}/api/sessions/${encodeURIComponent(session.id)}/messages`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load session");
          return res.json();
        })
        .then((data: { messages?: Message[]; sessionId?: string; activeSessionId?: string; provider?: string | null; model?: string | null; running?: boolean; sseConnected?: boolean; cwd?: string | null }) => {
          const messages = data.messages ?? [];
          const canonicalId = data.sessionId ?? session.id;
          // Use activeSessionId when session is running so we connect to the stream id (avoids duplicate SSE that gets "end" and blanks the UI).
          const id = (data.running || data.sseConnected) && data.activeSessionId ? data.activeSessionId : canonicalId;
          const cwd = data.cwd ?? session.cwd ?? null;
          onSelectSession({
            id,
            messages,
            provider: data.provider,
            model: data.model ?? session.model,
            running: data.running ?? session.status === "running",
            sseConnected: data.sseConnected ?? session.status === "running",
            cwd,
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
      const title = session.title.slice(0, 50) + (session.title.length > 50 ? "…" : "");
      Alert.alert(
        "Delete session",
        `Remove "${title}" from sessions?`,
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

  const handleDestroyWorkspace = useCallback(
    (targetPath: string) => {
      if (!serverBaseUrl || !targetPath || targetPath === "(no workspace)") return;
      triggerHaptic("medium");
      Alert.alert(
        "Destroy Workspace",
        `Delete all sessions for ${formatPathForWrap(getFileName(targetPath) || targetPath)}? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Destroy",
            style: "destructive",
            onPress: async () => {
              try {
                const res = await fetch(`${serverBaseUrl}/api/sessions/destroy-workspace`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ path: targetPath }),
                });
                const data = (await res.json()) as { ok?: boolean; deletedCount?: number; error?: string };
                if (!res.ok || !data.ok) throw new Error(data.error ?? "Destroy failed");
                const deleted = data.deletedCount ?? 0;
                if (
                  currentSessionId &&
                  sections.some((s) => s.title === targetPath && s.data.some((d) => d.id === currentSessionId))
                ) {
                  onNewSession();
                }
                await refresh();
                if (deleted > 0) triggerHaptic("heavy");
              } catch {
                setSelectError("Failed to destroy workspace sessions");
              }
            },
          },
        ]
      );
    },
    [serverBaseUrl, currentSessionId, sections, onNewSession, refresh]
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <Box style={[styles.container, { paddingTop: insets.top }]}>
        <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
          {/* Header with accent bar */}
          <HStack style={[styles.header, { borderBottomColor: theme.colors.accent + "30" }]}>
            <HStack className="flex-1 items-center gap-2">
              <Box style={[styles.accentBar, { backgroundColor: theme.colors.accent }]} />
              <Text size="xl" bold className="text-typography-900">Sessions</Text>
            </HStack>
            <Button
              action="default"
              variant="link"
              size="md"
              onPress={onClose}
              accessibilityLabel="Close"
              className="min-w-11 min-h-11 -mr-2"
            >
              <ButtonIcon as={CloseIcon} size="lg" style={{ color: theme.colors.textMuted }} />
            </Button>
          </HStack>

          {(selectError || listError) && (
            <EntranceAnimation variant="fade">
              <HStack style={styles.errorBanner}>
                <Text size="sm" className="text-error-600 flex-1">{selectError ?? listError}</Text>
                {listError && (
                  <AnimatedPressableView
                    onPress={() => void refresh(false)}
                    haptic="light"
                    style={styles.retryButton}
                    accessibilityLabel="Retry loading sessions"
                  >
                    <RefreshCwIcon size={16} color={theme.colors.accent} strokeWidth={2} />
                    <Text size="sm" bold style={{ color: theme.colors.accent }}>
                      Retry
                    </Text>
                  </AnimatedPressableView>
                )}
              </HStack>
            </EntranceAnimation>
          )}

          {/* Workspace section - tech-styled card */}
          <VStack style={styles.workspaceSection}>
            <HStack className="items-center gap-2 mt-5 mb-2 mx-5">
              <Box style={[styles.sectionAccent, { backgroundColor: theme.colors.accent }]} />
              <Text size="sm" bold style={{ color: theme.colors.textSecondary }}>Workspace</Text>
            </HStack>
            <Box
              style={[
                styles.workspaceBox,
                {
                  backgroundColor: theme.colors.accent + "08",
                  borderLeftColor: theme.colors.accent,
                  borderColor: theme.colors.accent + "40",
                },
              ]}
              className="mx-5 rounded-xl border-l-4 border overflow-hidden"
            >
              <VStack style={styles.workspacePathContainer} className="px-4 py-3">
                {workspaceLoading ? (
                  <SkeletonText lineHeight={18} lines={1} lastLineWidth="60%" />
                ) : (
                  <VStack style={styles.workspacePathRow} className="gap-2">
                    <Text size="xs" bold style={{ color: theme.colors.accent }} className="uppercase tracking-wide">
                      CWD
                    </Text>
                    <Box
                      style={[
                        styles.cwdPathBox,
                        {
                          backgroundColor: theme.colors.accent + "12",
                          borderColor: theme.colors.accent + "30",
                        },
                      ]}
                      className="rounded-lg border px-3 py-2"
                    >
                      <Text
                        size="sm"
                        bold
                        numberOfLines={2}
                        ellipsizeMode="tail"
                        className="font-mono text-typography-800 min-w-0"
                        style={{
                          fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                          lineHeight: 20,
                          color: theme.colors.textPrimary,
                        }}
                      >
                        {formatPathForWrap(
                          allowedRoot && workspacePath ? (currentRelativePath || "(root)") : (workspacePath ?? "—")
                        )}
                      </Text>
                    </Box>
                  </VStack>
                )}
              </VStack>
              <HStack style={[styles.workspaceActions, { borderTopColor: theme.colors.accent + "25" }]} className="px-4 pb-8 pt-3">
                {onOpenWorkspacePicker && (
                  <Box style={styles.workspaceActionWrap} className="flex-1 min-w-0">
                    <Button
                      action="secondary"
                      variant="outline"
                      size="sm"
                      onPress={onOpenWorkspacePicker}
                      style={[styles.workspaceActionButton, { borderColor: theme.colors.accent + "60" }]}
                    >
                      <ButtonText style={{ color: theme.colors.accent }} className="font-medium">Change Workspace</ButtonText>
                    </Button>
                  </Box>
                )}
                <Box style={styles.workspaceActionWrap} className="flex-1 min-w-0">
                  <Button
                    action="primary"
                    variant="solid"
                    size="sm"
                    onPress={handleNewSession}
                    style={[styles.workspaceActionButton, { backgroundColor: theme.colors.accent }]}
                  >
                    <ButtonText style={{ color: theme.colors.textInverse }} className="font-semibold">Start Session</ButtonText>
                  </Button>
                </Box>
              </HStack>
            </Box>
          </VStack>

          {/* Recent Sessions section */}
          <HStack className="items-center gap-2 mt-5 mb-2 mx-5">
            <Box style={[styles.sectionAccent, { backgroundColor: theme.colors.accent }]} />
            <Text size="sm" bold style={{ color: theme.colors.textSecondary }}>Recent Sessions</Text>
          </HStack>

          {loading && !listError ? (
            <Box style={styles.empty}>
              <Skeleton width="80%" height={60} style={{ marginBottom: 12 }} />
              <Skeleton width="80%" height={60} style={{ marginBottom: 12 }} />
              <Skeleton width="80%" height={60} style={{ marginBottom: 12 }} />
            </Box>
          ) : sessions.length === 0 && !showActiveChat ? (
            <EntranceAnimation variant="fade" delay={100}>
              <Box style={styles.empty}>
                <Box style={[styles.emptyIconContainer, { backgroundColor: theme.colors.accent + "15", borderWidth: 2, borderColor: theme.colors.accent + "40" }]}>
                  <SessionManagementIcon size={40} color={theme.colors.accent} strokeWidth={1.5} />
                </Box>
                <Text size="lg" bold className="text-center mb-2 text-typography-900">
                  {listError ? "Connection Error" : "No Sessions Yet"}
                </Text>
                <Text size="md" className="text-center text-typography-600" style={styles.emptySubtitle}>
                  {listError ? "Check your server connection and tap Retry above." : "Start a conversation and it will appear here."}
                </Text>
              </Box>
            </EntranceAnimation>
          ) : (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => void refresh(true)}
                  tintColor={theme.colors.accent}
                  colors={[theme.colors.accent]}
                />
              }
              showsVerticalScrollIndicator
            >
              {showActiveChat && onSelectActiveChat && (
                <EntranceAnimation variant="fade" delay={100}>
                  <Pressable
                    onPress={onSelectActiveChat}
                    style={[styles.row, styles.activeChatCard, { borderColor: theme.colors.accent, backgroundColor: theme.colors.accent + "14" }]}
                    className="rounded-xl border-l-4"
                  >
                    <VStack style={styles.activeChatCardContent}>
                      <Text size="sm" bold numberOfLines={1} style={{ color: theme.colors.accent }}>
                        Active Chat
                      </Text>
                      <Text size="xs" className="text-typography-600 mt-0.5">
                        {sessionRunning ? "Receiving updates • tap to view" : "Tap to resume"}
                      </Text>
                    </VStack>
                    <Badge action="success" variant="solid" size="sm">
                      <BadgeText>LIVE</BadgeText>
                    </Badge>
                  </Pressable>
                </EntranceAnimation>
              )}

              {sections.map((section) => {
                const fullPath = section.title;
                const lastName = fullPath === "(no workspace)"
                  ? "(no workspace)"
                  : getFileName(fullPath) || fullPath;
                const isExpanded = expandedWorkspaces.has(fullPath);
                const isHovered = hoveredHeaderCwd === fullPath;
                const runningCount = section.data.filter((s) => s.status === "running").length;
                const idlingCount = section.data.length - runningCount;

                const toggleWorkspace = () => {
                  triggerHaptic("light");
                  setExpandedWorkspaces((prev) => {
                    const next = new Set(prev);
                    if (next.has(fullPath)) next.delete(fullPath);
                    else next.add(fullPath);
                    return next;
                  });
                };

                return (
                  <Box key={fullPath} style={styles.menuSection}>
                    <Pressable
                      onHoverIn={() => setHoveredHeaderCwd(fullPath)}
                      onHoverOut={() => setHoveredHeaderCwd(null)}
                      onPress={toggleWorkspace}
                      onLongPress={() => {
                        if (fullPath !== "(no workspace)") {
                          triggerHaptic("light");
                          Alert.alert("Workspace", fullPath, [{ text: "OK" }]);
                        }
                      }}
                      style={[styles.menuHeader, isExpanded && { borderLeftWidth: 3, borderLeftColor: theme.colors.accent }]}
                      accessibilityLabel={`${lastName} workspace, ${runningCount} running, ${idlingCount} idling, ${isExpanded ? "expanded" : "collapsed"}`}
                      accessibilityRole="button"
                    >
                      <Box style={styles.menuHeaderChevron}>
                        {isExpanded ? (
                          <ChevronDownIcon size={16} color={theme.colors.accent} strokeWidth={2} />
                        ) : (
                          <ChevronRightIcon size={16} color={theme.colors.textSecondary} strokeWidth={2} />
                        )}
                      </Box>
                      <Text size="sm" bold className="flex-1 min-w-0" style={{ color: isExpanded ? theme.colors.accent : theme.colors.textPrimary }}>
                        {lastName}
                      </Text>
                      <HStack space="xs" className="ml-1 gap-1.5 flex-row items-center shrink-0">
                        {runningCount > 0 && (
                          <Box
                            style={[
                              styles.countBadge,
                              { backgroundColor: theme.colors.success + "20", borderColor: theme.colors.success + "50", borderWidth: 1 },
                            ]}
                          >
                            <Text size="xs" bold style={{ color: theme.colors.success }}>
                              {runningCount}
                            </Text>
                          </Box>
                        )}
                        {idlingCount > 0 && (
                          <Box
                            style={[styles.countBadge, { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border, borderWidth: 1 }]}
                          >
                            <Text size="xs" bold style={{ color: theme.colors.textSecondary }}>
                              {idlingCount}
                            </Text>
                          </Box>
                        )}
                        {fullPath !== "(no workspace)" && (
                          <Button
                            action="default"
                            variant="link"
                            size="sm"
                            onPress={() => handleDestroyWorkspace(fullPath)}
                            accessibilityLabel={`Destroy workspace ${lastName}`}
                            className="min-w-9 min-h-9 opacity-70 -mr-1"
                          >
                            <ButtonIcon as={TrashIcon} size="sm" style={{ color: theme.colors.danger }} />
                          </Button>
                        )}
                      </HStack>
                      {isHovered && fullPath !== "(no workspace)" && (
                        <Box style={[styles.sectionHeaderTooltip, { backgroundColor: theme.colors.textPrimary }]}>
                          <Text size="xs" numberOfLines={4} className="text-white" style={styles.tooltipText}>
                            {formatPathForWrap(fullPath)}
                          </Text>
                        </Box>
                      )}
                    </Pressable>

                    {isExpanded && (
                      <Box style={styles.menuContent}>
                        {section.data.map((item, index) => {
                          const isLoading = loadingSessionId === item.id;
                          const isActive = item.id === currentSessionId;
                          return (
                            <EntranceAnimation key={item.id} variant="slideUp" delay={50 * (index % 10)}>
                              <Box
                              style={[
                                styles.sessionCard,
                                !isActive && {
                                  borderLeftWidth: 3,
                                  borderLeftColor: theme.colors.accent + "50",
                                  borderColor: theme.colors.border,
                                  backgroundColor: theme.colors.surface,
                                },
                                isActive && {
                                  borderLeftWidth: 4,
                                  borderLeftColor: theme.colors.accent,
                                  borderColor: theme.colors.accent,
                                  backgroundColor: theme.colors.accent + "0C",
                                  borderWidth: 2,
                                },
                              ]}
                              className="rounded-xl overflow-hidden border"
                            >
                                <Pressable
                                  onPress={() => handleSelect(item)}
                                  disabled={isLoading}
                                  style={styles.sessionCardContentWrapper}
                                >
                                  <Box style={styles.sessionCardContent}>
                                    <Text size="xs" bold numberOfLines={2} style={{ color: isActive ? theme.colors.accent : undefined }} className={isActive ? "" : "text-typography-900"}>
                                      {item.title || "(No Input)"}
                                    </Text>

                                    <Box style={styles.sessionCardMetaRow} className="flex-row items-center flex-wrap gap-1 mt-0.5">
                                      <Text
                                        size="xs"
                                        numberOfLines={1}
                                        ellipsizeMode="tail"
                                        className="opacity-70 text-typography-500 shrink-0"
                                      >
                                        {fullPath === "(no workspace)" ? "(no workspace)" : (getFileName(fullPath) || fullPath)}
                                      </Text>
                                      <Divider orientation="vertical" spacing="1" style={{ height: 8, marginHorizontal: 4 }} />
                                      <Text
                                        size="xs"
                                        numberOfLines={1}
                                        ellipsizeMode="middle"
                                        className="opacity-70 text-typography-500"
                                      >
                                        {item.id}
                                      </Text>
                                      <Divider orientation="vertical" spacing="1" style={{ height: 8, marginHorizontal: 4 }} />
                                      <Text size="xs" style={[styles.sessionCardTime, { alignSelf: "center" }]} className="shrink-0 text-typography-500">
                                        {formatDate(item.lastAccess)}
                                      </Text>
                                      {(item.status === "running" || item.model) && (
                                        <Box style={styles.sessionCardBadgeWrap} className="flex-row items-center ml-auto">
                                          {item.status === "running" && (
                                            <Badge action="success" variant="solid" size="sm" className="mr-1">
                                              <BadgeText>RUNNING</BadgeText>
                                            </Badge>
                                          )}
                                          {item.model && (
                                            <Badge action="muted" variant="solid" size="sm">
                                              <BadgeText style={{ fontSize: 10 }}>{modelDisplayName(item.model)}</BadgeText>
                                            </Badge>
                                          )}
                                        </Box>
                                      )}
                                    </Box>
                                  </Box>

                                  <Box className="min-w-11 min-h-11 items-center justify-center ml-0.5">
                                    <Button
                                      action="default"
                                      variant="link"
                                      size="sm"
                                      onPress={() => handleDelete(item)}
                                      accessibilityLabel="Delete session"
                                      className="min-w-11 min-h-11 opacity-70"
                                    >
                                      <ButtonIcon as={TrashIcon} size="sm" style={{ color: theme.colors.textMuted }} />
                                    </Button>
                                  </Box>
                                </Pressable>
                            </Box>
                            </EntranceAnimation>
                          );
                        })}
                      </Box>
                    )}
                  </Box>
                );
              })}
            </ScrollView>
          )}
        </SafeAreaView>
      </Box>
    </Modal>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    safe: {
      flex: 1,
    },
    accentBar: {
      width: 4,
      height: 22,
      borderRadius: 2,
    },
    sectionAccent: {
      width: 3,
      height: 14,
      borderRadius: 2,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing["3"],
      paddingHorizontal: spacing["5"],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    title: {
      fontWeight: "700",
      color: theme.colors.textPrimary,
    },
    closeButton: {
      minWidth: 44,
      minHeight: 44,
      marginRight: -spacing["2"],
    },
    errorBanner: {
      padding: spacing["4"],
      marginHorizontal: spacing["5"],
      marginTop: spacing["2"],
      backgroundColor: theme.colors.danger + "12",
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: theme.colors.danger + "25",
    },
    retryButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing["2"],
      marginTop: spacing["3"],
      paddingVertical: spacing["2"],
      paddingHorizontal: spacing["2"],
      alignSelf: "flex-start",
      minHeight: 44,
    },
    retryText: {
      fontWeight: "600",
    },
    workspaceSection: {
      paddingBottom: spacing["4"],
    },
    sectionTitle: {
      marginTop: spacing["4"],
      marginBottom: spacing["2"],
      marginHorizontal: spacing["5"],
      fontWeight: "600",
    },
    workspacePathContainer: {
      minHeight: 28,
      justifyContent: "center",
    },
    workspacePathRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "flex-start",
      gap: 0,
    },
    cwdPathBox: {
      width: "100%",
    },
    workspacePathLabel: {
      fontWeight: "700",
      fontSize: 12,
      lineHeight: 20,
      color: theme.colors.textSecondary,
      flexShrink: 0,
    },
    workspaceBox: {
      marginHorizontal: spacing["5"],
    },
    workspaceActions: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: spacing["3"],
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    workspaceActionWrap: {
      flex: 1,
      minWidth: 0,
    },
    workspaceActionButton: {
      width: "100%",
      minHeight: 48,
      borderRadius: 10,
    },
    workspaceButtonFill: {
      width: "100%",
      height: 52,
      paddingVertical: spacing["3"],
      paddingHorizontal: spacing["4"],
    },
    workspaceActionLabel: {
      fontSize: 13,
    },
    workspaceChangeButton: {
      backgroundColor: theme.colors.surfaceMuted,
      borderColor: theme.colors.border,
    },
    workspaceNewSessionButton: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    workspaceNewSessionLabel: {
      color: theme.colors.textInverse,
      fontWeight: "600",
    },
    scrollView: {
      flex: 1,
    },
    list: {
      paddingHorizontal: spacing["5"],
      paddingBottom: spacing["8"],
    },
    menuSection: {
      marginTop: spacing["3"],
      position: "relative",
    },
    menuHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing["3"],
      paddingHorizontal: spacing["3"],
      marginBottom: spacing["2"],
      borderRadius: radii.lg,
      backgroundColor: theme.colors.surfaceAlt,
      minHeight: 52,
      position: "relative",
    },
    menuHeaderChevron: {
      width: 20,
      marginRight: spacing["1"],
      alignItems: "center",
      justifyContent: "center",
    },
    menuHeaderText: {
      flex: 1,
    },
    menuHeaderCount: {
      marginLeft: spacing["1"],
      opacity: 0.8,
    },
    countBadge: {
      paddingHorizontal: spacing["2"],
      paddingVertical: spacing["0.5"],
      borderRadius: radii.md,
    },
    menuContent: {
      paddingLeft: spacing["4"],
      paddingTop: spacing["1"],
      paddingBottom: spacing["2"],
    },
    sectionHeader: {
      paddingVertical: spacing["1"],
      paddingHorizontal: 0,
      marginTop: spacing["3"],
      marginBottom: spacing["1"],
      position: "relative",
    },
    sectionHeaderTooltip: {
      position: "absolute",
      top: "100%",
      left: 0,
      marginTop: spacing["0.5"],
      paddingVertical: spacing["2"],
      paddingHorizontal: spacing["3"],
      borderRadius: radii.md,
      maxWidth: 320,
      zIndex: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    tooltipText: {
      color: "#fff",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing["2"],
    },
    sessionCard: {
      marginBottom: spacing["2"],
      overflow: "hidden",
    },
    sessionCardActive: {
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.accent + "05",
      borderWidth: 2,
    },
    sessionCardContentWrapper: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing["2"],
      paddingHorizontal: spacing["3"],
    },
    sessionCardContent: {
      flex: 1,
      marginRight: spacing["1"],
      minWidth: 0,
    },
    sessionCardMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      marginTop: spacing["0.5"],
      gap: spacing["1"],
    },
    sessionCardCwd: {
      marginTop: spacing["1"],
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 10,
      opacity: 0.8,
    },
    sessionCardTime: {
      flexShrink: 0,
    },
    sessionCardBadgeWrap: {
      flexDirection: "row",
      alignItems: "center",
      marginLeft: "auto",
    },
    activeChatCard: {
      padding: spacing["3"],
      borderRadius: radii.lg,
      backgroundColor: theme.colors.accent + "12",
      borderWidth: 1.5,
      borderColor: theme.colors.accent,
      marginBottom: spacing["3"],
    },
    activeChatCardContent: {
      flex: 1,
    },
    sessionId: {
      opacity: 0.7,
    },
    deleteBtn: {
      opacity: 0.7,
      minWidth: 44,
      minHeight: 44,
      marginLeft: spacing["0.5"],
    },
    empty: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing["10"],
    },
    emptyIconContainer: {
      width: 72,
      height: 72,
      borderRadius: radii.xl,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing["4"],
    },
    emptyTitle: {
      marginBottom: spacing["2"],
    },
    emptySubtitle: {
      lineHeight: 22,
      maxWidth: 280,
      opacity: 0.9,
    },
  });
}
