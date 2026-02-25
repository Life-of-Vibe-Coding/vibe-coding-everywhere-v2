import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { triggerHaptic } from "@/design-system";
import { CloseIcon } from "@/components/icons/ChatActionIcons";
import { useTheme } from "@/theme/index";
import { showAlert } from "@/components/ui/alert/native-alert";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
import { Button, ButtonIcon, ButtonText } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { Modal } from "@/components/ui/modal";
import { ScrollView } from "@/components/ui/scroll-view";
import { Spinner } from "@/components/ui/spinner";
import type { ApiProcess } from "@/components/processes/ProcessesDashboardModal";

export interface ProcessesDashboardSectionProps {
  serverBaseUrl: string;
  visible?: boolean;
}

function areApiProcessesEqual(a: ApiProcess[], b: ApiProcess[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const next = b[index];
    if (!next) return false;
    if (
      item.pid !== next.pid ||
      item.port !== next.port ||
      item.command !== next.command
    ) {
      return false;
    }
    const leftLogPaths = item.logPaths ?? [];
    const rightLogPaths = next.logPaths ?? [];
    if (leftLogPaths.length !== rightLogPaths.length) return false;
    return leftLogPaths.every((logPath, pathIndex) => logPath === rightLogPaths[pathIndex]);
  });
}

export function ProcessesDashboardSection({
  serverBaseUrl,
  visible = true,
}: ProcessesDashboardSectionProps) {
  const theme = useTheme();
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
      const nextProcesses = (data.processes ?? []) as ApiProcess[];
      setApiProcesses((prev) => (areApiProcessesEqual(prev, nextProcesses) ? prev : nextProcesses));
      if ((data as { warning?: string }).warning) {
        setWarning((data as { warning: string }).warning);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load processes");
      setApiProcesses((prev) => (prev.length === 0 ? prev : []));
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
        showAlert("Error", err instanceof Error ? err.message : "Failed to load log");
      }
    },
    [serverBaseUrl]
  );

  const handleKillApiProcess = useCallback(
    async (proc: ApiProcess) => {
      triggerHaptic("warning");
      showAlert("Terminate?", `Kill process PID ${proc.pid}?`, [
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
              showAlert("Error", err instanceof Error ? err.message : "Failed to kill process");
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
    <Box style={styles.section} className="gap-2.5">
      {error && (
        <Box style={styles.errorBanner} className="px-3.5 py-2.5 rounded-lg bg-error-500/10">
          <Text size="sm" className="text-error-600">{error}</Text>
          <Text size="xs" className="text-error-600 mt-1 opacity-90">Ensure the app can reach the server.</Text>
        </Box>
      )}
      {warning && !error && (
        <Box style={styles.warningBanner} className="px-3.5 py-2.5 rounded-lg">
          <Text size="xs" className="text-typography-900">{warning}</Text>
        </Box>
      )}

      {loading && !refreshing && (
        <Box style={styles.loading} className="flex-row items-center gap-2 py-3">
          <Spinner size="small" color={theme.colors?.accent ?? theme.accent} />
          <Text size="sm" className="text-typography-500">Loading…</Text>
        </Box>
      )}

      {!loading && (
        <>
          {hasOther && (
            <Box style={styles.list} className="gap-3">
              {[...apiProcesses]
                .sort((a, b) => b.pid - a.pid)
                .map((proc) => {
                  const logPaths = proc.logPaths ?? [];
                  return (
                    <Box key={`${proc.pid}-${proc.port}`} style={styles.row} className="flex-col py-3 px-3.5 rounded-lg gap-2.5 border border-outline-400 bg-background-0">
                      <Box style={styles.rowMain} className="min-w-0">
                        <Box style={styles.pidPortRow} className="flex-row flex-wrap gap-1.5 mb-2">
                          <Badge action="info" variant="outline" size="sm" className="py-0.5 px-2">
                            <BadgeText>PID {proc.pid}</BadgeText>
                          </Badge>
                          <Badge action="info" variant="outline" size="sm" className="py-0.5 px-2">
                            <BadgeText>Port {proc.port}</BadgeText>
                          </Badge>
                        </Box>
                        <Text size="xs" numberOfLines={3} selectable className="font-semibold text-typography-900 font-mono" style={{ fontFamily: Platform?.OS === "ios" ? "Menlo" : "monospace" }}>
                          {proc.command}
                        </Text>
                      </Box>
                      <Box style={styles.rowActions} className="flex-row items-center gap-2 flex-wrap shrink-0">
                        {logPaths.map((logPath) => {
                          const label = logPath.includes("/") ? logPath.split("/").pop() ?? logPath : logPath;
                          return (
                            <Pressable
                              key={logPath}
                              onPress={() => handleViewLog(logPath)}
                              className="py-1.5 px-2.5 rounded-md border border-primary-500 bg-primary-500/15 min-w-18"
                              accessibilityLabel={`View log ${label}`}
                            >
                              <Text size="xs" bold className="text-primary-500">Log: {label}</Text>
                            </Pressable>
                          );
                        })}
                        <Box style={styles.killButtonWrap} className="min-h-11 justify-center">
                          <Button action="negative" variant="solid" size="sm" onPress={() => handleKillApiProcess(proc)} isDisabled={killingPid === proc.pid}>
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
            <Box style={styles.empty} className="py-3">
              <Text size="sm" bold className="text-typography-500">No running processes.</Text>
            </Box>
          )}
        </>
      )}

      {!loading && (
        <Pressable
          onPress={() => load(true)}
          style={styles.refreshBtn}
          accessibilityLabel="Refresh processes"
          className="self-start py-2 min-h-11 justify-center"
        >
          <Text size="sm" bold className="text-primary-500">Refresh</Text>
        </Pressable>
      )}

      {logViewer && (
        <Modal
          visible={true}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setLogViewer(null)}
        >
          <SafeAreaView style={styles.logViewerSafe}>
            <Box style={styles.logViewerHeader} className="flex-row items-center justify-between py-3 px-4 border-b border-outline-400">
              <Text size="md" bold numberOfLines={1} className="flex-1 text-typography-900">
                {logViewer.name}
              </Text>
              <Button action="default" variant="link" size="md" onPress={() => setLogViewer(null)} accessibilityLabel="Close log viewer" className="min-w-11 min-h-11 -mr-2">
                <ButtonIcon as={CloseIcon} size="md" style={{ color: theme.colors?.textMuted ?? theme.colors.textSecondary }} />
              </Button>
            </Box>
            <ScrollView
              style={styles.logViewerScroll}
              contentContainerStyle={styles.logViewerContent}
              horizontal={false}
            >
              <Text size="xs" selectable className="text-typography-900 font-mono" style={{ fontFamily: Platform?.OS === "ios" ? "Menlo" : "monospace" }}>
                {logViewer.content || "(empty)"}
              </Text>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
    </Box>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    section: {
      gap: 10,
    },
    errorBanner: {
      backgroundColor: theme.colors.accentSoft ?? "#fee",
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 8,
    },
    errorText: {
      color: theme.colors.danger ?? "#c00",
      fontSize: 13,
    },
    errorHint: {
      color: theme.colors.danger ?? "#c00",
      fontSize: 11,
      marginTop: 4,
      opacity: 0.9,
    },
    warningBanner: {
      backgroundColor: theme.colors.accentSoft ?? "rgba(255,193,7,0.2)",
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 8,
    },
    warningText: {
      color: theme.colors.textPrimary,
      fontSize: 12,
    },
    loading: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 12,
    },
    loadingText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    list: {
      gap: 12,
    },
    row: {
      flexDirection: "column",
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: theme.colors.surface,
      borderRadius: 10,
      gap: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    rowMain: {
      minWidth: 0,
    },
    rowActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
      flexShrink: 0,
    },
    logButton: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 6,
      backgroundColor: theme.colors.accentSoft ?? "rgba(0,122,255,0.15)",
      borderWidth: 1,
      borderColor: theme.accent,
    },
    logButtonVisible: {
      minWidth: 70,
    },
    logButtonText: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.accent,
    },
    pidPortRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 8,
    },
    pill: {
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 6,
      backgroundColor: theme.colors.accentSoft ?? "rgba(0,122,255,0.12)",
      borderWidth: 1,
      borderColor: theme.accent,
    },
    pillText: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.accent,
      letterSpacing: 0.2,
    },
    command: {
      fontSize: 13,
      lineHeight: 19,
      color: theme.colors.textPrimary,
      fontFamily: Platform?.OS === "ios" ? "Menlo" : "monospace",
    },
    killButtonWrap: {
      minHeight: 44,
      justifyContent: "center",
    },
    empty: {
      paddingVertical: 12,
    },
    emptyText: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.colors.textSecondary,
    },
    refreshBtn: {
      alignSelf: "flex-start",
      paddingVertical: 8,
      paddingHorizontal: 0,
      minHeight: 44,
      justifyContent: "center",
    },
    refreshText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.accent,
    },
    closeBtn: {
      minWidth: 44,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    logViewerSafe: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    logViewerHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    logViewerTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textPrimary,
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
      color: theme.colors.textPrimary,
    },
  });
}
