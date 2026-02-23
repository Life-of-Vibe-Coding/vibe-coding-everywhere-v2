import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { triggerHaptic } from "../../design-system";
import { CloseIcon } from "../icons/ChatActionIcons";
import { useTheme } from "../../theme/index";
import { Badge, BadgeText } from "../../../components/ui/badge";
import { Box } from "../../../components/ui/box";
import { Button, ButtonIcon, ButtonText } from "../../../components/ui/button";
import { Pressable } from "../../../components/ui/pressable";
import { Text } from "../../../components/ui/text";

/** Minimum touch target per UI/UX Pro Max (44x44px). */
const MIN_TOUCH_TARGET = 44;

export interface ApiProcess {
  pid: number;
  port: number;
  command: string;
  /** Log file names extracted from command (>> file.log, > file.log) */
  logPaths?: string[];
}

export interface ProcessesDashboardModalProps {
  visible: boolean;
  onClose: () => void;
  serverBaseUrl: string;
}

export function ProcessesDashboardModal({
  visible,
  onClose,
  serverBaseUrl,
}: ProcessesDashboardModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [apiProcesses, setApiProcesses] = useState<ApiProcess[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [killingPid, setKillingPid] = useState<number | null>(null);
  const [logViewer, setLogViewer] = useState<{ name: string; content: string } | null>(null);

  const fetchProcesses = useCallback(async () => {
    try {
      setError(null);
      setWarning(null);
      const url = `${serverBaseUrl}/api/processes`;
      const res = await fetch(url);
      const rawText = await res.text();
      let data: { processes?: ApiProcess[]; error?: string; warning?: string } = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new Error(res.ok ? "Invalid response" : `Server error (${res.status})`);
      }
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
      }
      setApiProcesses((data.processes ?? []) as ApiProcess[]);
      if ((data as { warning?: string }).warning) {
        setWarning((data as { warning: string }).warning);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load processes");
      setApiProcesses([]);
    }
  }, [serverBaseUrl]);

  const load = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    await fetchProcesses();
    setLoading(false);
    setRefreshing(false);
  }, [fetchProcesses]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const handleViewLog = useCallback(
    async (logPath: string) => {
      triggerHaptic("selection");
      try {
        const param = logPath.includes("/") ? `path=${encodeURIComponent(logPath)}` : `name=${encodeURIComponent(logPath)}`;
        const res = await fetch(`${serverBaseUrl}/api/processes/log?${param}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as { error?: string })?.error ?? "Failed to load log");
        setLogViewer({ name: logPath, content: (data as { content?: string }).content ?? "" });
      } catch (err) {
        Alert.alert("Error", err instanceof Error ? err.message : "Failed to load log");
      }
    },
    [serverBaseUrl]
  );

  const handleKillApiProcess = useCallback(
    async (proc: ApiProcess) => {
      triggerHaptic("warning");
      Alert.alert("Terminate?", `Kill process PID ${proc.pid}?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Kill",
          style: "destructive",
          onPress: async () => {
            triggerHaptic("error");
            setKillingPid(proc.pid);
            try {
              const res = await fetch(`${serverBaseUrl}/api/processes/${proc.pid}/kill`, {
                method: "POST",
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error((data as { error?: string })?.error ?? "Failed to kill");
              await fetchProcesses();
            } catch (err) {
              Alert.alert("Error", err instanceof Error ? err.message : "Failed to kill process");
            } finally {
              setKillingPid(null);
            }
          },
        },
      ]);
    },
    [serverBaseUrl, fetchProcesses]
  );

  const hasOther = apiProcesses.length > 0;
  const empty = !hasOther && !loading && !error;

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
          <Box style={styles.header} className="flex-row items-center justify-between py-3 px-4 border-b border-outline-400">
            <Text size="lg" bold className="text-typography-900">Running Processes</Text>
            <Button
              action="default"
              variant="link"
              size="md"
              onPress={onClose}
              accessibilityLabel="Close"
              className="min-w-11 min-h-11 -mr-2"
            >
              <ButtonIcon as={CloseIcon} size="lg" style={{ color: theme.colors?.textMuted ?? theme.textMuted }} />
            </Button>
          </Box>

          {error && (
            <Box style={styles.errorBanner} className="bg-error-500/10 px-5 py-3.5">
              <Text size="sm" className="text-error-600">{error}</Text>
              <Text size="xs" className="text-error-600 mt-2 leading-4.5 opacity-95">
                Ensure the app can reach the server. On a physical device, use the machine&apos;s IP or EXPO_PUBLIC_SERVER_URL.
              </Text>
            </Box>
          )}
          {warning && !error && (
            <Box style={styles.warningBanner} className="px-5 py-3">
              <Text size="sm" className="text-typography-900">{warning}</Text>
            </Box>
          )}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => load(true)}
                tintColor={theme.colors?.accent ?? theme.accent}
              />
            }
          >
            {loading && !refreshing && (
              <Box style={styles.loading} className="py-8 items-center gap-2.5">
                <ActivityIndicator size="large" color={theme.colors?.accent ?? theme.accent} />
                <Text size="xs" className="text-typography-500">Loading processes…</Text>
              </Box>
            )}

            {!loading && (
              <>
                {hasOther && (
                  <Box style={styles.section} className="mb-4">
                    <Text size="xs" bold className="text-typography-500 uppercase tracking-wider mb-2.5">Port-bound processes</Text>
                    {[...apiProcesses]
                      .sort((a, b) => b.pid - a.pid)
                      .map((proc) => {
                      const logPaths = proc.logPaths ?? [];
                      return (
                        <Box key={`${proc.pid}-${proc.port}`} style={styles.row} className="flex-col py-2.5 px-3 rounded-lg mb-2.5 gap-2 border border-outline-400 bg-background-0">
                          <Box style={styles.rowMain} className="min-w-0">
                            <Box style={styles.pidPortRow} className="flex-row flex-wrap gap-1.5 mb-1.5">
                              <Badge action="info" variant="outline" size="sm" className="py-0.5 px-1.5 rounded">
                                <BadgeText>PID {proc.pid}</BadgeText>
                              </Badge>
                              <Badge action="info" variant="outline" size="sm" className="py-0.5 px-1.5 rounded">
                                <BadgeText>Port {proc.port}</BadgeText>
                              </Badge>
                            </Box>
                            <Text
                              size="xs"
                              numberOfLines={4}
                              selectable
                              className="font-semibold text-typography-900 font-mono"
                              style={{ fontFamily: Platform?.OS === "ios" ? "Menlo" : "monospace" }}
                            >
                              {proc.command}
                            </Text>
                          </Box>
                          <Box style={styles.rowActions} className="flex-row items-center gap-1.5 flex-wrap shrink-0">
                            {logPaths.map((logPath) => {
                              const label = logPath.includes("/") ? logPath.split("/").pop() ?? logPath : logPath;
                              return (
                                <Pressable
                                  key={logPath}
                                  onPress={() => handleViewLog(logPath)}
                                  className="py-1.5 px-2 rounded-md border border-primary-500 bg-primary-500/15 min-w-16"
                                  accessibilityLabel={`View log ${label}`}
                                >
                                  <Text size="xs" bold className="text-primary-500">Log: {label}</Text>
                                </Pressable>
                              );
                            })}
                            <Box style={styles.killButtonWrap} className="min-h-9 justify-center">
                              <Button
                                action="negative"
                                variant="solid"
                                size="sm"
                                onPress={() => handleKillApiProcess(proc)}
                                isDisabled={killingPid === proc.pid}
                              >
                                <ButtonText>{killingPid === proc.pid ? "…" : "Kill"}</ButtonText>
                              </Button>
                            </Box>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                )}

                {empty && (
                  <Box style={styles.empty} className="py-8 items-center">
                    <Text size="sm" bold className="text-typography-500 mb-1.5">No running processes found.</Text>
                    <Text size="xs" className="text-typography-500 text-center max-w-70 leading-4.5">
                      Port-bound processes (e.g. dev servers on 3000, 8000) will appear here.
                    </Text>
                  </Box>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Box>

      {logViewer && (
        <Modal
          visible={true}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setLogViewer(null)}
          statusBarTranslucent
        >
          <Box style={[styles.fullScreen, { paddingTop: insets.top }]}>
            <SafeAreaView style={styles.logViewerSafe} edges={["left", "right", "bottom"]}>
            <Box style={styles.logViewerHeader} className="flex-row items-center justify-between py-3 px-4 border-b border-outline-400">
              <Text size="md" bold numberOfLines={1} className="flex-1 text-typography-900">
                {logViewer.name}
              </Text>
              <Button
                action="default"
                variant="link"
                size="md"
                onPress={() => setLogViewer(null)}
                accessibilityLabel="Close log viewer"
                className="min-w-11 min-h-11 -mr-2"
              >
                <ButtonIcon as={CloseIcon} size="md" style={{ color: theme.colors?.textMuted ?? theme.textMuted }} />
              </Button>
            </Box>
            <ScrollView
              style={styles.logViewerScroll}
              contentContainerStyle={styles.logViewerContent}
              horizontal={false}
            >
              <Text
                size="xs"
                selectable
                className="text-typography-900 font-mono"
                style={{ fontFamily: Platform?.OS === "ios" ? "Menlo" : "monospace" }}
              >
                {logViewer.content || "(empty)"}
              </Text>
            </ScrollView>
            </SafeAreaView>
          </Box>
        </Modal>
      )}
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
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderColor,
    },
    title: {
      fontSize: 17,
      fontWeight: "700",
      color: theme.textPrimary,
      letterSpacing: -0.3,
    },
    closeBtn: {
      minWidth: MIN_TOUCH_TARGET,
      minHeight: MIN_TOUCH_TARGET,
      alignItems: "center",
      justifyContent: "center",
      marginRight: -8,
      marginVertical: -8,
    },
    errorBanner: {
      backgroundColor: (theme as { colors?: { errorBg?: string } }).colors?.errorBg ?? "#fee2e2",
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    errorText: {
      color: (theme as { colors?: { error?: string } }).colors?.error ?? theme.danger ?? "#dc2626",
      fontSize: 14,
    },
    errorHint: {
      color: (theme as { colors?: { error?: string } }).colors?.error ?? theme.danger ?? "#dc2626",
      fontSize: 12,
      marginTop: 8,
      lineHeight: 18,
      opacity: 0.95,
    },
    warningBanner: {
      backgroundColor: theme.accentLight ?? "rgba(255,193,7,0.2)",
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    warningText: {
      color: theme.textPrimary,
      fontSize: 13,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 20,
    },
    loading: {
      paddingVertical: 32,
      alignItems: "center",
      gap: 10,
    },
    loadingText: {
      fontSize: 12,
      color: theme.textMuted,
    },
    section: {
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 10,
    },
    row: {
      flexDirection: "column",
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: theme.cardBg,
      borderRadius: 10,
      marginBottom: 10,
      gap: 8,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    rowMain: {
      minWidth: 0,
    },
    rowActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
      flexShrink: 0,
    },
    logButton: {
      paddingVertical: 5,
      paddingHorizontal: 9,
      borderRadius: 6,
      backgroundColor: theme.accentLight ?? "rgba(0,122,255,0.15)",
      borderWidth: 1,
      borderColor: theme.accent,
    },
    logButtonVisible: {
      minWidth: 64,
    },
    logButtonText: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.accent,
    },
    pidPortRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 6,
    },
    pill: {
      paddingVertical: 2,
      paddingHorizontal: 7,
      borderRadius: 5,
      backgroundColor: theme.accentLight ?? "rgba(0,122,255,0.12)",
      borderWidth: 1,
      borderColor: theme.accent,
    },
    pillText: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.accent,
      letterSpacing: 0.2,
    },
    command: {
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "600",
      color: theme.textPrimary,
      fontFamily: Platform?.OS === "ios" ? "Menlo" : "monospace",
    },
    killButtonWrap: {
      minHeight: 36,
      justifyContent: "center",
    },
    killButtonLabel: {
      fontSize: 12,
      fontWeight: "700",
    },
    empty: {
      paddingVertical: 32,
      alignItems: "center",
    },
    emptyText: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.textMuted,
      marginBottom: 6,
    },
    emptyHint: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.textMuted,
      textAlign: "center",
      maxWidth: 280,
    },
    logViewerSafe: {
      flex: 1,
      backgroundColor: theme.beigeBg,
    },
    logViewerHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderColor,
    },
    logViewerTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.textPrimary,
      flex: 1,
    },
    logViewerScroll: {
      flex: 1,
    },
    logViewerContent: {
      padding: 16,
      paddingBottom: 32,
    },
    logViewerText: {
      fontFamily: Platform?.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 11,
      color: theme.textPrimary,
    },
  });
}
