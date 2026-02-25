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
} from "@/design-system";
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
import { useTheme } from "@/theme/index";
import { showAlert } from "@/components/ui/alert/native-alert";
import {
  TrashIcon,
  RefreshCwIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  PlayIcon,
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

const APP_SURFACE_BG = "#eceef2";
const APP_CARD_BG = "#ffffff";
const APP_CARD_BORDER = "#dde1e8";
const APP_TEXT_PRIMARY = "#1f2937";
const APP_TEXT_SECONDARY = "#697386";
const APP_TEXT_TERTIARY = "#8b94a6";
const APP_ACCENT = "#d98300";
const APP_RUNNING = "#37b37e";

const SOFT_LAYOUT_ANIMATION = {
  duration: 160,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: {
    type: LayoutAnimation.Types.easeInEaseOut,
  },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
};

/** Get relative path from root to fullPath. */
function getRelativePath(fullPath: string, root: string): string {
  const rootNorm = root.replace(/\/$/, "");
  if (fullPath === rootNorm || fullPath === root) return "";
  if (fullPath.startsWith(rootNorm + "/")) {
    return fullPath.slice(rootNorm.length + 1);
  }
  return fullPath;
}

function displayWorkspace(cwd: string | null | undefined, fallbackWorkspace?: string | null): string {
  const raw = (typeof cwd === "string" && cwd.trim())
    ? cwd.trim()
    : ((fallbackWorkspace ?? "").trim() || "(no workspace)");
  return raw === "(no workspace)" ? raw : (getFileName(raw) || raw);
}

function formatSessionTime(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return "—";
  }
}

function formatModelLabel(model: string | null | undefined): string {
  const raw = (model ?? "").trim();
  if (!raw) return "MODEL N/A";
  return raw.replace(/^models\//i, "").toUpperCase();
}

type WorkspaceSessionGroup = {
  key: string;
  sessions: ApiSession[];
  latestAccess: number;
};

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
  const uiColors = useMemo(
    () => ({
      accent: APP_ACCENT,
      textInverse: "#ffffff",
    }),
    []
  );

  const sessions = useSessionManagementStore((state) => state.sessionStatuses);
  const removeSessionStatus = useSessionManagementStore((state) => state.removeSessionStatus);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [allowedRoot, setAllowedRoot] = useState<string | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
      setSelectError(null);
      setListError(null);
      setShowAllSessions(false);
      setCollapsedGroups({});
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
  const workspaceDisplayPath = useMemo(
    () => (
      allowedRoot && workspacePath
        ? (currentRelativePath || "(root)")
        : (workspacePath ?? "—")
    ),
    [allowedRoot, workspacePath, currentRelativePath]
  );

  const workspacePreviewPrefix = useMemo(() => {
    const normalized = workspaceDisplayPath.replace(/^\/*/, "");
    const first = normalized.split("/").filter(Boolean)[0];
    return first ? `~/${first}/` : "~/";
  }, [workspaceDisplayPath]);

  const groupedSessions = useMemo(() => {
    const byWorkspace = new Map<string, ApiSession[]>();
    for (const session of sessions) {
      const path = (typeof session.cwd === "string" && session.cwd.trim())
        ? session.cwd.trim()
        : ((workspacePath ?? "").trim() || "(no workspace)");
      if (!byWorkspace.has(path)) byWorkspace.set(path, []);
      byWorkspace.get(path)!.push(session);
    }

    const currentWorkspace = (workspacePath ?? "").trim();
    const groups: WorkspaceSessionGroup[] = Array.from(byWorkspace.entries()).map(([key, data]) => {
      const sorted = [...data].sort((a, b) => b.lastAccess - a.lastAccess);
      return {
        key,
        sessions: sorted,
        latestAccess: sorted[0]?.lastAccess ?? 0,
      };
    });

    groups.sort((a, b) => {
      if (currentWorkspace) {
        if (a.key === currentWorkspace && b.key !== currentWorkspace) return -1;
        if (b.key === currentWorkspace && a.key !== currentWorkspace) return 1;
      }
      return b.latestAccess - a.latestAccess;
    });

    return groups;
  }, [sessions, workspacePath]);

  const totalSessionCount = useMemo(
    () => groupedSessions.reduce((acc, group) => acc + group.sessions.length, 0),
    [groupedSessions]
  );
  const showViewAllToggle = useMemo(() => {
    if (groupedSessions.length > 1) return true;
    const firstGroupSize = groupedSessions[0]?.sessions.length ?? 0;
    return firstGroupSize > 3;
  }, [groupedSessions]);
  const visibleGroups = useMemo(() => {
    if (showAllSessions) return groupedSessions;
    const primary = groupedSessions[0];
    if (!primary) return [];
    return [
      {
        ...primary,
        sessions: primary.sessions.slice(0, 3),
      },
    ];
  }, [showAllSessions, groupedSessions]);
  const groupedSessionsByKey = useMemo(
    () => new Map(groupedSessions.map((group) => [group.key, group])),
    [groupedSessions]
  );

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
  }, []);

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
      if (!serverBaseUrl) {
        setSelectError("Server URL is unavailable");
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
        .then((data: { messages?: Message[]; sessionId?: string; activeSessionId?: string; provider?: string | null; model?: string | null; running?: boolean; sseConnected?: boolean; cwd?: string | null }) => {
          const messages = data.messages ?? [];
          const canonicalId = data.sessionId ?? session.id;
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
                LayoutAnimation.configureNext(SOFT_LAYOUT_ANIMATION);
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

  const handleToggleGroup = useCallback((groupKey: string) => {
    LayoutAnimation.configureNext(SOFT_LAYOUT_ANIMATION);
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  }, []);

  const handleDeleteWorkspaceSessions = useCallback(
    (group: WorkspaceSessionGroup) => {
      const groupLabel = displayWorkspace(group.key, workspacePath);
      const sessionCount = group.sessions.length;
      triggerHaptic("medium");
      showAlert(
        "Delete workspace sessions",
        `Remove ${sessionCount} session${sessionCount === 1 ? "" : "s"} in "${groupLabel}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              if (!serverBaseUrl) return;
              try {
                const ids = group.sessions.map((session) => session.id);
                const results = await Promise.all(
                  ids.map(async (id) => {
                    const res = await fetch(`${serverBaseUrl}/api/sessions/${encodeURIComponent(id)}`, {
                      method: "DELETE",
                    });
                    return { id, ok: res.ok };
                  })
                );
                const failed = results.find((result) => !result.ok);
                if (failed) throw new Error("Delete failed");

                LayoutAnimation.configureNext(SOFT_LAYOUT_ANIMATION);
                for (const { id } of results) {
                  removeSessionStatus(id);
                }
                if (currentSessionId && ids.includes(currentSessionId)) {
                  onNewSession();
                }
                triggerHaptic("success");
              } catch {
                setSelectError("Failed to delete workspace sessions");
              }
            },
          },
        ]
      );
    },
    [serverBaseUrl, currentSessionId, onNewSession, removeSessionStatus, workspacePath]
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
            variant="outline"
            size="sm"
            onPress={() => void refresh(false)}
            accessibilityLabel="Refresh sessions"
            style={styles.headerIconButton}
            className="min-w-11 min-h-11"
          >
            <ButtonIcon as={RefreshCwIcon} size="sm" style={styles.headerIconColor} />
          </Button>
          <Button
            action="default"
            variant="outline"
            size="sm"
            onPress={onClose}
            accessibilityLabel="Close sessions"
            style={styles.headerIconButton}
            className="min-w-11 min-h-11"
          >
            <ButtonIcon as={CloseIcon} size="sm" style={styles.headerIconColor} />
          </Button>
        </HStack>
      }
    >
      <Box style={styles.container}>
        <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
          {(selectError || listError) && (
            <EntranceAnimation variant="fade" duration={140}>
              <HStack style={styles.errorBanner}>
                <Text size="sm" className="text-error-600 flex-1">{selectError ?? listError}</Text>
                {listError && (
                  <AnimatedPressableView
                    onPress={() => void refresh(false)}
                    haptic="light"
                    style={styles.retryButton}
                    accessibilityLabel="Retry loading sessions"
                  >
                    <RefreshCwIcon size={16} color={uiColors.accent} strokeWidth={1.8} />
                    <Text size="sm" bold style={{ color: uiColors.accent }}>
                      Retry
                    </Text>
                  </AnimatedPressableView>
                )}
              </HStack>
            </EntranceAnimation>
          )}

          <VStack style={styles.introSection}>
            <Text size="sm" style={styles.sectionIntroTitle}>
              Session Management
            </Text>
            <Text size="xs" style={styles.sectionIntroText}>
              Choose your workspace, start a new session, or jump back into recent work.
            </Text>
          </VStack>

          <VStack style={styles.workspaceSection}>
            <Box style={styles.workspaceBox}>
              <VStack style={styles.workspacePathContainer}>
                <Text size="xs" style={styles.workspaceLabel}>
                  Current Workspace
                </Text>
                {workspaceLoading ? (
                  <SkeletonText lineHeight={16} lines={1} lastLineWidth="64%" />
                ) : (
                  <Box style={styles.cwdPathBox}>
                    <HStack style={styles.cwdPathTopRow}>
                      <Text size="xs" style={styles.cwdPreviewPrefix}>
                        {workspacePreviewPrefix}
                      </Text>
                      <HStack style={styles.cwdDots}>
                        <Box style={[styles.cwdDot, styles.cwdDotAmber]} />
                        <Box style={[styles.cwdDot, styles.cwdDotYellow]} />
                        <Box style={[styles.cwdDot, styles.cwdDotGreen]} />
                      </HStack>
                    </HStack>
                    <Text
                      size="xs"
                      numberOfLines={3}
                      ellipsizeMode="tail"
                      style={styles.cwdPathText}
                    >
                      {formatPathForWrap(workspaceDisplayPath)}
                    </Text>
                  </Box>
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
                      <ButtonText style={styles.secondaryActionText}>
                        Change Workspace
                      </ButtonText>
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
                    <ButtonIcon as={PlayIcon} size="xs" style={{ color: uiColors.textInverse }} />
                    <ButtonText style={styles.primaryActionText}>Start Session</ButtonText>
                  </Button>
                </Box>
              </HStack>
            </Box>
          </VStack>

          <HStack style={styles.recentHeaderRow}>
            <VStack style={styles.recentHeaderText}>
              <Text size="sm" style={styles.recentHeaderTitle}>Recent Sessions</Text>
              <Text size="xs" style={styles.recentHeaderHint}>Grouped by workspace</Text>
            </VStack>
            {showViewAllToggle && (
              <Pressable
                onPress={() => setShowAllSessions((prev) => !prev)}
                style={({ pressed }) => [
                  styles.viewAllButton,
                  pressed && styles.viewAllButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={showAllSessions ? "Show fewer sessions" : "View all sessions"}
              >
                <Text size="sm" style={styles.viewAllText}>
                  {showAllSessions ? "View Less" : "View All"}
                </Text>
              </Pressable>
            )}
          </HStack>

          <AsyncStateView
            isLoading={loading && !listError}
            error={totalSessionCount === 0 && !showActiveChat ? listError : null}
            isEmpty={totalSessionCount === 0 && !showActiveChat && !listError}
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
                  tintColor={uiColors.accent}
                  colors={[uiColors.accent]}
                />
              }
              showsVerticalScrollIndicator={false}
            >
              {showActiveChat && onSelectActiveChat && (
                <EntranceAnimation variant="fade" delay={60} duration={150}>
                  <Pressable
                    onPress={onSelectActiveChat}
                    style={({ pressed }) => [
                      styles.activeChatCard,
                      pressed && styles.pressState,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Open active chat"
                    accessibilityHint="Switches back to the currently active live chat"
                  >
                    <Box style={[styles.sessionStatusDot, styles.sessionStatusDotActive]} />
                    <VStack style={styles.activeChatCardContent}>
                      <Text size="sm" style={styles.activeChatTitle}>
                        Active Chat
                      </Text>
                      <Text size="xs" style={styles.activeChatSubtitle}>
                        {sessionRunning ? "Receiving updates now" : "Tap to resume"}
                      </Text>
                    </VStack>
                    <ChevronRightIcon size={18} color={APP_TEXT_TERTIARY} strokeWidth={1.8} />
                  </Pressable>
                </EntranceAnimation>
              )}

              {visibleGroups.map((group, groupIndex) => (
                <VStack key={group.key} style={styles.workspaceGroupSection}>
                  <HStack style={styles.workspaceGroupLabelRow}>
                    <Text size="xs" numberOfLines={1} style={styles.workspaceGroupLabel}>
                      {displayWorkspace(group.key, workspacePath)}
                    </Text>
                    <Text size="xs" style={styles.workspaceGroupMeta}>
                      {group.sessions.length}
                    </Text>
                  </HStack>

                  {group.sessions.map((item, index) => {
                    const isLoading = loadingSessionId === item.id;
                    const isActive = item.id === currentSessionId;
                    const statusRunning = item.status === "running";
                    const showDeleteAction = statusRunning || isActive;
                    const workspaceInfo = displayWorkspace(item.cwd, workspacePath);

                    return (
                      <EntranceAnimation
                        key={item.id}
                        variant="slideUp"
                        delay={24 * ((groupIndex + index) % 8)}
                        duration={150}
                      >
                        <Pressable
                          onPress={() => handleSelect(item)}
                          onLongPress={() => handleDelete(item)}
                          delayLongPress={280}
                          disabled={isLoading}
                          style={({ pressed }) => [
                            styles.sessionCard,
                            isActive && styles.sessionCardActive,
                            isLoading && styles.sessionCardLoading,
                            pressed && styles.pressState,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Open session ${item.title || "(No Input)"}`}
                          accessibilityHint="Loads this session. Long press to delete."
                        >
                          <Box style={styles.sessionIconBox}>
                            {statusRunning ? (
                              <TerminalIcon color={APP_TEXT_SECONDARY} size={18} strokeWidth={1.8} />
                            ) : index % 2 === 0 ? (
                              <FolderIcon color={APP_TEXT_SECONDARY} />
                            ) : (
                              <SessionManagementIcon color={APP_TEXT_SECONDARY} size={16} strokeWidth={1.8} />
                            )}
                          </Box>

                          <VStack style={styles.sessionTextWrap}>
                            <Text size="xs" numberOfLines={1} style={styles.sessionTitle}>
                              {item.title || "(No Input)"}
                            </Text>
                            <HStack style={styles.sessionInfoRow}>
                              <Text size="xs" numberOfLines={1} style={styles.sessionWorkspaceText}>
                                {workspaceInfo}
                              </Text>
                              <Text size="xs" style={styles.sessionInfoSeparator}>|</Text>
                              <Text size="xs" numberOfLines={1} style={styles.sessionIdText}>
                                {shortSessionId(item.id)}
                              </Text>
                            </HStack>
                            <HStack style={styles.sessionMetaRow}>
                              <Box
                                style={[
                                  styles.sessionStatusDot,
                                  statusRunning ? styles.sessionStatusDotActive : styles.sessionStatusDotIdle,
                                ]}
                              />
                              <Text size="xs" style={[styles.sessionStatusText, statusRunning && styles.sessionStatusTextActive]}>
                                {statusRunning ? "Active" : "Idle"}
                              </Text>
                              <Text size="xs" style={styles.sessionEditedText}>
                                {`Edited ${formatRelativeAge(item.lastAccess)}`}
                              </Text>
                            </HStack>
                          </VStack>

                          <HStack style={styles.sessionRightRail}>
                            <Box style={styles.sessionCountBadge}>
                              <Text size="xs" style={styles.sessionCountText}>
                                {getSessionCountBadge(item)}
                              </Text>
                            </Box>
                            {showDeleteAction ? (
                              <Button
                                action="default"
                                variant="outline"
                                size="sm"
                                onPress={() => handleDelete(item)}
                                accessibilityLabel="Delete session"
                                className="min-w-9 min-h-9"
                                style={styles.sessionDeleteButton}
                              >
                                <ButtonIcon as={TrashIcon} size="xs" style={styles.sessionDeleteIcon} />
                              </Button>
                            ) : (
                              <Box style={styles.sessionChevronWrap}>
                                <ChevronRightIcon size={15} color={APP_TEXT_TERTIARY} strokeWidth={1.9} />
                              </Box>
                            )}
                          </HStack>
                        </Pressable>
                      </EntranceAnimation>
                    );
                  })}
                </VStack>
              ))}
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
      backgroundColor: APP_SURFACE_BG,
    },
    safe: {
      flex: 1,
    },
    headerActions: {
      gap: spacing["2"],
      alignItems: "center",
    },
    headerIconButton: {
      minWidth: 44,
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: APP_CARD_BORDER,
      backgroundColor: "#f8f9fb",
    },
    headerIconColor: {
      color: APP_TEXT_SECONDARY,
    },
    introSection: {
      marginTop: spacing["3"],
      marginHorizontal: spacing["5"],
      marginBottom: spacing["3"],
      gap: spacing["1"],
    },
    sectionIntroTitle: {
      color: APP_TEXT_TERTIARY,
      fontWeight: "700",
      fontSize: 12,
      letterSpacing: 1.2,
      lineHeight: 16,
      textTransform: "uppercase",
    },
    sectionIntroText: {
      color: APP_TEXT_SECONDARY,
      lineHeight: 16,
      fontSize: 11,
    },
    errorBanner: {
      padding: spacing["3"],
      marginHorizontal: spacing["5"],
      marginTop: spacing["2"],
      backgroundColor: theme.colors.danger + "12",
      borderRadius: 14,
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
      paddingBottom: spacing["4"],
    },
    workspaceBox: {
      marginHorizontal: spacing["5"],
      borderRadius: 18,
      borderWidth: 1,
      borderColor: APP_CARD_BORDER,
      backgroundColor: APP_CARD_BG,
      shadowColor: "#0f172a",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 2,
    },
    workspacePathContainer: {
      justifyContent: "center",
      paddingHorizontal: spacing["4"],
      paddingTop: spacing["3"],
      paddingBottom: spacing["2"],
      gap: spacing["2"],
    },
    workspaceLabel: {
      color: APP_TEXT_TERTIARY,
      fontWeight: "700",
      fontSize: 12,
      letterSpacing: 0.9,
      lineHeight: 16,
      textTransform: "uppercase",
    },
    cwdPathBox: {
      width: "100%",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: APP_CARD_BORDER,
      backgroundColor: "#f5f7fa",
      paddingHorizontal: spacing["3"],
      paddingVertical: spacing["2"],
      minHeight: 72,
      justifyContent: "center",
      gap: spacing["1"],
    },
    cwdPathTopRow: {
      alignItems: "center",
      justifyContent: "space-between",
    },
    cwdPreviewPrefix: {
      color: APP_TEXT_TERTIARY,
      fontFamily: uiMonoFontFamily,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "500",
    },
    cwdDots: {
      gap: spacing["1"],
      alignItems: "center",
    },
    cwdDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
    },
    cwdDotAmber: {
      backgroundColor: "#f4a6a0",
    },
    cwdDotYellow: {
      backgroundColor: "#f2d28c",
    },
    cwdDotGreen: {
      backgroundColor: "#9dd6ab",
    },
    cwdPathText: {
      minWidth: 0,
      flexShrink: 1,
      fontFamily: uiMonoFontFamily,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "700",
      letterSpacing: 0.1,
      color: "#5a66d1",
    },
    workspaceActions: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: spacing["3"],
      paddingHorizontal: spacing["4"],
      paddingBottom: spacing["4"],
    },
    workspaceActionWrap: {
      flex: 1,
      minWidth: 0,
    },
    workspaceActionButtonPrimary: {
      width: "100%",
      height: 56,
      borderRadius: 14,
      backgroundColor: APP_ACCENT,
      gap: spacing["2"],
    },
    workspaceActionButtonSecondary: {
      width: "100%",
      height: 56,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: APP_CARD_BORDER,
      backgroundColor: APP_CARD_BG,
    },
    secondaryActionText: {
      color: APP_TEXT_PRIMARY,
      fontWeight: "500",
      fontSize: 13,
      lineHeight: 16,
      textAlign: "center",
    },
    primaryActionText: {
      color: "#ffffff",
      fontWeight: "700",
      fontSize: 13,
      lineHeight: 16,
    },
    recentHeaderRow: {
      marginHorizontal: spacing["5"],
      marginTop: spacing["2"],
      marginBottom: spacing["2"],
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: spacing["3"],
    },
    recentHeaderText: {
      gap: spacing["0.5"],
    },
    recentHeaderTitle: {
      color: APP_TEXT_TERTIARY,
      fontWeight: "700",
      fontSize: 12,
      letterSpacing: 1.1,
      lineHeight: 16,
      textTransform: "uppercase",
    },
    recentHeaderHint: {
      color: APP_TEXT_SECONDARY,
      lineHeight: 16,
      fontSize: 11,
    },
    viewAllButton: {
      paddingVertical: spacing["1"],
      paddingHorizontal: spacing["2"],
      borderRadius: 8,
    },
    viewAllButtonPressed: {
      opacity: 0.75,
    },
    viewAllText: {
      color: APP_ACCENT,
      fontWeight: "500",
      fontSize: 12,
      lineHeight: 16,
    },
    scrollView: {
      flex: 1,
      backgroundColor: "transparent",
    },
    list: {
      paddingHorizontal: spacing["5"],
      paddingBottom: spacing["8"],
      paddingTop: spacing["2"],
      gap: spacing["3"],
    },
    workspaceGroupSection: {
      gap: spacing["2"],
    },
    workspaceGroupLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing["1"],
    },
    workspaceGroupLabel: {
      color: APP_TEXT_SECONDARY,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "700",
      letterSpacing: 0.3,
      textTransform: "uppercase",
      flex: 1,
      minWidth: 0,
    },
    workspaceGroupMeta: {
      color: APP_TEXT_TERTIARY,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "600",
    },
    activeChatCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: APP_CARD_BORDER,
      backgroundColor: APP_CARD_BG,
      paddingHorizontal: spacing["3"],
      paddingVertical: spacing["3"],
      flexDirection: "row",
      alignItems: "center",
      gap: spacing["2"],
      shadowColor: "#0f172a",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 5,
      elevation: 1,
    },
    activeChatCardContent: {
      flex: 1,
      gap: spacing["0.5"],
    },
    activeChatTitle: {
      color: APP_TEXT_PRIMARY,
      fontWeight: "700",
    },
    activeChatSubtitle: {
      color: APP_TEXT_SECONDARY,
    },
    sessionCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: APP_CARD_BORDER,
      backgroundColor: APP_CARD_BG,
      paddingHorizontal: spacing["3"],
      paddingVertical: spacing["3"],
      minHeight: 80,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing["3"],
      shadowColor: "#0f172a",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 5,
      elevation: 1,
    },
    sessionCardActive: {
      borderColor: "#d6dbe4",
      backgroundColor: "#fdfefe",
    },
    sessionCardLoading: {
      opacity: 0.65,
    },
    pressState: {
      opacity: 0.92,
      transform: [{ scale: 0.995 }],
    },
    sessionIconBox: {
      width: 42,
      height: 42,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: APP_CARD_BORDER,
      backgroundColor: "#f4f6f9",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    sessionTextWrap: {
      flex: 1,
      minWidth: 0,
      gap: spacing["1"],
    },
    sessionTitle: {
      color: APP_TEXT_PRIMARY,
      fontWeight: "700",
      fontSize: 13,
      lineHeight: 16,
      fontFamily: uiMonoFontFamily,
    },
    sessionInfoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing["1"],
      minWidth: 0,
    },
    sessionWorkspaceText: {
      color: APP_TEXT_SECONDARY,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "500",
      flexShrink: 1,
      minWidth: 0,
    },
    sessionInfoSeparator: {
      color: APP_TEXT_TERTIARY,
      fontSize: 11,
      lineHeight: 14,
      opacity: 0.8,
    },
    sessionIdText: {
      color: APP_TEXT_TERTIARY,
      fontSize: 11,
      lineHeight: 14,
      fontFamily: uiMonoFontFamily,
      flexShrink: 1,
      minWidth: 0,
    },
    sessionMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing["1"],
      minWidth: 0,
    },
    sessionStatusDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      flexShrink: 0,
    },
    sessionStatusDotActive: {
      backgroundColor: APP_RUNNING,
    },
    sessionStatusDotIdle: {
      backgroundColor: "#c8ced9",
    },
    sessionStatusText: {
      color: APP_TEXT_TERTIARY,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "500",
    },
    sessionStatusTextActive: {
      color: APP_RUNNING,
    },
    sessionEditedText: {
      color: APP_TEXT_TERTIARY,
      fontSize: 11,
      lineHeight: 14,
      flexShrink: 1,
    },
    sessionRightRail: {
      alignItems: "center",
      justifyContent: "center",
      gap: spacing["2"],
      marginLeft: spacing["1"],
    },
    sessionCountBadge: {
      minWidth: 28,
      paddingVertical: spacing["0.5"],
      paddingHorizontal: spacing["2"],
      borderRadius: 8,
      borderWidth: 1,
      borderColor: APP_CARD_BORDER,
      backgroundColor: "#f6f8fb",
      alignItems: "center",
    },
    sessionCountText: {
      color: APP_TEXT_SECONDARY,
      fontSize: 12,
      lineHeight: 14,
      fontWeight: "600",
    },
    sessionChevronWrap: {
      width: 28,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    sessionDeleteButton: {
      width: 32,
      height: 32,
      minWidth: 32,
      minHeight: 32,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: APP_CARD_BORDER,
      backgroundColor: APP_CARD_BG,
    },
    sessionDeleteIcon: {
      color: APP_TEXT_TERTIARY,
    },
  });
}
