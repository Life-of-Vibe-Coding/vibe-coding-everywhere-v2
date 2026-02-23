import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton, triggerHaptic } from "../../design-system";
import { CloseIcon } from "../icons/ChatActionIcons";
import { useTheme } from "../../theme/index";

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
      <View style={[styles.fullScreen, { paddingTop: insets.top }]}>
        <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
          <View style={styles.header}>
            <Text style={styles.title}>Running Processes</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={12}
              activeOpacity={0.7}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <CloseIcon size={22} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.errorHint}>
                Ensure the app can reach the server. On a physical device, use the machine&apos;s IP or EXPO_PUBLIC_SERVER_URL.
              </Text>
            </View>
          )}
          {warning && !error && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningText}>{warning}</Text>
            </View>
          )}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => load(true)}
                tintColor={theme.accent}
              />
            }
          >
            {loading && !refreshing && (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color={theme.accent} />
                <Text style={styles.loadingText}>Loading processes…</Text>
              </View>
            )}

            {!loading && (
              <>
                {hasOther && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Port-bound processes</Text>
                    {[...apiProcesses]
                      .sort((a, b) => b.pid - a.pid)
                      .map((proc) => {
                      const logPaths = proc.logPaths ?? [];
                      return (
                        <View key={`${proc.pid}-${proc.port}`} style={styles.row}>
                          <View style={styles.rowMain}>
                            <View style={styles.pidPortRow}>
                              <View style={styles.pill}>
                                <Text style={styles.pillText}>PID {proc.pid}</Text>
                              </View>
                              <View style={styles.pill}>
                                <Text style={styles.pillText}>Port {proc.port}</Text>
                              </View>
                            </View>
                            <Text
                              style={styles.command}
                              numberOfLines={4}
                              selectable
                            >
                              {proc.command}
                            </Text>
                          </View>
                          <View style={styles.rowActions}>
                            {logPaths.map((logPath) => {
                              const label = logPath.includes("/") ? logPath.split("/").pop() ?? logPath : logPath;
                              return (
                                <TouchableOpacity
                                  key={logPath}
                                  onPress={() => handleViewLog(logPath)}
                                  style={[styles.logButton, logPaths.length > 0 && styles.logButtonVisible]}
                                  activeOpacity={0.7}
                                  accessibilityLabel={`View log ${label}`}
                                  accessibilityRole="button"
                                >
                                  <Text style={styles.logButtonText}>Log: {label}</Text>
                                </TouchableOpacity>
                              );
                            })}
                            <View style={styles.killButtonWrap}>
                              <AppButton
                                label={killingPid === proc.pid ? "…" : "Kill"}
                                variant="danger"
                                size="sm"
                                onPress={() => handleKillApiProcess(proc)}
                                disabled={killingPid === proc.pid}
                                labelStyle={styles.killButtonLabel}
                              />
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {empty && (
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>No running processes found.</Text>
                    <Text style={styles.emptyHint}>
                      Port-bound processes (e.g. dev servers on 3000, 8000) will appear here.
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>

      {logViewer && (
        <Modal
          visible={true}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setLogViewer(null)}
          statusBarTranslucent
        >
          <View style={[styles.fullScreen, { paddingTop: insets.top }]}>
            <SafeAreaView style={styles.logViewerSafe} edges={["left", "right", "bottom"]}>
            <View style={styles.logViewerHeader}>
              <Text style={styles.logViewerTitle} numberOfLines={1}>
                {logViewer.name}
              </Text>
              <TouchableOpacity
                onPress={() => setLogViewer(null)}
                style={styles.closeBtn}
                hitSlop={12}
                activeOpacity={0.7}
                accessibilityLabel="Close log viewer"
                accessibilityRole="button"
              >
                <CloseIcon size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.logViewerScroll}
              contentContainerStyle={styles.logViewerContent}
              horizontal={false}
            >
              <Text
                style={styles.logViewerText}
                selectable
              >
                {logViewer.content || "(empty)"}
              </Text>
            </ScrollView>
            </SafeAreaView>
          </View>
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
