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

const APP_SURFACE_BG = "rgba(10, 15, 30, 0.4)";
const APP_CARD_BG = "rgba(15, 25, 45, 0.5)";
const APP_CARD_BORDER = "#00f0ff";
const APP_TEXT_PRIMARY = "#ffffff";
const APP_TEXT_SECONDARY = "#88e0e0";
const APP_TEXT_TERTIARY = "#44dfdf";
const APP_ACCENT = "#ff00e5";
const APP_RUNNING = "#ff00e5";

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
  const [refreshPressed, setRefreshPressed] = useState(false);
  const [closePressed, setClosePressed] = useState(false);
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
      title={
        <VStack>
          <Text style={styles.mainTitle}>Session Management</Text>
          <Text size="xs" style={styles.headerSubtitle}>
            DATASET // INTERFACE // V0.4.2
          </Text>
        </VStack>
      }
      contentClassName="w-full h-full max-w-none rounded-none border-0 p-0 bg-transparent"
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
            onPressIn={() => setRefreshPressed(true)}
            onPressOut={() => setRefreshPressed(false)}
            accessibilityLabel="Refresh sessions"
            style={[styles.headerIconButton, refreshPressed && styles.headerIconButtonPressed]}
            className="min-w-11 min-h-11"
          >
            <ButtonIcon as={RefreshCwIcon} size="sm" color={styles.headerIconColor.color} />
          </Button>
          <Button
            action="default"
            variant="outline"
            size="sm"
            onPress={onClose}
            onPressIn={() => setClosePressed(true)}
            onPressOut={() => setClosePressed(false)}
            accessibilityLabel="Close sessions"
            style={[styles.headerIconButton, closePressed && styles.headerIconButtonPressed]}
            className="min-w-11 min-h-11"
          >
            <ButtonIcon as={CloseIcon} size="sm" color={styles.headerIconColor.color} />
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

              {visibleGroups.map((group, groupIndex) => {
                const fullGroup = groupedSessionsByKey.get(group.key) ?? group;
                const isCollapsed = Boolean(collapsedGroups[group.key]);
                const groupCount = fullGroup.sessions.length;

                return (
                  <VStack key={group.key} style={styles.workspaceGroupSection}>
                    <Pressable
                      onPress={() => handleToggleGroup(group.key)}
                      style={({ pressed }) => [
                        styles.workspaceGroupCard,
                        pressed && styles.pressState,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`${isCollapsed ? "Expand" : "Collapse"} workspace ${displayWorkspace(group.key, workspacePath)}`}
                    >
                      <HStack style={styles.workspaceGroupCardLeft}>
                        {isCollapsed ? (
                          <ChevronRightIcon size={17} color={APP_TEXT_SECONDARY} strokeWidth={2} />
                        ) : (
                          <ChevronDownIcon size={17} color={APP_TEXT_SECONDARY} strokeWidth={2} />
                        )}
                        <Text size="sm" numberOfLines={1} style={styles.workspaceGroupLabel}>
                          {displayWorkspace(group.key, workspacePath)}
                        </Text>
                      </HStack>
                      <HStack style={styles.workspaceGroupCardRight}>
                        <Box style={styles.workspaceGroupMetaBadge}>
                          <Text size="xs" style={styles.workspaceGroupMetaText}>
                            {groupCount}
                          </Text>
                        </Box>
                        <Button
                          action="default"
                          variant="link"
                          size="sm"
                          onPress={(event) => {
                            event.stopPropagation?.();
                            handleDeleteWorkspaceSessions(fullGroup);
                          }}
                          accessibilityLabel="Delete workspace sessions"
                          className="min-w-11 min-h-11"
                          style={styles.workspaceDeleteButton}
                        >
                          <ButtonIcon as={TrashIcon} size={17} style={styles.workspaceDeleteIcon} />
                        </Button>
                      </HStack>
                    </Pressable>

                    {!isCollapsed && group.sessions.map((item, index) => {
                      const isLoading = loadingSessionId === item.id;
                      const isActive = item.id === currentSessionId;
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
                            <VStack style={styles.sessionContent}>
                              <Text size="sm" numberOfLines={1} style={styles.sessionTitle}>
                                {item.title || "(No Input)"}
                              </Text>
                              <HStack style={styles.sessionWorkspaceRow}>
                                <Text size="xs" numberOfLines={1} style={styles.sessionWorkspaceText}>
                                  {workspaceInfo}
                                </Text>
                                <Text size="xs" style={styles.sessionInfoSeparator}>|</Text>
                              </HStack>
                              <HStack style={styles.sessionIdRow}>
                                <Text size="xs" numberOfLines={1} style={styles.sessionIdText}>
                                  {item.id}
                                </Text>
                                <Text size="xs" style={styles.sessionInfoSeparator}>|</Text>
                                <Button
                                  action="default"
                                  variant="link"
                                  size="sm"
                                  onPress={(event) => {
                                    event.stopPropagation?.();
                                    handleDelete(item);
                                  }}
                                  accessibilityLabel="Delete session"
                                  className="min-w-11 min-h-11"
                                  style={styles.sessionDeleteButton}
                                >
                                  <ButtonIcon as={TrashIcon} size={17} style={styles.sessionDeleteIcon} />
                                </Button>
                              </HStack>
                              <HStack style={styles.sessionFooterRow}>
                                <Text size="xs" style={styles.sessionTimeText}>
                                  {formatSessionTime(item.lastAccess)}
                                </Text>
                                <Text size="xs" numberOfLines={1} style={styles.sessionModelText}>
                                  {formatModelLabel(item.model)}
                                </Text>
                              </HStack>
                            </VStack>
                          </Pressable>
                        </EntranceAnimation>
                      );
                    })}
                  </VStack>
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
    container: { flex: 1, backgroundColor: "rgba(5, 10, 20, 0.45)" },
    mainTitle: {
      color: "#ffffff",
      fontSize: 18,
      fontWeight: "900",
      letterSpacing: 1.5,
      textTransform: "uppercase",
      fontFamily: uiMonoFontFamily,
      textShadowColor: "rgba(0, 229, 255, 0.9)",
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 12,
    },
    headerSubtitle: {
      color: "rgba(0, 229, 255, 0.6)",
      fontFamily: uiMonoFontFamily,
      fontSize: 10,
      fontWeight: "600",
      marginTop: -2,
      letterSpacing: 1,
    },
    safe: { flex: 1 },
    headerActions: { gap: spacing["3"], alignItems: "center", marginRight: spacing["5"] },
    headerIconButton: {
      minWidth: 44, minHeight: 44, borderRadius: 12, borderWidth: 1,
      borderColor: "rgba(0, 229, 255, 0.85)", backgroundColor: "rgba(0, 24, 46, 0.9)",
      shadowColor: "#00e5ff",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 2,
    },
    headerIconButtonPressed: {
      borderColor: "#00e5ff",
      backgroundColor: "rgba(0, 229, 255, 0.2)",
      shadowOpacity: 0.75,
      shadowRadius: 12,
      elevation: 5,
      transform: [{ scale: 0.97 }],
    },
    headerIconColor: { color: "#00e5ff" },
    errorBanner: {
      padding: spacing["3"], marginHorizontal: spacing["5"], marginTop: spacing["2"],
      backgroundColor: "rgba(255, 0, 0, 0.1)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255, 0, 0, 0.3)",
    },
    retryButton: {
      flexDirection: "row", alignItems: "center", gap: spacing["2"], marginTop: spacing["3"],
      paddingVertical: spacing["2"], paddingHorizontal: spacing["2"], alignSelf: "flex-start", minHeight: 44,
    },
    workspaceSection: { paddingBottom: spacing["6"] },
    workspaceBox: {
      marginHorizontal: spacing["5"], borderRadius: 16, borderWidth: 1.5, borderColor: "#00e5ff",
      backgroundColor: "rgba(10, 15, 40, 0.3)",
      shadowColor: "#ff00e5", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 15, elevation: 5,
    },
    workspacePathContainer: {
      justifyContent: "center", paddingHorizontal: spacing["4"], paddingTop: spacing["4"], paddingBottom: spacing["3"], gap: spacing["2"],
    },
    workspaceLabel: {
      color: "#ffffff", fontFamily: uiMonoFontFamily, fontWeight: "800", fontSize: 13, letterSpacing: 2, textTransform: "uppercase",
    },
    cwdPathBox: {
      width: "100%", borderRadius: 12, borderWidth: 1, borderColor: "#00e5ff", backgroundColor: "rgba(20, 30, 55, 0.3)",
      paddingHorizontal: spacing["3"], paddingVertical: spacing["3"], minHeight: 60, justifyContent: "center", gap: spacing["1"],
    },
    cwdPathTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    cwdPreviewPrefix: { color: "#00e5ff", fontFamily: uiMonoFontFamily, fontSize: 13, lineHeight: 18, fontWeight: "500" },
    cwdDots: { gap: spacing["1"], alignItems: "center", flexDirection: "row" },
    cwdDot: { width: 10, height: 10, borderRadius: 999 },
    cwdDotAmber: { backgroundColor: "#ff00ff", shadowColor: "#ff00ff", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6 },
    cwdDotYellow: { backgroundColor: "#ffcc00", shadowColor: "#ffcc00", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6 },
    cwdDotGreen: { backgroundColor: "#00ff66", shadowColor: "#00ff66", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6 },
    cwdPathText: {
      fontFamily: uiMonoFontFamily, fontSize: 14, lineHeight: 20, fontWeight: "600", color: "#a5f5f5", flexShrink: 1, minWidth: 0,
    },
    workspaceActions: {
      flexDirection: "row", alignItems: "center", gap: spacing["3"], paddingHorizontal: spacing["4"], paddingBottom: spacing["4"],
    },
    workspaceActionWrap: { flex: 1, minWidth: 0 },
    workspaceActionButtonPrimary: {
      width: "100%", height: 50, borderRadius: 12, backgroundColor: "#ff5e00",
      shadowColor: "#ff5e00", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 12, elevation: 4, gap: spacing["2"],
    },
    workspaceActionButtonSecondary: {
      width: "100%", height: 50, borderRadius: 12, borderWidth: 1, borderColor: "#00e5ff", backgroundColor: "rgba(20, 30, 60, 0.6)",
    },
    secondaryActionText: { color: "#ffffff", fontFamily: uiMonoFontFamily, fontWeight: "800", fontSize: 14, textAlign: "center" },
    primaryActionText: { color: "#ffffff", fontFamily: uiMonoFontFamily, fontWeight: "800", fontSize: 15 },
    recentHeaderRow: {
      marginHorizontal: spacing["5"], marginTop: spacing["2"], marginBottom: spacing["3"],
      flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: spacing["3"],
    },
    recentHeaderText: { gap: spacing["0.5"] },
    recentHeaderTitle: {
      color: "#00e5ff", fontWeight: "800", fontSize: 14, letterSpacing: 2, textTransform: "uppercase", fontFamily: uiMonoFontFamily,
      textShadowColor: "rgba(0, 229, 255, 0.6)", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8,
    },
    recentHeaderHint: { display: "none" },
    viewAllButton: { paddingVertical: spacing["1"], paddingHorizontal: spacing["2"], borderRadius: 8 },
    viewAllButtonPressed: { opacity: 0.75 },
    viewAllText: { color: "#ff00e5", fontWeight: "800", fontSize: 14, fontFamily: uiMonoFontFamily, letterSpacing: 0.5 },
    scrollView: { flex: 1, backgroundColor: "transparent" },
    list: { paddingHorizontal: spacing["5"], paddingBottom: spacing["8"], gap: spacing["3"] },
    workspaceGroupSection: { gap: spacing["2"] },
    workspaceGroupCard: {
      borderRadius: 16, borderWidth: 1, borderColor: "#00e5ff", backgroundColor: "rgba(0, 20, 35, 0.4)",
      minHeight: 64, paddingHorizontal: spacing["4"], paddingVertical: spacing["3"],
      flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing["3"],
      shadowColor: "#00e5ff", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 8,
    },
    workspaceGroupCardLeft: { flexDirection: "row", alignItems: "center", gap: spacing["3"], flex: 1, minWidth: 0 },
    workspaceGroupCardRight: { flexDirection: "row", alignItems: "center", gap: spacing["2"] },
    workspaceGroupLabel: { color: "#a5f5f5", fontSize: 15, lineHeight: 20, fontWeight: "800", fontFamily: uiMonoFontFamily },
    workspaceGroupMetaBadge: {
      minWidth: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: "#ff00e5",
      backgroundColor: "rgba(255, 0, 229, 0.15)", alignItems: "center", justifyContent: "center", paddingHorizontal: spacing["2"],
    },
    workspaceGroupMetaText: { color: "#ffffff", fontSize: 14, fontFamily: uiMonoFontFamily, fontWeight: "800" },
    workspaceDeleteButton: { width: 44, height: 44, minWidth: 44, minHeight: 44, borderRadius: 999 },
    workspaceDeleteIcon: { color: "rgba(0, 229, 255, 0.5)" },
    activeChatCard: {
      borderRadius: 16, borderWidth: 1, borderColor: "#00e5ff", backgroundColor: "rgba(0, 20, 35, 0.4)",
      paddingHorizontal: spacing["4"], paddingVertical: spacing["3"], flexDirection: "row", alignItems: "center", gap: spacing["3"],
    },
    activeChatCardContent: { flex: 1, gap: spacing["0.5"] },
    activeChatTitle: { color: "#ffffff", fontWeight: "700", fontFamily: uiMonoFontFamily },
    activeChatSubtitle: { color: "#00e5ff", fontFamily: uiMonoFontFamily },
    sessionCard: {
      borderRadius: 16, borderWidth: 1, borderColor: "#ff00e5", backgroundColor: "rgba(10, 15, 30, 0.4)",
      paddingHorizontal: spacing["4"], paddingVertical: spacing["3"], minHeight: 100, justifyContent: "center", marginHorizontal: spacing["1"],
      shadowColor: "#ff00e5", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 6,
    },
    sessionCardActive: { borderColor: "#00e5ff", backgroundColor: "rgba(10, 25, 45, 0.5)", shadowColor: "#00e5ff", shadowOpacity: 0.4, shadowRadius: 8 },
    sessionCardLoading: { opacity: 0.65 },
    pressState: { opacity: 0.92, transform: [{ scale: 0.995 }] },
    sessionContent: { flex: 1, gap: spacing["1"] },
    sessionTitle: { color: "#00e5ff", fontFamily: uiMonoFontFamily, fontWeight: "800", fontSize: 16, lineHeight: 22 },
    sessionWorkspaceRow: { flexDirection: "row", alignItems: "center", gap: spacing["2"], minWidth: 0 },
    sessionWorkspaceText: { color: "#a5f5f5", fontFamily: uiMonoFontFamily, fontSize: 14, lineHeight: 20, fontWeight: "600", flexShrink: 1, minWidth: 0 },
    sessionInfoSeparator: { color: "rgba(0, 229, 255, 0.5)", fontSize: 16, lineHeight: 20 },
    sessionIdRow: { flexDirection: "row", alignItems: "center", gap: spacing["2"], minWidth: 0 },
    sessionIdText: { color: "rgba(0, 229, 255, 0.6)", fontSize: 14, lineHeight: 20, fontFamily: uiMonoFontFamily, flexShrink: 1, minWidth: 0, flex: 1 },
    sessionStatusDot: { width: 8, height: 8, borderRadius: 999, flexShrink: 0 },
    sessionStatusDotActive: { backgroundColor: "#ff00e5", shadowColor: "#ff00e5", shadowOpacity: 1, shadowRadius: 5 },
    sessionFooterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing["2"], minWidth: 0 },
    sessionTimeText: { color: "#00e5ff", fontFamily: uiMonoFontFamily, fontSize: 13, lineHeight: 20, fontWeight: "600" },
    sessionModelText: { color: "#00e5ff", fontSize: 13, lineHeight: 20, fontWeight: "800", letterSpacing: 0.5, flexShrink: 1, textAlign: "right", fontFamily: uiMonoFontFamily },
    sessionDeleteButton: { width: 44, height: 44, minWidth: 44, minHeight: 44, borderRadius: 999 },
    sessionDeleteIcon: { color: "rgba(0, 229, 255, 0.5)" },
  });
}
