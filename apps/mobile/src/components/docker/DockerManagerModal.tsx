import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  ScrollView,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { AppButton, AppText, Skeleton, triggerHaptic } from "../../design-system";
import { useTheme } from "../../theme/index";
import { DockerIcon, ContainerIcon, ImageIcon, VolumeIcon, CloseIcon, CopyIcon, ChevronLeftIcon, PanelLeftIcon } from "./DockerTabIcons";

export type DockerTab = "containers" | "images" | "volumes";

export interface DockerContainer {
  id: string;
  names: string[];
  image: string;
  status: string;
  state: string;
  ports: string;
  created: string;
}

export interface DockerImage {
  id: string;
  repoTags: string[];
  size: number;
  created: string;
}

export interface DockerVolume {
  name: string;
  driver: string;
  mountpoint: string;
  created: string;
}

export interface DockerManagerModalProps {
  visible: boolean;
  onClose: () => void;
  serverBaseUrl: string;
}

function statusClass(state: string): "running" | "exited" | "paused" | "unknown" {
  const s = (state || "").toLowerCase();
  if (s.includes("running")) return "running";
  if (s.includes("exited") || s.includes("dead")) return "exited";
  if (s.includes("paused")) return "paused";
  return "unknown";
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function DockerManagerModal({
  visible,
  onClose,
  serverBaseUrl,
}: DockerManagerModalProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [activeTab, setActiveTab] = useState<DockerTab>("containers");
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [volumes, setVolumes] = useState<DockerVolume[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [actingImageId, setActingImageId] = useState<string | null>(null);
  const [actingVolumeName, setActingVolumeName] = useState<string | null>(null);
  const [logsFor, setLogsFor] = useState<{ id: string; name: string } | null>(null);
  const [logsContent, setLogsContent] = useState<string>("");
  const [logsLoading, setLogsLoading] = useState(false);
  const [volumeSearch, setVolumeSearch] = useState("");

  const errMsg = (data: unknown, status: number) =>
    (data as { error?: string })?.error ??
    (status === 404
      ? "Docker manager is disabled. Set ENABLE_DOCKER_MANAGER=1 on the server."
      : status === 503
        ? "Docker daemon not available."
        : `Request failed (${status})`);

  const fetchContainers = useCallback(async () => {
    const url = `${serverBaseUrl}/api/docker/containers?all=${showAll ? "true" : "false"}`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(errMsg(data, res.status));
    return (data.containers ?? []) as DockerContainer[];
  }, [serverBaseUrl, showAll]);

  const fetchImages = useCallback(async () => {
    const res = await fetch(`${serverBaseUrl}/api/docker/images`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(errMsg(data, res.status));
    return (data.images ?? []) as DockerImage[];
  }, [serverBaseUrl]);

  const fetchVolumes = useCallback(async () => {
    const res = await fetch(`${serverBaseUrl}/api/docker/volumes`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(errMsg(data, res.status));
    return (data.volumes ?? []) as DockerVolume[];
  }, [serverBaseUrl]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const list = await fetchContainers();
        setContainers(list);
      } catch (err) {
        setContainers([]);
        setError(err instanceof Error ? err.message : "Failed to load containers");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchContainers]
  );

  const loadImages = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const list = await fetchImages();
        setImages(list);
      } catch (err) {
        setImages([]);
        setError(err instanceof Error ? err.message : "Failed to load images");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchImages]
  );

  const loadVolumes = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const list = await fetchVolumes();
        setVolumes(list);
      } catch (err) {
        setVolumes([]);
        setError(err instanceof Error ? err.message : "Failed to load volumes");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchVolumes]
  );

  useEffect(() => {
    if (visible && serverBaseUrl) {
      if (activeTab === "containers") load();
      else if (activeTab === "images") loadImages();
      else loadVolumes();
    }
  }, [visible, serverBaseUrl, activeTab, showAll, load, loadImages, loadVolumes]);

  const handleAction = useCallback(
    async (id: string, op: "start" | "stop" | "restart" | "remove") => {
      if (op === "remove") {
        Alert.alert(
          "Remove container",
          "Are you sure you want to remove this container?",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Remove", style: "destructive", onPress: () => doAction(id, op) },
          ]
        );
        return;
      }
      await doAction(id, op);
    },
    [serverBaseUrl]
  );

  const doAction = useCallback(
    async (id: string, op: "start" | "stop" | "restart" | "remove") => {
      setActingId(id);
      try {
        if (op === "remove") {
          const res = await fetch(
            `${serverBaseUrl}/api/docker/containers/${encodeURIComponent(id)}?force=true`,
            { method: "DELETE" }
          );
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error ?? "Failed to remove");
        } else {
          const res = await fetch(
            `${serverBaseUrl}/api/docker/containers/${encodeURIComponent(id)}/${op}`,
            { method: "POST" }
          );
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error ?? `Failed to ${op}`);
        }
        await load(true);
      } catch (err) {
        Alert.alert("Error", err instanceof Error ? err.message : `Failed to ${op}`);
      } finally {
        setActingId(null);
      }
    },
    [serverBaseUrl, load]
  );

  const openLogs = useCallback(
    async (id: string, name: string) => {
      setLogsFor({ id, name });
      setLogsContent("");
      setLogsLoading(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      try {
        const res = await fetch(
          `${serverBaseUrl}/api/docker/containers/${encodeURIComponent(id)}/logs?tail=500`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);
        const raw = await res.text();
        const data = raw ? (() => { try { return JSON.parse(raw); } catch { return { _raw: raw }; }})() : {};
        if (!res.ok) {
          const msg = data?.error ?? data?._raw ?? `HTTP ${res.status}`;
          throw new Error(typeof msg === "string" ? msg : "Failed to load logs");
        }
        setLogsContent(data.logs ?? "(no logs)");
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error) {
          setLogsContent(err.name === "AbortError" ? "Request timed out (30s)" : err.message);
        } else {
          setLogsContent("Failed to load logs");
        }
      } finally {
        setLogsLoading(false);
      }
    },
    [serverBaseUrl]
  );

  const closeLogs = useCallback(() => {
    setLogsFor(null);
    setLogsContent("");
  }, []);

  const handleRemoveImage = useCallback(
    async (id: string) => {
      Alert.alert(
        "Remove image",
        "Are you sure you want to remove this image?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              setActingImageId(id);
              try {
                const res = await fetch(
                  `${serverBaseUrl}/api/docker/images/${encodeURIComponent(id)}?force=true`,
                  { method: "DELETE" }
                );
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error((data as { error?: string })?.error ?? "Failed to remove");
                await loadImages(true);
              } catch (err) {
                Alert.alert("Error", err instanceof Error ? err.message : "Failed to remove image");
              } finally {
                setActingImageId(null);
              }
            },
          },
        ]
      );
    },
    [serverBaseUrl, loadImages]
  );

  const handlePruneImages = useCallback(async () => {
    Alert.alert(
      "Prune images",
      "Remove unused (dangling) images?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Prune",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            setError(null);
            try {
              const res = await fetch(`${serverBaseUrl}/api/docker/images/prune`, { method: "POST" });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error((data as { error?: string })?.error ?? "Failed to prune");
              await loadImages(true);
            } catch (err) {
              Alert.alert("Error", err instanceof Error ? err.message : "Failed to prune images");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }, [serverBaseUrl, loadImages]);

  const handleRemoveVolume = useCallback(
    async (name: string) => {
      Alert.alert(
        "Remove volume",
        `Are you sure you want to remove volume "${name}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              setActingVolumeName(name);
              try {
                const res = await fetch(
                  `${serverBaseUrl}/api/docker/volumes/${encodeURIComponent(name)}`,
                  { method: "DELETE" }
                );
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error((data as { error?: string })?.error ?? "Failed to remove");
                await loadVolumes(true);
              } catch (err) {
                Alert.alert("Error", err instanceof Error ? err.message : "Failed to remove volume");
              } finally {
                setActingVolumeName(null);
              }
            },
          },
        ]
      );
    },
    [serverBaseUrl, loadVolumes]
  );

  const handlePruneVolumes = useCallback(async () => {
    Alert.alert(
      "Prune volumes",
      "Remove volumes not used by any container? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Prune",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            setError(null);
            try {
              const res = await fetch(`${serverBaseUrl}/api/docker/volumes/prune`, { method: "POST" });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error((data as { error?: string })?.error ?? "Failed to prune");
              await loadVolumes(true);
            } catch (err) {
              Alert.alert("Error", err instanceof Error ? err.message : "Failed to prune volumes");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }, [serverBaseUrl, loadVolumes]);

  const handleTabChange = useCallback((tab: DockerTab) => {
    setActiveTab(tab);
    setError(null);
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      triggerHaptic("success");
    } catch {
      triggerHaptic("error");
    }
  }, []);

  const filteredVolumes = useMemo(() => {
    if (!volumeSearch.trim()) return volumes;
    const q = volumeSearch.trim().toLowerCase();
    return volumes.filter((v) => v.name.toLowerCase().includes(q) || (v.mountpoint ?? "").toLowerCase().includes(q));
  }, [volumes, volumeSearch]);

  if (!visible) return null;

  const tabColor = (t: DockerTab) =>
    activeTab === t
      ? (theme.accent ?? theme.colors.accent)
      : (theme.textMuted ?? theme.colors.textSecondary);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.fullScreen}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <TouchableOpacity
                onPress={() => {
                  triggerHaptic("selection");
                  setSidebarVisible((v) => !v);
                }}
                style={styles.menuToggleBtn}
                hitSlop={12}
                accessibilityLabel={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
                accessibilityRole="button"
              >
                {sidebarVisible ? (
                  <ChevronLeftIcon color={theme.textMuted ?? theme.colors.textSecondary} />
                ) : (
                  <PanelLeftIcon color={theme.textMuted ?? theme.colors.textSecondary} />
                )}
              </TouchableOpacity>
              <View style={styles.headerTitleRow}>
                <DockerIcon color={theme.textPrimary ?? theme.colors.textPrimary} size={24} />
                <Text style={styles.title}>Docker</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={12}
              accessibilityLabel="Close Docker manager"
              accessibilityRole="button"
            >
              <CloseIcon color={theme.textMuted ?? theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.tabRow}>
            {sidebarVisible && (
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabItem, activeTab === "containers" && styles.tabItemActive]}
                onPress={() => handleTabChange("containers")}
                activeOpacity={0.8}
              >
                <ContainerIcon color={tabColor("containers")} />
                <Text style={[styles.tabLabel, activeTab === "containers" && styles.tabLabelActive]}>
                  Containers
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabItem, activeTab === "images" && styles.tabItemActive]}
                onPress={() => handleTabChange("images")}
                activeOpacity={0.8}
              >
                <ImageIcon color={tabColor("images")} />
                <Text style={[styles.tabLabel, activeTab === "images" && styles.tabLabelActive]}>
                  Images
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabItem, activeTab === "volumes" && styles.tabItemActive]}
                onPress={() => handleTabChange("volumes")}
                activeOpacity={0.8}
              >
                <VolumeIcon color={tabColor("volumes")} />
                <Text style={[styles.tabLabel, activeTab === "volumes" && styles.tabLabelActive]}>
                  Volumes
                </Text>
              </TouchableOpacity>
            </View>
            )}

            <View style={styles.contentArea}>
              {activeTab === "containers" && (
                <>
                  <View style={styles.toolbar}>
                    <TouchableOpacity
                      style={[styles.filterChip, showAll && styles.filterChipActive]}
                      onPress={() => setShowAll(true)}
                      activeOpacity={0.8}
                      accessibilityLabel="Show all containers"
                      accessibilityRole="button"
                      accessibilityState={{ selected: showAll }}
                    >
                      <Text style={[styles.filterChipText, showAll && styles.filterChipTextActive]}>
                        All
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.filterChip, !showAll && styles.filterChipActive]}
                      onPress={() => setShowAll(false)}
                      activeOpacity={0.8}
                      accessibilityLabel="Show running containers only"
                      accessibilityRole="button"
                      accessibilityState={{ selected: !showAll }}
                    >
                      <Text style={[styles.filterChipText, !showAll && styles.filterChipTextActive]}>
                        Running
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {error ? (
                    <View style={styles.errorBox}>
                      <AppText variant="callout" tone="primary" style={{ color: theme.colors.danger }}>
                        {error}
                      </AppText>
                    </View>
                  ) : loading && containers.length === 0 ? (
                    <View style={styles.skeletonList}>
                      {[1, 2, 3].map((i) => (
                        <View key={i} style={styles.card}>
                          <Skeleton height={18} width="70%" style={{ marginBottom: 12 }} />
                          <Skeleton height={14} width="100%" style={{ marginBottom: 8 }} />
                          <Skeleton height={14} width="60%" style={{ marginBottom: 8 }} />
                          <Skeleton height={14} width="40%" />
                        </View>
                      ))}
                    </View>
                  ) : containers.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <AppText variant="callout" tone="muted">
                        No containers found.
                      </AppText>
                    </View>
                  ) : (
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
                      {containers.map((c) => {
                const names = (c.names ?? []).join(", ") || c.id?.slice(0, 12) || "—";
                const isRunning = (c.state ?? "").toLowerCase().includes("running");
                const acting = actingId === c.id;
                const statusCls = statusClass(c.state);
                return (
                  <View key={c.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardName} numberOfLines={1}>
                        {names}
                      </Text>
                      <TouchableOpacity
                        onPress={() => copyToClipboard(c.id)}
                        style={styles.copyBtn}
                        accessibilityLabel="Copy container ID"
                        accessibilityRole="button"
                      >
                        <CopyIcon color={theme.textMuted ?? theme.colors.textSecondary} size={18} />
                      </TouchableOpacity>
                      <View
                        style={[
                          styles.statusBadge,
                          statusCls === "running" && styles.status_running,
                          statusCls === "exited" && styles.status_exited,
                          statusCls === "paused" && styles.status_paused,
                          statusCls === "unknown" && styles.status_unknown,
                        ]}
                      >
                        <Text style={styles.statusText}>{c.status || "—"}</Text>
                      </View>
                    </View>
                    <View style={styles.cardRow}>
                      <Text style={styles.cardLabel}>Image</Text>
                      <Text style={styles.cardValue} numberOfLines={1}>
                        {c.image || "—"}
                      </Text>
                    </View>
                    <View style={styles.cardRow}>
                      <Text style={styles.cardLabel}>Ports</Text>
                      <Text style={styles.cardValue} numberOfLines={2}>
                        {c.ports || "—"}
                      </Text>
                    </View>
                    <View style={styles.cardRow}>
                      <Text style={styles.cardLabel}>Created</Text>
                      <Text style={styles.cardValue}>{formatDate(c.created)}</Text>
                    </View>
                    <View style={styles.actions}>
                      <AppButton
                        label="Logs"
                        variant="secondary"
                        size="sm"
                        onPress={() => openLogs(c.id, names)}
                        disabled={acting}
                      />
                      {!isRunning ? (
                        <AppButton
                          label="Start"
                          variant="primary"
                          size="sm"
                          onPress={() => handleAction(c.id, "start")}
                          disabled={acting}
                        />
                      ) : (
                        <>
                          <AppButton
                            label="Stop"
                            variant="secondary"
                            size="sm"
                            onPress={() => handleAction(c.id, "stop")}
                            disabled={acting}
                          />
                          <AppButton
                            label="Restart"
                            variant="secondary"
                            size="sm"
                            onPress={() => handleAction(c.id, "restart")}
                            disabled={acting}
                          />
                        </>
                      )}
                      <AppButton
                        label="Remove"
                        variant="danger"
                        size="sm"
                        onPress={() => handleAction(c.id, "remove")}
                        disabled={acting}
                      />
                    </View>
                  </View>
                );
              })}
            </ScrollView>
                  )}
                </>
              )}

              {activeTab === "images" && (
                <>
                  <View style={styles.toolbar}>
                    <AppButton
                      label="Prune unused"
                      variant="secondary"
                      size="sm"
                      onPress={handlePruneImages}
                      disabled={loading}
                    />
                  </View>
                  {error ? (
                    <View style={styles.errorBox}>
                      <AppText variant="callout" tone="primary" style={{ color: theme.colors.danger }}>
                        {error}
                      </AppText>
                    </View>
                  ) : loading && images.length === 0 ? (
                    <View style={styles.skeletonList}>
                      {[1, 2, 3].map((i) => (
                        <View key={i} style={styles.card}>
                          <Skeleton height={18} width="80%" style={{ marginBottom: 12 }} />
                          <Skeleton height={14} width="50%" style={{ marginBottom: 8 }} />
                          <Skeleton height={14} width="40%" />
                        </View>
                      ))}
                    </View>
                  ) : images.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <AppText variant="callout" tone="muted">
                        No images found.
                      </AppText>
                    </View>
                  ) : (
                    <ScrollView
                      style={styles.scroll}
                      contentContainerStyle={styles.scrollContent}
                      refreshControl={
                        <RefreshControl
                          refreshing={refreshing}
                          onRefresh={() => loadImages(true)}
                          tintColor={theme.colors.accent}
                        />
                      }
                    >
                      {images.map((img) => {
                        const tags = (img.repoTags ?? []).filter(Boolean);
                        const display = tags.length ? tags.join(", ") : img.id?.slice(0, 12) || "—";
                        const acting = actingImageId === img.id;
                        return (
                          <View key={img.id} style={styles.card}>
                            <View style={styles.cardHeader}>
                              <Text style={styles.cardName} numberOfLines={2}>
                                {display}
                              </Text>
                              <TouchableOpacity
                                onPress={() => copyToClipboard(img.id)}
                                style={styles.copyBtn}
                                accessibilityLabel="Copy image ID"
                                accessibilityRole="button"
                              >
                                <CopyIcon color={theme.textMuted ?? theme.colors.textSecondary} size={18} />
                              </TouchableOpacity>
                            </View>
                            <View style={styles.cardRow}>
                              <Text style={styles.cardLabel}>Size</Text>
                              <Text style={styles.cardValue}>{formatBytes(img.size)}</Text>
                            </View>
                            <View style={styles.cardRow}>
                              <Text style={styles.cardLabel}>Created</Text>
                              <Text style={styles.cardValue}>{formatDate(img.created)}</Text>
                            </View>
                            <View style={styles.actions}>
                              <AppButton
                                label="Remove"
                                variant="danger"
                                size="sm"
                                onPress={() => handleRemoveImage(img.id)}
                                disabled={acting}
                              />
                            </View>
                          </View>
                        );
                      })}
                    </ScrollView>
                  )}
                </>
              )}

              {activeTab === "volumes" && (
                <>
                  <View style={styles.toolbar}>
                    <TextInput
                      style={[
                        styles.searchInput,
                        { color: theme.textPrimary, borderColor: theme.borderColor ?? theme.colors.border },
                      ]}
                      placeholder="Search volumes…"
                      placeholderTextColor={theme.textMuted ?? theme.colors.textMuted}
                      value={volumeSearch}
                      onChangeText={setVolumeSearch}
                      accessibilityLabel="Search volumes by name or mount point"
                    />
                    <AppButton
                      label="Prune unused"
                      variant="secondary"
                      size="sm"
                      onPress={handlePruneVolumes}
                      disabled={loading}
                    />
                  </View>
                  {error ? (
                    <View style={styles.errorBox}>
                      <AppText variant="callout" tone="primary" style={{ color: theme.colors.danger }}>
                        {error}
                      </AppText>
                    </View>
                  ) : loading && volumes.length === 0 ? (
                    <View style={styles.skeletonList}>
                      {[1, 2, 3].map((i) => (
                        <View key={i} style={styles.card}>
                          <Skeleton height={18} width="75%" style={{ marginBottom: 12 }} />
                          <Skeleton height={14} width="30%" style={{ marginBottom: 8 }} />
                          <Skeleton height={14} width="100%" style={{ marginBottom: 8 }} />
                          <Skeleton height={14} width="50%" />
                        </View>
                      ))}
                    </View>
                  ) : filteredVolumes.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <AppText variant="callout" tone="muted">
                        {volumeSearch.trim() ? "No matching volumes." : "No volumes found."}
                      </AppText>
                    </View>
                  ) : (
                    <ScrollView
                      style={styles.scroll}
                      contentContainerStyle={styles.scrollContent}
                      refreshControl={
                        <RefreshControl
                          refreshing={refreshing}
                          onRefresh={() => loadVolumes(true)}
                          tintColor={theme.colors.accent}
                        />
                      }
                    >
                      {filteredVolumes.map((v) => {
                        const acting = actingVolumeName === v.name;
                        return (
                          <View key={v.name} style={styles.card}>
                            <View style={styles.cardHeader}>
                              <Text style={styles.cardName} numberOfLines={1}>
                                {v.name}
                              </Text>
                              <TouchableOpacity
                                onPress={() => copyToClipboard(v.name)}
                                style={styles.copyBtn}
                                accessibilityLabel="Copy volume name"
                                accessibilityRole="button"
                              >
                                <CopyIcon color={theme.textMuted ?? theme.colors.textSecondary} size={18} />
                              </TouchableOpacity>
                            </View>
                            <View style={styles.cardRow}>
                              <Text style={styles.cardLabel}>DRIVER</Text>
                              <Text style={styles.cardValue}>{v.driver || "—"}</Text>
                            </View>
                            <View style={styles.cardRow}>
                              <Text style={styles.cardLabel}>MOUNT POINT</Text>
                              <View style={styles.cardValueRow}>
                                <Text style={[styles.cardValue, { flex: 1 }]} numberOfLines={2}>
                                  {v.mountpoint || "—"}
                                </Text>
                                <TouchableOpacity
                                  onPress={() => copyToClipboard(v.mountpoint ?? "")}
                                  style={styles.copyBtn}
                                  accessibilityLabel="Copy mount point"
                                  accessibilityRole="button"
                                >
                                  <CopyIcon color={theme.textMuted ?? theme.colors.textSecondary} size={18} />
                                </TouchableOpacity>
                              </View>
                            </View>
                            <View style={styles.cardRow}>
                              <Text style={styles.cardLabel}>CREATED</Text>
                              <Text style={styles.cardValue}>{formatDate(v.created)}</Text>
                            </View>
                            <View style={styles.actions}>
                              <AppButton
                                label="Remove"
                                variant="danger"
                                size="sm"
                                onPress={() => handleRemoveVolume(v.name)}
                                disabled={acting}
                              />
                            </View>
                          </View>
                        );
                      })}
                    </ScrollView>
                  )}
                </>
              )}
            </View>
          </View>
        </SafeAreaView>
      </View>

      {logsFor && (
        <Modal
          visible={!!logsFor}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeLogs}
        >
          <View style={styles.fullScreen}>
            <SafeAreaView style={styles.safe}>
              <View style={styles.header}>
                <Text style={styles.title} numberOfLines={1}>
                  Logs: {logsFor.name}
                </Text>
                <TouchableOpacity
                  onPress={closeLogs}
                  style={styles.closeBtn}
                  hitSlop={12}
                  accessibilityLabel="Close logs"
                  accessibilityRole="button"
                >
                  <CloseIcon color={theme.textMuted ?? theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
              {logsLoading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color={theme.colors.accent} />
                  <AppText variant="callout" tone="muted" style={styles.loadingText}>
                    Loading logs…
                  </AppText>
                </View>
              ) : (
                <ScrollView
                  style={styles.scroll}
                  contentContainerStyle={[styles.scrollContent, styles.logsContent]}
                >
                  <Text style={styles.logsText} selectable>
                    {logsContent}
                  </Text>
                </ScrollView>
              )}
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
      backgroundColor: theme.beigeBg ?? theme.colors.background,
    },
    safe: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderColor ?? theme.colors.border,
    },
    title: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.textPrimary ?? theme.colors.textPrimary,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    headerTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    menuToggleBtn: {
      minWidth: 44,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    closeBtn: {
      minWidth: 44,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    tabRow: {
      flex: 1,
      flexDirection: "row",
    },
    tabBar: {
      minWidth: 120,
      width: 140,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: theme.borderColor ?? theme.colors.border,
      backgroundColor: theme.cardBg ?? theme.colors.surfaceMuted,
    },
    tabItem: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "stretch",
      gap: 10,
      minHeight: 44,
      paddingVertical: 12,
      paddingHorizontal: 12,
      marginBottom: 4,
      borderRadius: 8,
    },
    tabItemActive: {
      backgroundColor: theme.accentLight ?? theme.colors.accent + "20",
    },
    tabLabel: {
      fontSize: 14,
      color: theme.textMuted ?? theme.colors.textSecondary,
    },
    tabLabelActive: {
      color: theme.accent ?? theme.colors.accent,
      fontWeight: "600",
    },
    contentArea: {
      flex: 1,
    },
    toolbar: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderColor ?? theme.colors.border,
    },
    searchInput: {
      flex: 1,
      minWidth: 120,
      height: 40,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      fontSize: 14,
    },
    copyBtn: {
      minWidth: 36,
      minHeight: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    cardValueRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    filterChip: {
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 8,
      backgroundColor: theme.cardBg ?? theme.colors.surfaceMuted,
    },
    filterChipActive: {
      backgroundColor: theme.accentLight ?? theme.colors.accent + "20",
    },
    filterChipText: {
      fontSize: 14,
      color: theme.textMuted ?? theme.colors.textSecondary,
    },
    filterChipTextActive: {
      color: theme.accent ?? theme.colors.accent,
      fontWeight: "600",
    },
    errorBox: {
      flex: 1,
      padding: 24,
      justifyContent: "center",
    },
    loadingBox: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    loadingText: {
      marginTop: 12,
    },
    skeletonList: {
      padding: 16,
      paddingBottom: 32,
    },
    emptyBox: {
      flex: 1,
      padding: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 32,
    },
    card: {
      marginBottom: 16,
      padding: 16,
      borderRadius: 12,
      backgroundColor: theme.cardBg ?? theme.colors.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.borderColor ?? theme.colors.border,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
      gap: 12,
    },
    cardName: {
      flex: 1,
      fontSize: 16,
      fontWeight: "600",
      color: theme.textPrimary ?? theme.colors.textPrimary,
    },
    statusBadge: {
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 6,
    },
    status_running: {
      backgroundColor: "rgba(34, 197, 94, 0.2)",
    },
    status_exited: {
      backgroundColor: "rgba(107, 114, 128, 0.2)",
    },
    status_paused: {
      backgroundColor: "rgba(234, 179, 8, 0.2)",
    },
    status_unknown: {
      backgroundColor: "rgba(107, 114, 128, 0.2)",
    },
    statusText: {
      fontSize: 12,
      color: theme.textPrimary ?? theme.colors.textPrimary,
    },
    cardRow: {
      marginBottom: 8,
    },
    cardLabel: {
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      color: theme.textMuted ?? theme.colors.textSecondary,
      marginBottom: 2,
    },
    cardValue: {
      fontSize: 14,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      color: theme.textPrimary ?? theme.colors.textPrimary,
    },
    actions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.borderColor ?? theme.colors.border,
    },
    logsContent: {
      padding: 16,
      paddingBottom: 32,
    },
    logsText: {
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 12,
      color: theme.textPrimary ?? theme.colors.textPrimary,
      lineHeight: 18,
    },
  });
}
