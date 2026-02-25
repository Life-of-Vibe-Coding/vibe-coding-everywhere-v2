import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  Platform,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  triggerHaptic,
  SkeletonText,
  EntranceAnimation,
  AnimatedPressableView,
  spacing,
  radii,
} from "@/design-system";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
import { Button, ButtonIcon, ButtonText } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { ScrollView } from "@/components/ui/scroll-view";
import { RefreshControl } from "@/components/ui/refresh-control";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { AsyncStateView } from "@/components/reusable/AsyncStateView";
import { ModalScaffold } from "@/components/reusable/ModalScaffold";
import { SessionListItemCard } from "@/components/reusable/SessionListItem";
import { useTheme } from "@/theme/index";
import { showAlert } from "@/components/ui/alert/native-alert";
import {
  TrashIcon,
  RefreshCwIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
} from "@/components/icons/ChatActionIcons";
import { getFileName } from "@/utils/path";
import { useSessionManagementStore } from "@/state/sessionManagementStore";
import type { Message } from "@/core/types";

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

const uiMonoFontFamily = Platform.select({
  ios: "Menlo",
  android: "monospace",
  web: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  default: "monospace",
});

const SESSIONS_UI = {
  background: "#f3f4f6",
  surface: "#ffffff",
  primary: "#22c55e",
  textPrimary: "#111827",
  textSecondary: "#6b7280",
  textTertiary: "#9ca3af",
  border: "#e5e7eb",
} as const;
const SECTION_GAP = 24;
const INTERNAL_GAP = 12;

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
  isOpen: boolean;
  onClose: () => void;
  /** Current session id if we're viewing a persisted session. */
  currentSessionId: string | null;
  /** Current workspace path for display. */
  workspacePath?: string | null;
  /** Base URL for API (e.g. http://localhost:3456). */
  serverBaseUrl?: string;
  /** Loading state for workspace path. */
  workspaceLoading?: boolean;
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
  isOpen,
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
  const styles = useMemo(() => createStyles(theme), [theme]);

  const sessions = useSessionManagementStore((state) => state.sessionStatuses);
  const removeSessionStatus = useSessionManagementStore((state) => state.removeSessionStatus);
  const setSessionStatuses = useSessionManagementStore((state) => state.setSessionStatuses);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [allowedRoot, setAllowedRoot] = useState<string | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [hoveredHeaderCwd, setHoveredHeaderCwd] = useState<string | null>(null);
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set());
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const sections = useMemo(
    () => groupSessionsByWorkspace(sessions, workspacePath ?? undefined),
    [sessions, workspacePath]
  );

  // Expand current workspace and any section containing current session on first load
  useEffect(() => {
    if (!isOpen || sections.length === 0) return;
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
  }, [isOpen, sections, workspacePath, currentSessionId]);

  useEffect(() => {
    if (!isOpen) {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
      setSelectError(null);
      setListError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && serverBaseUrl) {
      fetch(`${serverBaseUrl}/api/workspace-path`)
        .then((res) => res.json())
        .then((data) => setAllowedRoot(data?.allowedRoot ?? null))
        .catch(() => setAllowedRoot(null));
    }
  }, [isOpen, serverBaseUrl]);

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
    if (isOpen) {
      setLoading(sessions.length === 0);
    } else {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isOpen, sessions.length]);

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
      showAlert(
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
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                removeSessionStatus(session.id);
                if (session.id === currentSessionId) {
                  onNewSession();
                }
                triggerHaptic("success");
              } catch {
                setSelectError("Failed to delete session");
              }
            },
          },
        ]
      );
    },
    [serverBaseUrl, currentSessionId, onNewSession, removeSessionStatus]
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
      showAlert(
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
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setSessionStatuses(
                  sessions.filter((session) => {
                    const sessionPathBase = (typeof session.cwd === "string" && session.cwd.trim())
                      ? session.cwd
                      : (workspacePath ?? "");
                    const sessionPath = sessionPathBase || "(no workspace)";
                    return sessionPath !== targetPath;
                  })
                );
                if (deleted > 0) triggerHaptic("heavy");
              } catch {
                setSelectError("Failed to destroy workspace sessions");
              }
            },
          },
        ]
      );
    },
    [serverBaseUrl, currentSessionId, sections, onNewSession, setSessionStatuses, sessions, workspacePath]
  );

  if (!isOpen) return null;

  return (
    <ModalScaffold
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      title="Sessions"
      contentClassName="w-full h-full max-w-none rounded-none border-0 p-0"
      bodyClassName="m-0 p-0"
      bodyProps={{ scrollEnabled: false }}
      showCloseButton={false}
      headerRight={
        <HStack style={styles.headerActions}>
          <Button
            action="default"
            variant="link"
            size="md"
            onPress={() => void refresh(false)}
            accessibilityLabel="Refresh sessions"
            style={styles.headerIconButton}
            className="min-w-11 min-h-11"
          >
            <ButtonIcon as={RefreshCwIcon} size="md" style={{ color: SESSIONS_UI.textSecondary }} />
          </Button>
          <Button
            action="default"
            variant="link"
            size="md"
            onPress={onClose}
            accessibilityLabel="Close sessions"
            style={styles.headerIconButton}
            className="min-w-11 min-h-11"
          >
            <ButtonIcon as={CloseIcon} size="md" style={{ color: SESSIONS_UI.textSecondary }} />
          </Button>
        </HStack>
      }
    >
      <Box style={styles.container}>
        <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
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
                    <RefreshCwIcon size={16} color={SESSIONS_UI.primary} strokeWidth={1.8} />
                    <Text size="sm" bold style={{ color: SESSIONS_UI.primary }}>
                      Retry
                    </Text>
                  </AnimatedPressableView>
                )}
              </HStack>
            </EntranceAnimation>
          )}

          {/* Workspace section - tech-styled card */}
          <VStack style={styles.workspaceSection}>
            <Text size="sm" bold style={styles.sectionLabel}>
              Session Management
            </Text>
            <HStack style={styles.sectionHeaderRow}>
              <Text size="sm" bold style={{ color: SESSIONS_UI.textSecondary }}>Workspace</Text>
            </HStack>
            <Box style={styles.workspaceBox} className="mx-5 rounded-xl border overflow-hidden">
              <VStack style={styles.workspacePathContainer}>
                {workspaceLoading ? (
                  <SkeletonText lineHeight={18} lines={1} lastLineWidth="60%" />
                ) : (
                  <VStack style={styles.workspacePathRow}>
                    <Text size="xs" bold style={{ color: SESSIONS_UI.textSecondary }} className="uppercase tracking-wide">
                      CWD
                    </Text>
                    <Box style={styles.cwdPathBox} className="rounded-lg border">
                      <Text
                        size="xs"
                        numberOfLines={2}
                        ellipsizeMode="tail"
                        style={styles.cwdPathText}
                      >
                        {formatPathForWrap(
                          allowedRoot && workspacePath ? (currentRelativePath || "(root)") : (workspacePath ?? "—")
                        )}
                      </Text>
                    </Box>
                  </VStack>
                )}
              </VStack>
              <HStack style={styles.workspaceActions}>
                {onOpenWorkspacePicker && (
                  <Box style={styles.workspaceActionWrap} className="flex-1 min-w-0">
                    <Button
                      action="secondary"
                      variant="outline"
                      size="sm"
                      onPress={onOpenWorkspacePicker}
                      style={styles.workspaceActionButtonSecondary}
                    >
                      <ButtonText style={{ color: SESSIONS_UI.textPrimary }} className="font-medium">Change Workspace</ButtonText>
                    </Button>
                  </Box>
                )}
                <Box style={styles.workspaceActionWrap} className="flex-1 min-w-0">
                  <Button
                    action="primary"
                    variant="solid"
                    size="sm"
                    onPress={handleNewSession}
                    style={styles.workspaceActionButtonPrimary}
                  >
                    <ButtonText style={{ color: "#ffffff" }} className="font-semibold">Start Session</ButtonText>
                  </Button>
                </Box>
              </HStack>
            </Box>
          </VStack>

          {/* Recent Sessions section */}
          <HStack style={styles.sectionHeaderRow}>
            <Text size="sm" bold style={{ color: SESSIONS_UI.textSecondary }}>Recent Sessions</Text>
          </HStack>

          <AsyncStateView
            isLoading={loading && !listError}
            error={sessions.length === 0 && !showActiveChat ? listError : null}
            isEmpty={sessions.length === 0 && !showActiveChat && !listError}
            loadingText="Loading sessions..."
            emptyTitle="No Sessions Yet"
            emptyDescription="Start a conversation and it will appear here."
            onRetry={listError ? () => void refresh(false) : undefined}
            className="flex-1 bg-transparent"
          >
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.list}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => void refresh(true)}
                  tintColor={SESSIONS_UI.primary}
                  colors={[SESSIONS_UI.primary]}
                />
              }
              showsVerticalScrollIndicator
            >
              {showActiveChat && onSelectActiveChat && (
                <EntranceAnimation variant="fade" delay={100}>
                  <Pressable
                    onPress={onSelectActiveChat}
                    style={styles.activeChatCard}
                    className="rounded-xl border"
                    accessibilityRole="button"
                    accessibilityLabel="Open active chat"
                    accessibilityHint="Switches back to the currently active live chat"
                  >
                    <VStack style={styles.activeChatCardContent}>
                      <Text size="sm" bold numberOfLines={1} style={{ color: SESSIONS_UI.primary }}>
                        Active Chat
                      </Text>
                      <Text size="xs" className="mt-0.5" style={{ color: SESSIONS_UI.textSecondary }}>
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
                          showAlert("Workspace", fullPath, [{ text: "OK" }]);
                        }
                      }}
                      style={[styles.menuHeader, isExpanded && { borderLeftWidth: 3, borderLeftColor: SESSIONS_UI.primary }]}
                      accessibilityLabel={`${lastName} workspace, ${runningCount} running, ${idlingCount} idling, ${isExpanded ? "expanded" : "collapsed"}`}
                      accessibilityRole="button"
                    >
                      <Box style={styles.menuHeaderChevron}>
                        {isExpanded ? (
                          <ChevronDownIcon size={18} color={SESSIONS_UI.textSecondary} strokeWidth={1.8} />
                        ) : (
                          <ChevronRightIcon size={18} color={SESSIONS_UI.textSecondary} strokeWidth={1.8} />
                        )}
                      </Box>
                      <Text size="sm" bold className="flex-1 min-w-0" style={{ color: SESSIONS_UI.textPrimary }}>
                        {lastName}
                      </Text>
                      <HStack space="xs" className="ml-1 gap-2 flex-row items-center shrink-0">
                        <Box style={styles.countBadge}>
                          <Text size="xs" bold style={{ color: SESSIONS_UI.textSecondary }}>
                            {section.data.length}
                          </Text>
                        </Box>
                        {fullPath !== "(no workspace)" && (
                          <Button
                            action="default"
                            variant="link"
                            size="sm"
                            onPress={() => handleDestroyWorkspace(fullPath)}
                            accessibilityLabel={`Destroy workspace ${lastName}`}
                            className="min-w-11 min-h-11"
                          >
                            <ButtonIcon as={TrashIcon} size="sm" style={{ color: SESSIONS_UI.textTertiary }} />
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
                              <SessionListItemCard
                                item={item}
                                isActive={isActive}
                                isLoading={isLoading}
                                relativeDisplayPath={
                                  fullPath === "(no workspace)" ? "(no workspace)" : (getFileName(fullPath) || fullPath)
                                }
                                modelLabel={modelDisplayName(item.model)}
                                dateText={formatDate(item.lastAccess)}
                                accentColor={SESSIONS_UI.primary}
                                borderColor={SESSIONS_UI.border}
                                textSecondary={SESSIONS_UI.textSecondary}
                                textTertiary={SESSIONS_UI.textTertiary}
                                surfaceColor={SESSIONS_UI.surface}
                                dangerColor={SESSIONS_UI.textTertiary}
                                onOpenSession={handleSelect}
                                onDeleteSession={handleDelete}
                              />
                            </EntranceAnimation>
                          );
                        })}
                      </Box>
                    )}
                  </Box>
                );
              })}
            </ScrollView>
          </AsyncStateView>
        </SafeAreaView>
      </Box>
    </ModalScaffold>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: SESSIONS_UI.background,
    },
    safe: {
      flex: 1,
    },
    headerActions: {
      gap: spacing["1"],
      alignItems: "center",
    },
    headerIconButton: {
      minWidth: 44,
      minHeight: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: SESSIONS_UI.border,
      backgroundColor: SESSIONS_UI.surface,
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
    workspaceSection: {
      marginTop: INTERNAL_GAP,
      paddingBottom: SECTION_GAP,
      gap: INTERNAL_GAP,
    },
    sectionLabel: {
      marginHorizontal: spacing["5"],
      marginBottom: INTERNAL_GAP,
      color: SESSIONS_UI.textSecondary,
    },
    sectionHeaderRow: {
      marginHorizontal: spacing["5"],
      marginBottom: INTERNAL_GAP,
      alignItems: "center",
      justifyContent: "space-between",
    },
    workspacePathContainer: {
      minHeight: 28,
      justifyContent: "center",
      paddingHorizontal: spacing["4"],
      paddingVertical: spacing["4"],
    },
    workspacePathRow: {
      flexDirection: "column",
      alignItems: "flex-start",
      gap: spacing["2"],
    },
    cwdPathBox: {
      width: "100%",
      borderWidth: 1,
      borderColor: SESSIONS_UI.border,
      backgroundColor: SESSIONS_UI.surface,
      paddingHorizontal: spacing["3"],
      paddingVertical: spacing["2"],
      minHeight: 56,
      justifyContent: "center",
    },
    cwdPathText: {
      minWidth: 0,
      flexShrink: 1,
      fontFamily: uiMonoFontFamily,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "400",
      letterSpacing: 0.1,
      color: SESSIONS_UI.textPrimary,
    },
    workspaceBox: {
      marginHorizontal: spacing["5"],
      borderRadius: 12,
      borderWidth: 1,
      borderColor: SESSIONS_UI.border,
      backgroundColor: SESSIONS_UI.surface,
    },
    workspaceActions: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: INTERNAL_GAP,
      borderTopWidth: 1,
      borderTopColor: SESSIONS_UI.border,
      paddingHorizontal: spacing["4"],
      paddingTop: INTERNAL_GAP,
      paddingBottom: spacing["4"],
    },
    workspaceActionWrap: {
      flex: 1,
      minWidth: 0,
    },
    workspaceActionButtonPrimary: {
      width: "100%",
      height: 48,
      borderRadius: 10,
      backgroundColor: SESSIONS_UI.primary,
    },
    workspaceActionButtonSecondary: {
      width: "100%",
      height: 48,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: SESSIONS_UI.border,
      backgroundColor: SESSIONS_UI.surface,
    },
    scrollView: {
      flex: 1,
      backgroundColor: "transparent",
    },
    list: {
      paddingHorizontal: spacing["5"],
      paddingBottom: spacing["8"],
      paddingTop: INTERNAL_GAP,
      gap: INTERNAL_GAP,
    },
    menuSection: {
      position: "relative",
    },
    menuHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing["3"],
      paddingHorizontal: spacing["3"],
      marginBottom: spacing["2"],
      borderRadius: 12,
      borderWidth: 1,
      borderColor: SESSIONS_UI.border,
      backgroundColor: SESSIONS_UI.surface,
      minHeight: 52,
      position: "relative",
    },
    menuHeaderChevron: {
      width: 24,
      height: 24,
      marginRight: spacing["2"],
      alignItems: "center",
      justifyContent: "center",
    },
    countBadge: {
      paddingHorizontal: spacing["2"],
      paddingVertical: spacing["0.5"],
      borderRadius: 8,
      borderWidth: 1,
      borderColor: SESSIONS_UI.border,
      backgroundColor: "#f9fafb",
      minWidth: 28,
      alignItems: "center",
    },
    menuContent: {
      paddingLeft: spacing["3"],
      paddingRight: spacing["2"],
      paddingTop: spacing["1"],
      paddingBottom: spacing["2"],
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
    activeChatCard: {
      padding: spacing["3"],
      borderRadius: 12,
      backgroundColor: SESSIONS_UI.surface,
      borderWidth: 1,
      borderColor: SESSIONS_UI.border,
      marginBottom: spacing["3"],
    },
    activeChatCardContent: {
      flex: 1,
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
    emptySubtitle: {
      lineHeight: 22,
      maxWidth: 280,
      opacity: 0.9,
    },
  });
}
