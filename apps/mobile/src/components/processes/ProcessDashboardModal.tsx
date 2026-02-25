import React, { useMemo, useState, useCallback, useEffect } from "react";
import { StyleSheet, Platform } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { triggerHaptic, spacing } from "@/design-system";
import { CloseIcon } from "@/components/icons/ChatActionIcons";
import { useTheme } from "@/theme/index";
import { showAlert } from "@/components/ui/alert/native-alert";
import { Box } from "@/components/ui/box";
import { Button, ButtonIcon } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Text } from "@/components/ui/text";
import { AsyncStateView } from "@/components/reusable/AsyncStateView";
import { ModalScaffold } from "@/components/reusable/ModalScaffold";
import { ListSectionCard } from "@/components/reusable/ListSectionCard";
import { ProcessListItemCard } from "@/components/reusable/ProcessListItem";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
} from "@/components/ui/modal";
import { ScrollView } from "@/components/ui/scroll-view";
import { RefreshControl } from "@/components/ui/refresh-control";

export interface ApiProcess {
  pid: number;
  port: number;
  command: string;
  /** Log file names extracted from command (>> file.log, > file.log) */
  logPaths?: string[];
}

export interface ProcessDashboardModalProps {
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

function getTerminalFontFamily() {
  return Platform.OS === "ios" ? "Menlo" : "monospace";
}

export function ProcessDashboardModal({
  isOpen,
  onClose,
  serverBaseUrl,
}: ProcessDashboardModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [apiProcesses, setApiProcesses] = useState<ApiProcess[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [killingPid, setKillingPid] = useState<number | null>(null);
  const [logViewer, setLogViewer] = useState<{ name: string; content: string } | null>(null);

  const terminalFont = useMemo(getTerminalFontFamily, []);

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

  const hasProcesses = apiProcesses.length > 0;
  const isEmpty = !hasProcesses && !loading && !error;
  const headerDividerStyle = useMemo(
    () => ({
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: `${theme.colors.accent}30`,
    }),
    [theme.colors.accent]
  );
  const errorBannerStyle = useMemo(
    () => ({
      backgroundColor: `${theme.colors.danger}12`,
      borderColor: `${theme.colors.danger}25`,
    }),
    [theme.colors.danger]
  );
  const warningBannerStyle = useMemo(
    () => ({
      backgroundColor: theme.colors.accentSoft,
    }),
    [theme.colors.accentSoft]
  );
  const containerStyle = useMemo(
    () => ({ backgroundColor: theme.colors.background, paddingTop: insets.top }),
    [theme.colors.background, insets.top]
  );

  if (!isOpen) return null;

  return (
    <ModalScaffold
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      title="Process Dashboard"
      subtitle="Port-bound process information"
      showCloseButton={false}
      contentClassName="w-full h-full max-w-none rounded-none border-0 p-0"
      bodyClassName="m-0 p-0"
      bodyProps={{ scrollEnabled: false }}
    >
      <Box className="flex-1" style={containerStyle}>
        <SafeAreaView style={{ flex: 1 }} edges={["left", "right", "bottom"]}>
          <HStack className="items-center justify-between px-5 py-3 border-b" style={headerDividerStyle}>
            <HStack className="flex-1 items-center gap-2">
              <Box className="w-1 h-6 rounded-sm bg-primary-500" style={{ backgroundColor: theme.colors.accent }} />
              <Text size="xl" bold className="text-typography-900">
                Process Dashboard
              </Text>
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

          {error ? (
            <Box
              className="mx-5 mt-2 gap-2 rounded-xl border p-4"
              style={errorBannerStyle}
            >
              <Text size="sm" className="text-error-600">
                {error}
              </Text>
              <Text size="xs" className="text-error-600 leading-4.5 opacity-90">
                Ensure the app can reach the server. On a physical device, use the machine&apos;s IP or EXPO_PUBLIC_SERVER_URL.
              </Text>
            </Box>
          ) : null}

          {warning && !error ? (
            <Box className="mx-5 mt-2 rounded-xl p-4" style={warningBannerStyle}>
              <Text size="sm" className="text-typography-900">
                {warning}
              </Text>
            </Box>
          ) : null}

          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              paddingHorizontal: spacing["5"],
              paddingTop: spacing["4"],
              paddingBottom: spacing["6"],
            }}
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
              isEmpty={isEmpty}
              loadingText="Loading processes..."
              emptyTitle="No running processes found"
              emptyDescription="Port-bound processes (e.g. dev servers on 3000, 8000) will appear here when active."
            >
              {hasProcesses ? (
                <ListSectionCard
                  title="Port-bound processes"
                  subtitle="Active local/dev server processes"
                  className="mb-4"
                >
                  <VStack className="gap-3">
                    {[...apiProcesses]
                      .sort((a, b) => b.pid - a.pid)
                      .map((proc) => (
                        <ProcessListItemCard
                          key={`${proc.pid}-${proc.port}`}
                          pid={proc.pid}
                          port={proc.port}
                          command={proc.command}
                          logPaths={proc.logPaths}
                          accentColor={theme.colors.accent}
                          isKilling={killingPid === proc.pid}
                          onViewLog={handleViewLog}
                          onKill={() => handleKillApiProcess(proc)}
                        />
                      ))}
                  </VStack>
                </ListSectionCard>
              ) : null}
            </AsyncStateView>
          </ScrollView>
        </SafeAreaView>
      </Box>

      {logViewer ? (
        <Modal isOpen onClose={() => setLogViewer(null)} size="full">
          <ModalBackdrop onPress={() => setLogViewer(null)} />
          <ModalContent className="w-full h-full max-w-none rounded-none border-0 p-0">
            <ModalBody className="m-0 p-0">
              <Box className="flex-1" style={containerStyle}>
                <SafeAreaView style={{ flex: 1 }} edges={["left", "right", "bottom"]}>
                  <HStack className="items-center justify-between px-5 py-3 border-b" style={headerDividerStyle}>
                    <HStack className="min-w-0 flex-1 items-center gap-2">
                      <Box className="w-1 h-6 rounded-sm bg-primary-500" style={{ backgroundColor: theme.colors.accent }} />
                      <Text
                        size="md"
                        bold
                        numberOfLines={1}
                        className="min-w-0 flex-1 text-typography-900"
                      >
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
                    className="flex-1"
                    contentContainerStyle={{
                      padding: spacing["5"],
                      paddingBottom: spacing["6"],
                    }}
                    horizontal={false}
                  >
                    <Text
                      size="xs"
                      selectable
                      className="text-typography-900 font-mono"
                      style={{ fontFamily: terminalFont }}
                    >
                      {logViewer.content || "(empty)"}
                    </Text>
                  </ScrollView>
                </SafeAreaView>
              </Box>
            </ModalBody>
          </ModalContent>
        </Modal>
      ) : null}
    </ModalScaffold>
  );
}
