import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { EntranceAnimation, radii, spacing } from "../../design-system";
import { CloseIcon, RefreshCwIcon } from "../icons/ChatActionIcons";
import { Box } from "../../../components/ui/box";
import { Button, ButtonIcon } from "../../../components/ui/button";
import { HStack } from "../../../components/ui/hstack";
import { VStack } from "../../../components/ui/vstack";
import { Text } from "../../../components/ui/text";
import { useTheme, type Provider as BrandProvider } from "../../theme/index";
import type { SessionStatus } from "../../state/sessionManagementStore";

interface HealthApiProcess {
  pid: number;
  port: number;
  command: string;
}

interface HealthApiResponse {
  ok?: boolean;
  status?: string;
  timestamp?: string;
  system?: {
    nodeVersion?: string;
    platform?: string;
    arch?: string;
    pid?: number;
    uptimeSeconds?: number;
    loadAvg?: number[];
    memory?: {
      rss?: number;
      heapTotal?: number;
      heapUsed?: number;
      external?: number;
      arrayBuffers?: number;
    };
  };
  workspace?: {
    path?: string;
    allowedRoot?: string;
  };
  dockerEnabled?: boolean;
  docker?: {
    enabled?: boolean;
  };
}

interface HealthProcessesResponse {
  processes?: HealthApiProcess[];
  error?: string;
  warning?: string;
}

interface HealthSessionsResponse {
  sessions?: SessionStatus[];
  error?: string;
  ok?: boolean;
}

interface HealthDockerResponse {
  enabled?: boolean;
  error?: string;
}

export interface HealthCheckModalProps {
  visible: boolean;
  onClose: () => void;
  serverBaseUrl: string;
  connected: boolean;
  provider: BrandProvider;
  model: string;
  activeSessionId: string | null;
  isViewingLiveSession: boolean;
  agentRunning: boolean;
  waitingForUserInput: boolean;
  sessionStatuses: SessionStatus[];
  workspacePath: string | null;
}

interface FetchState<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}

function formatMb(value?: number): string {
  if (!value || value <= 0) return "n/a";
  return `${value.toFixed(1)} MB`;
}

function formatUptime(seconds?: number): string {
  if (!seconds || seconds <= 0) return "n/a";
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  const min = mins % 60;
  if (hrs > 0) return `${hrs}h ${min}m`;
  return `${min}m`;
}

function formatLastAccess(ms: number): string {
  if (!ms || !Number.isFinite(ms)) return "n/a";
  const diff = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m ago`;
}

function truncateId(id?: string | null): string {
  if (!id) return "—";
  if (id.length <= 10) return id;
  return `${id.slice(0, 5)}…${id.slice(-4)}`;
}

async function fetchJson<T>(url: string): Promise<FetchState<T>> {
  try {
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data: null,
        error: text || `Request failed (${res.status})`,
      };
    }
    if (!text.trim()) {
      return { ok: true, status: res.status, data: {} as T, error: null };
    }
    const data = JSON.parse(text) as T;
    return { ok: true, status: res.status, data, error: null };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export function HealthCheckModal({
  visible,
  onClose,
  serverBaseUrl,
  connected,
  provider,
  model,
  activeSessionId,
  isViewingLiveSession,
  agentRunning,
  waitingForUserInput,
  sessionStatuses,
  workspacePath,
}: HealthCheckModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [health, setHealth] = useState<HealthApiResponse | null>(null);
  const [processes, setProcesses] = useState<HealthApiProcess[]>([]);
  const [sessionSnapshot, setSessionSnapshot] = useState<SessionStatus[]>([]);
  const [dockerEnabled, setDockerEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setWarnings([]);
    const nextWarnings: string[] = [];

    const [
      healthResponse,
      processResponse,
      sessionResponse,
      dockerResponse,
    ] = await Promise.all([
      fetchJson<HealthApiResponse>(`${serverBaseUrl}/api/health`),
      fetchJson<HealthProcessesResponse>(`${serverBaseUrl}/api/processes`),
      fetchJson<HealthSessionsResponse>(`${serverBaseUrl}/api/sessions/status`),
      fetchJson<HealthDockerResponse>(`${serverBaseUrl}/api/docker/status`),
    ]);

    if (healthResponse.ok && healthResponse.data) {
      setHealth(healthResponse.data);
    } else {
      nextWarnings.push(healthResponse.error ?? "Health check failed");
    }

    if (processResponse.ok && processResponse.data) {
      setProcesses(Array.isArray(processResponse.data.processes) ? processResponse.data.processes : []);
      if (processResponse.data.warning) {
        nextWarnings.push(processResponse.data.warning);
      }
    } else {
      setProcesses([]);
      nextWarnings.push(processResponse.error ?? "Failed to load process list");
    }

    if (sessionResponse.ok && sessionResponse.data && Array.isArray(sessionResponse.data.sessions)) {
      setSessionSnapshot(sessionResponse.data.sessions);
    } else {
      setSessionSnapshot([]);
      nextWarnings.push(sessionResponse.error ?? "Failed to load session status");
    }

    if (dockerResponse.ok && dockerResponse.data) {
      setDockerEnabled(dockerResponse.data.enabled ?? false);
    } else if (healthResponse.ok && healthResponse.data) {
      const fromHealth = healthResponse.data.dockerEnabled;
      if (typeof fromHealth === "boolean") {
        setDockerEnabled(fromHealth);
      } else {
        setDockerEnabled(null);
      }
      if (dockerResponse.error) nextWarnings.push(dockerResponse.error);
    } else {
      setDockerEnabled(null);
      nextWarnings.push(dockerResponse.error ?? "Failed to read docker status");
    }

    setWarnings(nextWarnings);
    setLoading(false);
    setRefreshing(false);
  }, [serverBaseUrl]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load().catch(() => setRefreshing(false));
  }, [load]);

  useEffect(() => {
    if (visible) {
      void load();
    }
  }, [visible, load]);

  const lastChecked = health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : "—";

  const activeSessionState = useMemo(() => {
    const list = sessionSnapshot.length > 0 ? sessionSnapshot : sessionStatuses;
    return list.find((s) => s.id === activeSessionId) ?? null;
  }, [activeSessionId, sessionStatuses, sessionSnapshot]);

  const recentSessions = useMemo(() => {
    const source = sessionSnapshot.length > 0 ? sessionSnapshot : sessionStatuses;
    return [...source].sort((a, b) => b.lastAccess - a.lastAccess).slice(0, 5);
  }, [sessionSnapshot, sessionStatuses]);

  const systemDockerEnabled = useMemo(() => {
    if (typeof dockerEnabled === "boolean") return dockerEnabled;
    if (health?.dockerEnabled != null) return health.dockerEnabled;
    if (typeof health?.docker?.enabled === "boolean") return health.docker.enabled;
    return null;
  }, [dockerEnabled, health]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Box style={[styles.fullScreen, { paddingTop: insets.top }]}>
        <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
          <HStack style={styles.header}>
            <HStack className="flex-1 items-center gap-2">
              <Box style={[styles.accentBar, { backgroundColor: theme.colors.accent }]} />
              <VStack>
                <Text size="xl" bold>
                  Health Check
                </Text>
                <Text size="xs" style={{ color: theme.textMuted }}>
                  Last checked {lastChecked}
                </Text>
              </VStack>
            </HStack>
            <HStack className="gap-2">
              <Button
                action="secondary"
                variant="outline"
                size="sm"
                onPress={onRefresh}
                accessibilityLabel="Refresh health status"
                className="w-11 h-11 rounded-xl active:opacity-80"
                style={{ borderColor: theme.colors.accentSubtle }}
              >
                <ButtonIcon as={RefreshCwIcon} size="sm" style={{ color: theme.colors.accent }} />
              </Button>
              <Button
                action="default"
                variant="link"
                size="md"
                onPress={onClose}
                accessibilityLabel="Close health check"
                className="w-11 h-11 rounded-xl active:opacity-80"
              >
                <ButtonIcon as={CloseIcon} size="md" style={{ color: theme.textMuted }} />
              </Button>
            </HStack>
          </HStack>

          {warnings.length > 0 && (
            <Box style={[styles.warningBanner, { backgroundColor: theme.warning + "15" }]}>
              <Text size="xs" bold style={{ color: theme.warning }}>
                Some checks did not return successfully:
              </Text>
              {warnings.map((msg, idx) => (
                <Text key={`${msg}-${idx}`} size="xs" style={{ color: theme.warning, marginTop: 4 }}>
                  • {msg}
                </Text>
              ))}
            </Box>
          )}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.accent}
                colors={[theme.colors.accent]}
              />
            }
          >
            {loading && !refreshing ? (
              <Box style={styles.loading}>
                <ActivityIndicator size="large" color={theme.colors.accent} />
                <Text size="xs" style={{ color: theme.textMuted }}>
                  Checking server health...
                </Text>
              </Box>
            ) : (
              <VStack style={styles.content} className="gap-4">
                <Box style={styles.section}>
                  <Text size="sm" bold style={{ marginBottom: spacing["2"] }}>
                    System
                  </Text>
                  <VStack className="gap-2">
                    <HStack style={styles.row}>
                      <Text size="xs" className="text-typography-500 flex-1">
                        Connectivity
                      </Text>
                      <Text
                        size="xs"
                        bold
                        style={{ color: connected ? theme.colors.success : theme.colors.danger }}
                      >
                        {connected ? "Connected" : "Disconnected"}
                      </Text>
                    </HStack>
                    <HStack style={styles.row}>
                      <Text size="xs" className="text-typography-500 flex-1">
                        Health endpoint
                      </Text>
                      <Text
                        size="xs"
                        bold
                        style={{ color: health?.ok ? theme.colors.success : theme.colors.danger }}
                      >
                        {health?.status ? `${health.status}` : "Unavailable"}
                      </Text>
                    </HStack>
                    <HStack style={styles.row}>
                      <Text size="xs" className="text-typography-500 flex-1">
                        Runtime
                      </Text>
                      <Text size="xs" className="text-typography-900 text-right">
                        {health?.system?.nodeVersion ?? "—"}
                      </Text>
                    </HStack>
                    <HStack style={styles.row}>
                      <Text size="xs" className="text-typography-500 flex-1">
                        Platform
                      </Text>
                      <Text size="xs" className="text-typography-900 text-right">
                        {[health?.system?.platform, health?.system?.arch].filter(Boolean).join(" / ") || "—"}
                      </Text>
                    </HStack>
                    <HStack style={styles.row}>
                      <Text size="xs" className="text-typography-500 flex-1">
                        Uptime
                      </Text>
                      <Text size="xs" className="text-typography-900 text-right">
                        {formatUptime(health?.system?.uptimeSeconds)}
                      </Text>
                    </HStack>
                    <HStack style={styles.row}>
                      <Text size="xs" className="text-typography-500 flex-1">
                        Memory
                      </Text>
                      <Text size="xs" className="text-typography-900 text-right">
                        {formatMb(health?.system?.memory?.rss)} RSS /{" "}
                        {formatMb(health?.system?.memory?.heapUsed)} heap
                      </Text>
                    </HStack>
                    <HStack style={styles.row}>
                      <Text size="xs" className="text-typography-500 flex-1">
                        Workspace
                      </Text>
                      <Text
                        size="xs"
                        className="text-typography-900 text-right"
                        style={{ maxWidth: 220 }}
                        numberOfLines={2}
                      >
                        {health?.workspace?.path ?? workspacePath ?? "—"}
                      </Text>
                    </HStack>
                    <HStack style={styles.row}>
                      <Text size="xs" className="text-typography-500 flex-1">
                        Docker
                      </Text>
                      <Text
                        size="xs"
                        bold
                        style={{
                          color:
                            systemDockerEnabled === null
                              ? theme.textMuted
                              : systemDockerEnabled
                                ? theme.colors.success
                                : theme.textMuted,
                        }}
                      >
                        {systemDockerEnabled === null ? "Unknown" : systemDockerEnabled ? "Enabled" : "Disabled"}
                      </Text>
                    </HStack>
                  </VStack>
                </Box>

                <Box style={styles.section}>
                  <Text size="sm" bold style={{ marginBottom: spacing["2"] }}>
                    Session context
                  </Text>
                  <VStack className="gap-2">
                    <HStack style={styles.row}>
                      <Text size="xs" className="text-typography-500 flex-1">
                        Active context
                      </Text>
                      <Text size="xs" className="text-typography-900">
                        {isViewingLiveSession ? "Live session" : "Loaded session"}
                      </Text>
                    </HStack>
                    <HStack style={styles.row}>
                      <Text size="xs" className="text-typography-500 flex-1">
                        Conversation state
                      </Text>
                      <Text size="xs" bold style={{ color: theme.colors.accent }}>
                        {agentRunning
                          ? waitingForUserInput
                            ? "Waiting for user input"
                            : "Running"
                          : "Idle"}
                      </Text>
                    </HStack>
                    <HStack style={styles.row}>
                      <Text size="xs" className="text-typography-500 flex-1">
                        Provider / model
                      </Text>
                      <Text size="xs" className="text-typography-900">
                        {provider} / {model}
                      </Text>
                    </HStack>
                    <HStack style={styles.row}>
                      <Text size="xs" className="text-typography-500 flex-1">
                        Active session
                      </Text>
                      <Text size="xs" className="text-typography-900 text-right">
                        {truncateId(activeSessionId)}
                      </Text>
                    </HStack>
                    {activeSessionState && (
                      <>
                        <HStack style={styles.row}>
                          <Text size="xs" className="text-typography-500 flex-1">
                            Session state
                          </Text>
                          <Text
                            size="xs"
                            bold
                            style={{
                              color:
                                activeSessionState.status === "running"
                                  ? theme.colors.success
                                  : theme.textMuted,
                            }}
                          >
                            {activeSessionState.status}
                          </Text>
                        </HStack>
                        <HStack style={styles.row}>
                          <Text size="xs" className="text-typography-500 flex-1">
                            Last activity
                          </Text>
                          <Text size="xs" className="text-typography-900">
                            {formatLastAccess(activeSessionState.lastAccess)}
                          </Text>
                        </HStack>
                        <HStack style={styles.row}>
                          <Text size="xs" className="text-typography-500 flex-1">
                            Session cwd
                          </Text>
                          <Text
                            size="xs"
                            className="text-typography-900 text-right"
                            style={{ maxWidth: 220 }}
                            numberOfLines={2}
                          >
                            {activeSessionState.cwd ?? "Unknown"}
                          </Text>
                        </HStack>
                      </>
                    )}
                    <Text size="xs" className="text-typography-500" style={{ marginTop: spacing["2"] }}>
                      Recent sessions
                    </Text>
                    <VStack className="gap-2">
                      {recentSessions.length === 0 ? (
                        <Text size="xs" style={{ color: theme.textMuted }}>
                          No recent sessions.
                        </Text>
                      ) : (
                        recentSessions.map((entry) => (
                          <HStack key={entry.id} style={styles.row}>
                            <VStack className="flex-1 min-w-0 gap-0.5">
                              <Text size="xs" bold className="text-typography-900">
                                {truncateId(entry.id)}
                              </Text>
                              <Text size="xs" style={{ color: theme.textMuted }} numberOfLines={1}>
                                {entry.model ? `Model: ${entry.model}` : "Model: unknown"} · CWD:{" "}
                                {entry.cwd ?? "unknown"}
                              </Text>
                            </VStack>
                            <Text
                              size="xs"
                              bold
                              style={{
                                color:
                                  entry.status === "running" ? theme.colors.success : theme.textMuted,
                              }}
                            >
                              {entry.status}
                            </Text>
                          </HStack>
                        ))
                      )}
                    </VStack>
                  </VStack>
                </Box>

                <Box style={styles.section}>
                  <Text size="sm" bold style={{ marginBottom: spacing["2"] }}>
                    Running process ports
                  </Text>
                  <Text size="xs" style={{ color: theme.textMuted }}>
                    {processes.length} process{processes.length === 1 ? "" : "es"} detected on monitored ports.
                  </Text>
                  <VStack className="gap-2 mt-2">
                    {processes.length === 0 ? (
                      <Text size="xs" style={{ color: theme.textMuted }}>
                        No process listeners found on monitored ports.
                      </Text>
                    ) : (
                      processes.map((proc) => (
                        <EntranceAnimation key={`${proc.pid}-${proc.port}`} variant="fade">
                          <Box style={styles.processRow}>
                            <HStack style={styles.processHeader}>
                              <Text size="xs" bold>
                                PID {proc.pid}
                              </Text>
                              <Text size="xs" bold style={{ color: theme.colors.accent }}>
                                Port {proc.port}
                              </Text>
                            </HStack>
                          <Text
                              size="xs"
                              style={{ color: theme.textSecondary, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}
                              numberOfLines={2}
                            >
                              {proc.command || "(unknown)"}
                            </Text>
                          </Box>
                        </EntranceAnimation>
                      ))
                    )}
                  </VStack>
                </Box>
              </VStack>
            )}
          </ScrollView>
        </SafeAreaView>
      </Box>
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
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderColor,
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing["5"],
      paddingVertical: spacing["3"],
      gap: spacing["2"],
    },
    accentBar: {
      width: 4,
      height: 22,
      borderRadius: 2,
    },
    warningBanner: {
      marginHorizontal: spacing["5"],
      marginTop: spacing["3"],
      padding: spacing["3"],
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: theme.warning + "35",
      gap: 4,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing["5"],
      paddingTop: spacing["4"],
      paddingBottom: spacing["8"],
      gap: spacing["4"],
    },
    loading: {
      alignItems: "center",
      gap: spacing["2"],
      paddingVertical: 64,
    },
    content: {
      gap: spacing["4"],
    },
    section: {
      backgroundColor: theme.surface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: spacing["4"],
    },
    row: {
      minHeight: 24,
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing["2"],
    },
    processRow: {
      backgroundColor: theme.surfaceAlt,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: theme.borderColor,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.accent,
      padding: spacing["3"],
      gap: spacing["1"],
      marginBottom: spacing["2"],
    },
    processHeader: {
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing["2"],
    },
  });
}
