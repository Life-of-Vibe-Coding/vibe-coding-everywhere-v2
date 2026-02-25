import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { triggerHaptic, spacing, radii, EntranceAnimation } from "@/design-system";
import { CloseIcon, TerminalIcon } from "@/components/icons/ChatActionIcons";
import { useTheme } from "@/theme/index";
import { showAlert } from "@/components/ui/alert/native-alert";
import { Box } from "@/components/ui/box";
import { Button, ButtonIcon, ButtonText } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { AsyncStateView, ModalScaffold } from "@/components/reusable";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
} from "@/components/ui/modal";
import { ScrollView } from "@/components/ui/scroll-view";
import { Spinner } from "@/components/ui/spinner";
import { RefreshControl } from "@/components/ui/refresh-control";

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
  isOpen: boolean;
  onClose: () => void;
  serverBaseUrl: string;
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

export function ProcessesDashboardModal({
  isOpen,
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
    if (isOpen) load();
  }, [isOpen, load]);

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

  if (!isOpen) return null;

  return (
    <ModalScaffold
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      title="Running Processes"
      subtitle="Port-bound server processes"
      showCloseButton={false}
      contentClassName="w-full h-full max-w-none rounded-none border-0 p-0"
      bodyClassName="m-0 p-0"
      bodyProps={{ scrollEnabled: false }}
    >
          <Box style={[styles.fullScreen, { paddingTop: insets.top }]}>
            <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
          {/* Header with accent bar */}
          <HStack style={[styles.header, { borderBottomColor: theme.colors.accent + "30" }]}>
            <HStack className="flex-1 items-center gap-2">
              <Box style={[styles.accentBar, { backgroundColor: theme.colors.accent }]} />
              <Text size="xl" bold className="text-typography-900">Running Processes</Text>
            </HStack>
            <Button
              action="default"
              variant="link"
              size="md"
              onPress={onClose}
              accessibilityLabel="Close"
              className="min-w-11 min-h-11 -mr-2"
            >
              <ButtonIcon as={CloseIcon} size="lg" style={{ color: theme.colors?.textMuted ?? theme.colors.textSecondary }} />
            </Button>
          </HStack>

          {error && (
            <EntranceAnimation variant="fade">
              <VStack style={[styles.errorBanner, { backgroundColor: theme.colors?.danger ? theme.colors.danger + "12" : undefined, borderColor: theme.colors?.danger ? theme.colors.danger + "25" : undefined }]} className="gap-2">
                <Text size="sm" className="text-error-600">{error}</Text>
                <Text size="xs" className="text-error-600 leading-4.5 opacity-90">
                  Ensure the app can reach the server. On a physical device, use the machine&apos;s IP or EXPO_PUBLIC_SERVER_URL.
                </Text>
              </VStack>
            </EntranceAnimation>
          )}
          {warning && !error && (
            <EntranceAnimation variant="fade">
              <Box style={[styles.warningBanner, { backgroundColor: theme.colors.accentSoft }]}>
                <Text size="sm" className="text-typography-900">{warning}</Text>
              </Box>
            </EntranceAnimation>
          )}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => load(true)}
                tintColor={theme.colors.accent}
              />
            }
          >
            <AsyncStateView
              isLoading={loading && !refreshing}
              isEmpty={empty}
              loadingText="Loading processes..."
              emptyTitle="No running processes found"
              emptyDescription="Port-bound processes (e.g. dev servers on 3000, 8000) will appear here when active."
            >
                {hasOther ? (
                  <VStack style={styles.section} className="gap-3">
                    <HStack className="items-center gap-2">
                      <Box style={[styles.sectionAccent, { backgroundColor: theme.colors.accent }]} />
                      <Text size="xs" bold style={{ color: theme.colors?.textSecondary ?? theme.colors.textSecondary }} className="uppercase tracking-wider">Port-bound processes</Text>
                    </HStack>
                    {[...apiProcesses]
                      .sort((a, b) => b.pid - a.pid)
                      .map((proc) => {
                      const logPaths = proc.logPaths ?? [];
                      const accent = theme.colors.accent;
                      return (
                        <EntranceAnimation key={`${proc.pid}-${proc.port}`} variant="slideUp" delay={0}>
                          <Box
                            style={[
                              styles.row,
                              {
                                backgroundColor: accent + "08",
                                borderLeftColor: accent,
                                borderColor: accent + "40",
                              },
                            ]}
                            className="flex-col overflow-hidden rounded-xl"
                          >
                            <Box style={styles.rowMain} className="min-w-0">
                              <HStack style={styles.pidPortRow} className="flex-wrap gap-2 mb-2">
                                <Box style={[styles.pill, { backgroundColor: accent + "12", borderColor: accent + "30" }]}>
                                  <Text size="xs" bold style={{ color: accent }}>PID {proc.pid}</Text>
                                </Box>
                                <Box style={[styles.pill, { backgroundColor: accent + "12", borderColor: accent + "30" }]}>
                                  <Text size="xs" bold style={{ color: accent }}>Port {proc.port}</Text>
                                </Box>
                              </HStack>
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
                            <HStack style={styles.rowActions} className="flex-wrap gap-2">
                              {logPaths.map((logPath) => {
                                const label = logPath.includes("/") ? logPath.split("/").pop() ?? logPath : logPath;
                                return (
                                  <Pressable
                                    key={logPath}
                                    onPress={() => handleViewLog(logPath)}
                                    style={[styles.logButton, { backgroundColor: accent + "12", borderColor: accent + "40" }]}
                                    accessibilityLabel={`View log ${label}`}
                                  >
                                    <Text size="xs" bold style={{ color: accent }}>Log: {label}</Text>
                                  </Pressable>
                                );
                              })}
                              <Box style={styles.killButtonWrap}>
                                <Button
                                  action="negative"
                                  variant="solid"
                                  size="sm"
                                  onPress={() => handleKillApiProcess(proc)}
                                  isDisabled={killingPid === proc.pid}
                                  style={styles.killButton}
                                >
                                  <ButtonText>{killingPid === proc.pid ? "…" : "Kill"}</ButtonText>
                                </Button>
                              </Box>
                            </HStack>
                          </Box>
                        </EntranceAnimation>
                      );
                    })}
                  </VStack>
                ) : null}
            </AsyncStateView>
          </ScrollView>
            </SafeAreaView>
          </Box>

      {logViewer && (
        <Modal
          isOpen={true}
          onClose={() => setLogViewer(null)}
          size="full"
        >
          <ModalBackdrop onPress={() => setLogViewer(null)} />
          <ModalContent className="w-full h-full max-w-none rounded-none border-0 p-0">
            <ModalBody className="m-0 p-0">
              <Box style={[styles.fullScreen, { paddingTop: insets.top }]}>
                <SafeAreaView style={styles.logViewerSafe} edges={["left", "right", "bottom"]}>
            <HStack style={[styles.logViewerHeader, { borderBottomColor: theme.colors.accent + "30" }]}>
              <HStack className="flex-1 items-center gap-2 min-w-0">
                <Box style={[styles.accentBar, { backgroundColor: theme.colors.accent }]} />
                <Text size="md" bold numberOfLines={1} className="flex-1 text-typography-900 min-w-0">
                  {logViewer.name}
                </Text>
              </HStack>
              <Button
                action="default"
                variant="link"
                size="md"
                onPress={() => setLogViewer(null)}
                accessibilityLabel="Close log viewer"
                className="min-w-11 min-h-11 -mr-2"
              >
                <ButtonIcon as={CloseIcon} size="md" style={{ color: theme.colors?.textMuted ?? theme.colors.textSecondary }} />
              </Button>
            </HStack>
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
            </ModalBody>
          </ModalContent>
        </Modal>
      )}
    </ModalScaffold>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    fullScreen: {
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
      fontSize: 17,
      fontWeight: "700",
      color: theme.colors.textPrimary,
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
      marginHorizontal: spacing["5"],
      marginTop: spacing["2"],
      padding: spacing["4"],
      borderRadius: radii.lg,
      borderWidth: 1,
    },
    errorText: {
      color: (theme as { colors?: { error?: string } }).colors?.error ?? theme.colors.danger ?? "#dc2626",
      fontSize: 14,
    },
    errorHint: {
      color: (theme as { colors?: { error?: string } }).colors?.error ?? theme.colors.danger ?? "#dc2626",
      fontSize: 12,
      marginTop: 8,
      lineHeight: 18,
      opacity: 0.95,
    },
    warningBanner: {
      marginHorizontal: spacing["5"],
      marginTop: spacing["2"],
      padding: spacing["4"],
      borderRadius: radii.lg,
    },
    warningText: {
      color: theme.colors.textPrimary,
      fontSize: 13,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing["5"],
      paddingTop: spacing["4"],
      paddingBottom: spacing["6"],
    },
    loading: {
      paddingVertical: 32,
      alignItems: "center",
      gap: 10,
    },
    loadingText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    section: {
      marginBottom: spacing["4"],
    },
    sectionTitle: {
      fontSize: 10,
      fontWeight: "700",
      color: theme.colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 10,
    },
    row: {
      flexDirection: "column",
      paddingVertical: spacing["3"],
      paddingHorizontal: spacing["4"],
      borderRadius: radii.lg,
      marginBottom: spacing["3"],
      gap: spacing["2"],
      borderWidth: 1,
      borderLeftWidth: 4,
    },
    rowMain: {
      minWidth: 0,
    },
    rowActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing["2"],
      flexWrap: "wrap",
      flexShrink: 0,
    },
    logButton: {
      paddingVertical: spacing["2"],
      paddingHorizontal: spacing["3"],
      borderRadius: radii.md,
      borderWidth: 1,
      minWidth: 64,
    },
    logButtonVisible: {
      minWidth: 64,
    },
    logButtonText: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.accent,
    },
    pidPortRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing["2"],
    },
    pill: {
      paddingVertical: spacing["0.5"],
      paddingHorizontal: spacing["2"],
      borderRadius: radii.sm,
      borderWidth: 1,
    },
    pillText: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.colors.accent,
      letterSpacing: 0.2,
    },
    command: {
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "600",
      color: theme.colors.textPrimary,
      fontFamily: Platform?.OS === "ios" ? "Menlo" : "monospace",
    },
    killButtonWrap: {
      minHeight: 36,
      justifyContent: "center",
    },
    killButton: {
      borderRadius: radii.md,
    },
    killButtonLabel: {
      fontSize: 12,
      fontWeight: "700",
    },
    empty: {
      alignItems: "center",
    },
    emptyIconContainer: {
      width: 72,
      height: 72,
      borderRadius: radii.xl,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyText: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.textSecondary,
      marginBottom: 6,
    },
    emptyHint: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.colors.textSecondary,
      textAlign: "center",
      maxWidth: 280,
    },
    logViewerSafe: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    logViewerHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing["3"],
      paddingHorizontal: spacing["5"],
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
      padding: spacing["5"],
      paddingBottom: spacing["6"],
    },
    logViewerText: {
      fontFamily: Platform?.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 11,
      color: theme.colors.textPrimary,
    },
  });
}
