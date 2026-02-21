import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useTheme } from "../../theme/index";
import { getDefaultServerConfig } from "../../core";
import {
  FolderIcon,
  FolderOpenIcon,
  FileIconByType,
} from "../icons/WorkspaceTreeIcons";

export type TreeItem = {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: TreeItem[];
};

type WorkspaceData = {
  root: string;
  tree: TreeItem[];
};

const DEFAULT_REFRESH_MS = 3000;

// Colors by file type (Atom One Light–style)
const ATOM_ONE_LIGHT = {
  folder: "#C18401",
  blue: "#4078F2",
  green: "#50A14F",
  red: "#E45649",
  orange: "#D28445",
  purple: "#A626A4",
  cyan: "#0184BC",
  yellow: "#C18401",
  grey: "#696C77",
};

interface WorkspaceSidebarProps {
  visible: boolean;
  /** When true, render as overlay content only (no Modal). Parent must place in a container that does not cover the app footer. */
  embedded?: boolean;
  onClose: () => void;
  onFileSelect?: (path: string) => void;
}

const SIDE_MARGIN = 12;
/** When embedded, reserve this much space at the bottom (footer + margin) so the explorer doesn't touch the footer. */
const RESERVED_BOTTOM = 100;

export function WorkspaceSidebar({ visible, embedded, onClose, onFileSelect }: WorkspaceSidebarProps) {
  const theme = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(DEFAULT_REFRESH_MS);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([""]));

  const baseUrl = getDefaultServerConfig().getBaseUrl();
  const drawerWidth = windowWidth - 2 * SIDE_MARGIN;
  const maxDrawerHeight = Math.round(windowHeight * 0.75);
  const drawerHeight =
    embedded
      ? Math.min(maxDrawerHeight, Math.max(200, windowHeight - RESERVED_BOTTOM))
      : maxDrawerHeight;

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/api/config`);
      const cfg = await res.json();
      if (cfg.sidebarRefreshIntervalMs != null && cfg.sidebarRefreshIntervalMs >= 0) {
        setRefreshIntervalMs(cfg.sidebarRefreshIntervalMs);
      }
    } catch (_) {}
  }, [baseUrl]);

  const fetchTree = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/api/workspace-tree`);
      const json = await res.json();
      if (json.tree && json.root != null) {
        setData({ root: json.root, tree: json.tree });
      }
    } catch (_) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    fetchConfig();
    fetchTree();
  }, [visible, fetchConfig, fetchTree]);

  useEffect(() => {
    if (!visible || refreshIntervalMs <= 0) return;
    const timer = setInterval(fetchTree, refreshIntervalMs);
    return () => clearInterval(timer);
  }, [visible, refreshIntervalMs, fetchTree]);

  const getFileColor = useCallback((name: string): string => {
    const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() ?? "" : "";
    const m: Record<string, string> = {
      js: ATOM_ONE_LIGHT.yellow,
      jsx: ATOM_ONE_LIGHT.blue,
      ts: ATOM_ONE_LIGHT.blue,
      tsx: ATOM_ONE_LIGHT.blue,
      json: ATOM_ONE_LIGHT.yellow,
      md: ATOM_ONE_LIGHT.blue,
      html: ATOM_ONE_LIGHT.red,
      css: ATOM_ONE_LIGHT.cyan,
      scss: ATOM_ONE_LIGHT.purple,
      py: ATOM_ONE_LIGHT.green,
      yml: ATOM_ONE_LIGHT.purple,
      yaml: ATOM_ONE_LIGHT.purple,
    };
    return m[ext] ?? ATOM_ONE_LIGHT.grey;
  }, []);

  const toggleFolder = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleFilePress = useCallback(
    (filePath: string) => {
      // Open code preview on top of current layer; do not close sidebar so that
      // when user closes the preview they return to the sidebar.
      onFileSelect?.(filePath);
    },
    [onFileSelect]
  );

  const renderItem = useCallback(
    (item: TreeItem, depth: number) => {
      if (item.type === "folder") {
        const isExpanded = expandedPaths.has(item.path);
        return (
          <View key={item.path} style={styles.folderBlock}>
            <Pressable
              style={({ pressed }) => [
                styles.treeRow,
                { paddingLeft: 12 + depth * 14 },
                pressed && styles.treeRowPressed,
              ]}
              onPress={() => toggleFolder(item.path)}
            >
              <Text style={styles.treeIcon}>{isExpanded ? "▼" : "▶"}</Text>
              <View style={styles.treeIconWrap}>
                {isExpanded ? (
                  <FolderOpenIcon color={ATOM_ONE_LIGHT.folder} />
                ) : (
                  <FolderIcon color={ATOM_ONE_LIGHT.folder} />
                )}
              </View>
              <Text style={styles.treeLabel} numberOfLines={1}>
                {item.name}
              </Text>
            </Pressable>
            {isExpanded && item.children && item.children.length > 0 && (
              <View style={styles.children}>
                {item.children.map((child) => renderItem(child, depth + 1))}
              </View>
            )}
          </View>
        );
      }
      const fileColor = getFileColor(item.name);
      return (
        <Pressable
          key={item.path}
          style={({ pressed }) => [
            styles.treeRow,
            { paddingLeft: 12 + depth * 14 },
            pressed && styles.treeRowPressed,
          ]}
          onPress={() => handleFilePress(item.path)}
        >
          <View style={styles.treeIconChevron} />
          <View style={styles.treeIconWrap}>
            <FileIconByType name={item.name} color={fileColor} />
          </View>
          <Text style={styles.treeLabel} numberOfLines={1}>
            {item.name}
          </Text>
        </Pressable>
      );
    },
    [expandedPaths, toggleFolder, getFileColor, handleFilePress]
  );

  const styles = useMemo(() => createWorkspaceSidebarStyles(theme), [theme]);

  const overlayContent = (
    <View style={[styles.overlay, embedded && styles.overlayEmbedded]}>
      <TouchableOpacity
        style={styles.mask}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={[styles.drawerCenter, { paddingHorizontal: SIDE_MARGIN }]} pointerEvents="box-none">
        <View style={[styles.drawer, { width: drawerWidth, height: drawerHeight }]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Explorer</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.workspaceName}>
            <Text style={styles.workspaceNameText}>
              {data?.root ?? "Workspace"}
            </Text>
          </View>
          {loading && !data ? (
            <View style={styles.loading}>
              <ActivityIndicator size="small" color={theme.accent} />
            </View>
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
            >
              {data?.tree.map((item) => renderItem(item, 0))}
            </ScrollView>
          )}
        </View>
      </View>
    </View>
  );

  if (embedded) {
    if (!visible) return null;
    return overlayContent;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      {overlayContent}
    </Modal>
  );
}

function createWorkspaceSidebarStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
  },
  overlayEmbedded: {
    minHeight: 0,
  },
  mask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  drawerCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  drawer: {
    backgroundColor: theme.beigeBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.borderColor,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.borderColor,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: theme.beigeBg,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    fontSize: 18,
    color: theme.textMuted,
  },
  workspaceName: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.borderColor,
    backgroundColor: theme.beigeBg,
  },
  workspaceNameText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: theme.textMuted,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 24,
    backgroundColor: theme.beigeBg,
  },
  scroll: {
    flex: 1,
    backgroundColor: theme.beigeBg,
  },
  scrollContent: {
    paddingVertical: 8,
    paddingBottom: 24,
  },
  folderBlock: {
    marginBottom: 0,
  },
  treeRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 36,
    paddingVertical: 6,
    paddingRight: 12,
    borderRadius: 10,
    marginHorizontal: 8,
  },
  treeRowPressed: {
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  treeIcon: {
    width: 14,
    marginRight: 4,
    fontSize: 10,
    color: theme.textMuted,
  },
  treeIconChevron: {
    width: 14,
    marginRight: 4,
  },
  treeIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  treeLabel: {
    flex: 1,
    fontSize: 14,
    color: theme.textPrimary,
  },
  children: {
    marginLeft: 0,
  },
});
}
