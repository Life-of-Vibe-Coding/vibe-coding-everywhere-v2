import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/index";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { Input, InputField } from "@/components/ui/input";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { Badge, BadgeText } from "@/components/ui/badge";
import { getDefaultServerConfig } from "@/core";
import {
  FolderIconByType,
  FileIconByType,
} from "@/components/icons/WorkspaceTreeIcons";
import { EntranceAnimation, triggerHaptic } from "@/design-system";
import { basename, dirname } from "@/utils/path";

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

export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export interface GitStatusItem {
  file: string;
  status: string;
  isDirectory?: boolean;
}

export interface GitUntrackedItem {
  file: string;
  isDirectory?: boolean;
}

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

export type GitContextForAI = {
  staged: string[];
  unstaged: string[];
  untracked: string[];
};

interface WorkspaceSidebarProps {
  visible: boolean;
  embedded?: boolean;
  onClose: () => void;
  onFileSelect?: (path: string) => void;
  /** When provided, replaces manual commit with "Commit by AI" flow. Always starts a new session on current workspace. */
  onCommitByAI?: (userRequest: string) => void;
  /** Called when the active tab (files | changes | commits) changes. Use to hide InputPanel during staging/commit. */
  onActiveTabChange?: (tab: "files" | "changes" | "commits") => void;
}

const SIDE_MARGIN = 12;
const IGNORED_FILES = new Set([".gitignore", ".env", ".env.example", ".env.local"]);
const PATH_MAX_CHARS = 42;

/** Truncate long path: show start.../filename so both beginning and filename are visible. */
function truncatePathMiddle(path: string, maxChars: number = PATH_MAX_CHARS): string {
  if (path.length <= maxChars) return path;
  const file = basename(path);
  const dir = dirname(path);
  if (!dir || dir === ".") return `...${path.slice(-(maxChars - 3))}`;
  const ellipsis = ".../";
  const startChars = Math.max(4, maxChars - file.length - ellipsis.length);
  const start = dir.slice(0, startChars);
  return `${start}${ellipsis}${file}`;
}

export function WorkspaceSidebar({ visible, embedded, onClose, onFileSelect, onCommitByAI, onActiveTabChange }: WorkspaceSidebarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const safeAreaAwareHeight = Math.max(
    0,
    windowHeight - insets.bottom
  );

  // Sidebar logic state
  const [loading, setLoading] = useState(true);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(DEFAULT_REFRESH_MS);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([""]));
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"files" | "changes" | "commits">("files");

  // Git Data States
  const [gitLoading, setGitLoading] = useState(false);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [stagedFiles, setStagedFiles] = useState<GitStatusItem[]>([]);
  const [unstagedFiles, setUnstagedFiles] = useState<GitStatusItem[]>([]);
  const [untrackedFiles, setUntrackedFiles] = useState<GitUntrackedItem[]>([]);
  const [gitError, setGitError] = useState<string | null>(null);

  // Changes State
  const [commitMessage, setCommitMessage] = useState("");
  const [aiCommitQuery, setAiCommitQuery] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const baseUrl = getDefaultServerConfig().getBaseUrl();
  const drawerWidth = windowWidth - 2 * SIDE_MARGIN;
  const maxDrawerHeight = Math.max(0, Math.round(safeAreaAwareHeight));
  const drawerHeight = embedded ? undefined : maxDrawerHeight;
  const drawerSize = embedded
    ? { width: drawerWidth, flex: 1 }
    : { width: drawerWidth, maxHeight: drawerHeight };

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/api/config`);
      const cfg = await res.json();
      if (cfg.sidebarRefreshIntervalMs != null && cfg.sidebarRefreshIntervalMs >= 0) {
        setRefreshIntervalMs(cfg.sidebarRefreshIntervalMs);
      }
    } catch (_) { }
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

  const fetchCommits = useCallback(async () => {
    setGitLoading(true);
    setGitError(null);
    try {
      const res = await fetch(`${baseUrl}/api/git/commits?limit=50`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setCommits(json.commits || []);
    } catch (err: any) {
      setGitError(err.message);
    } finally {
      setGitLoading(false);
    }
  }, [baseUrl]);

  const fetchStatus = useCallback(async () => {
    setGitLoading(true);
    setGitError(null);
    try {
      const res = await fetch(`${baseUrl}/api/git/status`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const normalizeItem = (x: unknown): GitStatusItem | GitUntrackedItem => {
        if (typeof x === "string") return { file: x, isDirectory: false };
        if (x && typeof x === "object" && "file" in x) {
          const obj = x as { file?: unknown; isDirectory?: boolean; status?: string };
          const file = typeof obj.file === "string" ? obj.file : String(obj?.file ?? "");
          return obj.status != null
            ? { file, status: String(obj.status ?? ""), isDirectory: !!obj.isDirectory }
            : { file, isDirectory: !!obj.isDirectory };
        }
        return { file: "", isDirectory: false };
      };
      setStagedFiles((json.status?.staged || []).map(normalizeItem) as GitStatusItem[]);
      setUnstagedFiles((json.status?.unstaged || []).map(normalizeItem) as GitStatusItem[]);
      setUntrackedFiles((json.status?.untracked || []).map(normalizeItem) as GitUntrackedItem[]);
    } catch (err: any) {
      setGitError(err.message);
    } finally {
      setGitLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    fetchConfig();
    fetchTree();
  }, [visible, fetchConfig, fetchTree]);

  useEffect(() => {
    if (!visible) return;
    if (activeTab === "commits") fetchCommits();
    else if (activeTab === "changes") fetchStatus();
  }, [visible, activeTab, fetchCommits, fetchStatus]);

  useEffect(() => {
    if (visible) onActiveTabChange?.(activeTab);
  }, [visible, activeTab, onActiveTabChange]);

  useEffect(() => {
    if (!visible || refreshIntervalMs <= 0 || activeTab !== "files") return;
    const timer = setInterval(fetchTree, refreshIntervalMs);
    return () => clearInterval(timer);
  }, [visible, activeTab, refreshIntervalMs, fetchTree]);

  // Actions
  const handleStageFile = async (file: string) => {
    try {
      setActionLoading(true);
      const res = await fetch(`${baseUrl}/api/git/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stage", files: [file] })
      });
      if (!res.ok) throw new Error("Failed to stage");
      await fetchStatus();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStageAll = async () => {
    try {
      setActionLoading(true);
      const allFiles = [
        ...unstagedFiles.map((f) => f.file),
        ...untrackedFiles.map((u) => u.file),
      ];
      if (!allFiles.length) return;
      const res = await fetch(`${baseUrl}/api/git/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stage", files: allFiles })
      });
      if (!res.ok) throw new Error("Failed to stage all");
      await fetchStatus();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleGitInit = async () => {
    try {
      setActionLoading(true);
      const res = await fetch(`${baseUrl}/api/git/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "init" })
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || "Failed to initialize git");
      setGitError(null);
      if (activeTab === "commits") await fetchCommits();
      else if (activeTab === "changes") await fetchStatus();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    try {
      setActionLoading(true);
      const res = await fetch(`${baseUrl}/api/git/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "commit", message: commitMessage })
      });
      if (!res.ok) throw new Error("Commit failed");
      setCommitMessage("");
      await fetchStatus();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Rest of Tree helpers
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
      sh: ATOM_ONE_LIGHT.orange,
      bash: ATOM_ONE_LIGHT.orange,
      zsh: ATOM_ONE_LIGHT.orange,
    };
    return m[ext] ?? ATOM_ONE_LIGHT.grey;
  }, []);

  const isIgnoredFile = useCallback((name: string): boolean => {
    return IGNORED_FILES.has(name);
  }, []);

  const filterTree = useCallback((items: TreeItem[], query: string): TreeItem[] => {
    if (!query.trim()) return items;
    const q = query.trim().toLowerCase();
    const filterItem = (item: TreeItem): TreeItem | null => {
      if (item.type === "folder") {
        const filteredChildren = (item.children ?? [])
          .map(filterItem)
          .filter((c): c is TreeItem => c != null);
        const matchesSelf = item.name.toLowerCase().includes(q);
        if (filteredChildren.length > 0 || matchesSelf) {
          return { ...item, children: filteredChildren.length ? filteredChildren : item.children };
        }
        return null;
      }
      return item.name.toLowerCase().includes(q) ? item : null;
    };
    return items.map(filterItem).filter((c): c is TreeItem => c != null);
  }, []);

  const filteredTree = useMemo(
    () => (data?.tree ? filterTree(data.tree, searchQuery) : []),
    [data?.tree, searchQuery, filterTree]
  );

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
      onFileSelect?.(filePath);
    },
    [onFileSelect]
  );

  const renderItem = useCallback(
    (item: TreeItem, depth: number) => {
      if (item.type === "folder") {
        const isExpanded = expandedPaths.has(item.path);
        return (
          <Box key={item.path} style={styles.folderBlock}>
            <Pressable
              style={({ pressed }) => [
                styles.treeRow,
                { paddingLeft: 12 + depth * 14 },
                pressed && styles.treeRowPressed,
              ]}
              onPress={() => toggleFolder(item.path)}
            >
              <Text style={styles.treeIcon}>{isExpanded ? "▼" : "▶"}</Text>
              <Box style={styles.treeIconWrap}>
                <FolderIconByType
                  name={item.name}
                  expanded={isExpanded}
                  color={ATOM_ONE_LIGHT.folder}
                />
              </Box>
              <Text style={styles.treeLabel} numberOfLines={1}>
                {item.name}
              </Text>
            </Pressable>
            {isExpanded && item.children && item.children.length > 0 && (
              <Box style={styles.children}>
                {item.children.map((child) => renderItem(child, depth + 1))}
              </Box>
            )}
          </Box>
        );
      }
      const fileColor = getFileColor(item.name);
      const ignored = isIgnoredFile(item.name);
      return (
        <Pressable
          key={item.path}
          style={({ pressed }) => [
            styles.treeRow,
            { paddingLeft: 12 + depth * 14 },
            pressed && styles.treeRowPressed,
            ignored && { opacity: 0.55 },
          ]}
          onPress={() => handleFilePress(item.path)}
        >
          <Box style={styles.treeIconChevron} />
          <Box style={styles.treeIconWrap}>
            <FileIconByType name={item.name} color={fileColor} />
          </Box>
          <Text style={[styles.treeLabel, ignored && styles.treeLabelIgnored]} numberOfLines={1}>
            {item.name}
          </Text>
        </Pressable>
      );
    },
    [expandedPaths, toggleFolder, getFileColor, isIgnoredFile, handleFilePress]
  );

  const styles = useMemo(() => createWorkspaceSidebarStyles(theme), [theme]);

  const renderFilesTab = () => (
    <>
      <Box style={styles.workspaceName}>
        <Text style={styles.workspaceNameText} numberOfLines={2}>
          {data?.root ?? "Workspace"}
        </Text>
      </Box>
      <Box style={styles.searchBarContainer}>
        <Input variant="outline" size="md" className="flex-1">
          <InputField
            placeholder="Search files..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
        </Input>
      </Box>
      {loading && !data ? (
        <Box style={styles.loading}>
          <ActivityIndicator size="small" color={theme.accent} />
        </Box>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          {filteredTree.map((item) => renderItem(item, 0))}
        </ScrollView>
      )}
    </>
  );

  const renderChangesTab = () => {
    const hasStaged = stagedFiles.length > 0;
    const hasUnstaged = unstagedFiles.length > 0;
    const hasUntracked = untrackedFiles.length > 0;
    const totalUnstaged = unstagedFiles.length + untrackedFiles.length;
    const canCommit = hasStaged || hasUnstaged || hasUntracked;
    const isDark = theme.mode === "dark";

    const renderChangeRow = (
      item: { file: string; isDirectory?: boolean; status?: string },
      key: string,
      index: number,
      variant: "staged" | "unstaged",
      onPress: () => void,
      onAction?: () => void,
      actionLabel?: string
    ) => {
      const fileName = basename(item.file);
      const fileColor = item.isDirectory ? ATOM_ONE_LIGHT.folder : getFileColor(fileName);
      return (
        <EntranceAnimation key={key} variant="slideUp" delay={index * 35} duration={220}>
          <Pressable
            style={({ pressed }) => [
              styles.changeRow,
              variant === "staged" && styles.changeRowStaged,
              pressed && styles.changeRowPressed,
            ]}
            onPress={onPress}
          >
            <Box style={styles.changeRowIconWrap}>
              {item.isDirectory ? (
                <FolderIconByType name={item.file} expanded={false} color={fileColor} />
              ) : (
                <FileIconByType name={fileName} color={fileColor} />
              )}
            </Box>
            <Box style={styles.changeRowContent}>
              <Text style={styles.changeRowPath} numberOfLines={1}>
                {truncatePathMiddle(item.file)}
              </Text>
            </Box>
            {variant === "staged" && item.status != null && (
              <Box style={styles.changeRowBadge}>
                <Badge
                  action={item.status === "M" || item.status === "A" || item.status === "D" ? "success" : "muted"}
                  variant="solid"
                  size="sm"
                  className="shrink-0"
                >
                  <BadgeText>{item.status}</BadgeText>
                </Badge>
              </Box>
            )}
            {variant === "unstaged" && onAction && (
              <Pressable
                style={({ pressed }) => [styles.stageBtn, pressed && styles.stageBtnPressed]}
                onPress={() => {
                  triggerHaptic("selection");
                  onAction();
                }}
                accessibilityLabel={actionLabel ?? "Stage"}
              >
                <Text style={styles.stageBtnText}>Stage</Text>
              </Pressable>
            )}
          </Pressable>
        </EntranceAnimation>
      );
    };

    return (
      <Box style={[styles.changesLayout, { backgroundColor: theme.colors.background }]}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.changesScrollContent} showsVerticalScrollIndicator={false}>
          {/* Staged section card */}
          <Box style={[styles.sectionCard, isDark && styles.sectionCardDark]}>
            <Box style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.success }]}>Staged</Text>
              {hasStaged && (
                <Badge action="success" variant="outline" size="sm">
                  <BadgeText>{stagedFiles.length}</BadgeText>
                </Badge>
              )}
            </Box>
            {hasStaged ? (
              <Box style={styles.changeList}>
                {stagedFiles.map((f, i) =>
                  renderChangeRow(
                    f,
                    `staged:${f.file}:${i}`,
                    i,
                    "staged",
                    () => !f.isDirectory && handleFilePress("__diff__:staged:" + f.file)
                  )
                )}
              </Box>
            ) : (
              <Text style={styles.emptyText}>No staged changes</Text>
            )}
          </Box>

          {/* Unstaged section card */}
          <Box style={[styles.sectionCard, isDark && styles.sectionCardDark]}>
            <Box style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Unstaged</Text>
              {totalUnstaged > 0 && (
                <Badge action="muted" variant="outline" size="sm">
                  <BadgeText>{totalUnstaged}</BadgeText>
                </Badge>
              )}
              {totalUnstaged > 0 && (
                <Pressable
                  style={({ pressed }) => [styles.stageAllBtn, pressed && styles.stageAllBtnPressed]}
                  onPress={() => {
                    triggerHaptic("light");
                    handleStageAll();
                  }}
                >
                  <Text style={[styles.stageAllBtnText, { color: theme.accent }]}>Stage all</Text>
                </Pressable>
              )}
            </Box>
            {hasUnstaged ? (
              <Box style={styles.changeList}>
                {unstagedFiles.map((f, i) =>
                  renderChangeRow(
                    f,
                    `unstaged:${f.file}:${i}`,
                    i,
                    "unstaged",
                    () => !f.isDirectory && handleFilePress("__diff__:unstaged:" + f.file),
                    () => handleStageFile(f.file)
                  )
                )}
              </Box>
            ) : null}
            {hasUntracked ? (
              <Box style={[styles.changeList, hasUnstaged && { marginTop: 4 }]}>
                {untrackedFiles.map((u, i) =>
                  renderChangeRow(
                    u,
                    `untracked:${u.file}:${i}`,
                    unstagedFiles.length + i,
                    "unstaged",
                    () => !u.isDirectory && handleFilePress("__diff__:unstaged:" + u.file),
                    () => handleStageFile(u.file)
                  )
                )}
              </Box>
            ) : null}
            {!hasUnstaged && !hasUntracked && <Text style={styles.emptyText}>No unstaged changes</Text>}
          </Box>
        </ScrollView>

        {/* Commit form */}
        <Box style={[styles.commitForm, isDark && styles.commitFormDark]}>
          {onCommitByAI ? (
            <>
              <Box style={styles.commitInputRow}>
                <Box style={[styles.commitInputWrap, isDark && styles.commitInputWrapDark]}>
                  <Textarea variant="default" size="md" className="min-h-18 max-h-28">
                    <TextareaInput
                      style={[styles.commitInput, styles.commitInputWithButton]}
                      placeholder="Describe what to commit (e.g. fix typo, add feature). AI will use the git skill."
                      placeholderTextColor={theme.colors.textSecondary}
                      value={aiCommitQuery}
                      onChangeText={setAiCommitQuery}
                      editable={!actionLoading}
                    />
                  </Textarea>
                </Box>
              </Box>
              <Pressable
                style={[
                  styles.commitBtn,
                  { backgroundColor: theme.accent, shadowColor: theme.accent },
                  (!aiCommitQuery.trim() || !canCommit) && { opacity: 0.5 },
                ]}
                onPress={() => {
                  const q = aiCommitQuery.trim();
                  if (!q || !canCommit) return;
                  triggerHaptic("light");
                  onCommitByAI?.(q);
                  setAiCommitQuery("");
                  onClose();
                }}
                disabled={!aiCommitQuery.trim() || !canCommit || actionLoading}
              >
                <Text style={styles.commitBtnText}>Commit by AI</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Box style={styles.commitInputRow}>
                <Box style={[styles.commitInputWrap, isDark && styles.commitInputWrapDark]}>
                  <Textarea variant="default" size="md" className="min-h-18 max-h-28">
                    <TextareaInput
                      style={[styles.commitInput, styles.commitInputWithButton]}
                      placeholder="Commit message..."
                      placeholderTextColor={theme.colors.textSecondary}
                      value={commitMessage}
                      onChangeText={setCommitMessage}
                      editable={!actionLoading}
                    />
                  </Textarea>
                </Box>
              </Box>
              <Pressable
                style={[
                  styles.commitBtn,
                  { backgroundColor: theme.accent, shadowColor: theme.accent },
                  (!hasStaged || !commitMessage.trim()) && { opacity: 0.5 },
                ]}
                onPress={handleCommit}
                disabled={!hasStaged || !commitMessage.trim() || actionLoading}
              >
                <Text style={styles.commitBtnText}>{actionLoading ? "Committing…" : "Commit"}</Text>
              </Pressable>
            </>
          )}
        </Box>
      </Box>
    );
  };

  const renderCommitsTab = () => {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {commits.length > 0 ? commits.map(c => (
          <Box key={c.hash} style={styles.commitItem}>
            <Box style={styles.commitHeaderRow}>
              <Text style={styles.commitHash}>{c.hash.slice(0, 7)}</Text>
              <Text style={styles.commitDate}>{c.date}</Text>
            </Box>
            <Text style={styles.commitMessageTxt}>{c.message}</Text>
            <Text style={styles.commitAuthorTxt}>{c.author}</Text>
          </Box>
        )) : <Text style={styles.emptyText}>No commits found</Text>}
      </ScrollView>
    );
  };

  const overlayPadding = embedded
    ? { paddingTop: 0, paddingBottom: 0, paddingLeft: insets.left, paddingRight: insets.right }
    : {
      paddingTop: 0,
      paddingBottom: insets.bottom,
      paddingLeft: insets.left,
      paddingRight: insets.right,
    };
  const drawerCenterStyle = embedded
    ? [styles.drawerCenter, styles.drawerCenterEmbedded, { paddingHorizontal: SIDE_MARGIN }]
    : [styles.drawerCenter, { paddingHorizontal: SIDE_MARGIN }];
  const overlayContent = (
    <Box style={[styles.overlay, embedded && styles.overlayEmbedded, overlayPadding]}>
      <Pressable
        style={styles.mask}
        onPress={onClose}
      />
      <Box style={drawerCenterStyle} pointerEvents="box-none">
        <EntranceAnimation variant="slideRight" duration={280}>
          <Box style={[styles.drawer, drawerSize]}>

            <Box style={styles.tabContainer}>
              <Box style={styles.tabSpacer} />
              <Box style={styles.tabGroup}>
                {(["files", "changes", "commits"] as const).map(tab => (
                  <Pressable
                    key={tab}
                    style={[styles.tab, activeTab === tab && styles.tabActive, tab === "changes" && { marginLeft: 4 }]}
                    onPress={() => {
                      setActiveTab(tab);
                      onActiveTabChange?.(tab);
                    }}
                  >
                    <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </Box>
              <Box style={styles.tabSpacerRight}>
                <Pressable
                  style={styles.tabCloseBtn}
                  onPress={onClose}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityLabel="Close file explorer"
                >
                  <Text style={styles.tabCloseBtnText}>✕</Text>
                </Pressable>
              </Box>
            </Box>

            {gitLoading && activeTab !== "files" ? (
              <Box style={styles.loading}>
                <ActivityIndicator size="large" color={theme.accent} />
              </Box>
            ) : gitError && activeTab !== "files" ? (
              <ScrollView style={styles.scroll} contentContainerStyle={styles.errorContainer}>
                <Text style={styles.errorTitle}>Git Error</Text>
                <Text style={styles.errorText}>{gitError}</Text>
                {gitError.includes("not a git repository") && (
                  <Pressable
                    style={[styles.initGitBtn, actionLoading && styles.initGitBtnDisabled]}
                    onPress={handleGitInit}
                    disabled={actionLoading}
                    accessibilityLabel="Initialize Git repository"
                  >
                    {actionLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.initGitBtnText}>Initialize Git Repository</Text>
                    )}
                  </Pressable>
                )}
              </ScrollView>
            ) : activeTab === "commits" ? renderCommitsTab() :
              activeTab === "files" ? renderFilesTab() :
                renderChangesTab()}

          </Box>
        </EntranceAnimation>
      </Box>
    </Box>
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
      statusBarTranslucent={false}
    >
      {overlayContent}
    </Modal>
  );
}

function createWorkspaceSidebarStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    overlay: { flex: 1 },
    overlayEmbedded: { minHeight: 0 },
    mask: { ...StyleSheet.absoluteFillObject, backgroundColor: "transparent" },
    drawerCenter: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-start", alignItems: "center" },
    drawerCenterEmbedded: { justifyContent: "flex-start" as const },
    drawer: {
      backgroundColor: theme.colors.background,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
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
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textPrimary,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: "rgba(0,0,0,0.06)",
      alignItems: "center",
      justifyContent: "center",
    },
    closeBtnText: { fontSize: 18, color: theme.colors.textSecondary },
    tabContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    tabSpacer: {
      flex: 1,
    },
    tabGroup: {
      flexDirection: "row",
      alignItems: "center",
    },
    tabSpacerRight: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
    },
    tab: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      alignItems: "center",
    },
    tabActive: { borderBottomWidth: 2, borderBottomColor: theme.accent },
    tabText: { fontSize: 12, fontWeight: "600", color: theme.colors.textSecondary },
    tabTextActive: { color: theme.accent },
    tabCloseBtn: {
      width: 36,
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 4,
    },
    tabCloseBtnText: { fontSize: 18, color: theme.colors.textSecondary, fontWeight: "600" },
    workspaceName: {
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    workspaceNameText: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "500",
      letterSpacing: 0,
      color: theme.colors.textPrimary,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
    searchBarContainer: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    searchInput: {
      backgroundColor: "rgba(0,0,0,0.06)",
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      fontSize: 14,
      color: theme.colors.textPrimary,
      borderWidth: 1,
      borderColor: "rgba(0,0,0,0.08)",
    },
    loading: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 24, backgroundColor: theme.colors.background },
    scroll: { flex: 1, minHeight: 0, backgroundColor: theme.colors.background },
    scrollContent: { paddingVertical: 8, paddingBottom: 24 },
    folderBlock: { marginBottom: 0 },
    treeRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 36,
      paddingVertical: 6,
      paddingRight: 12,
      borderRadius: 10,
      marginHorizontal: 8,
    },
    treeRowPressed: { backgroundColor: "rgba(0,0,0,0.06)" },
    treeIcon: { width: 14, marginRight: 4, fontSize: 10, color: theme.colors.textSecondary },
    treeIconChevron: { width: 14, marginRight: 4 },
    treeIconWrap: { width: 22, height: 22, borderRadius: 6, overflow: "hidden", alignItems: "center", justifyContent: "center", marginRight: 6 },
    treeLabel: { flex: 1, fontSize: 14, color: theme.colors.textPrimary },
    treeLabelIgnored: { color: theme.colors.textSecondary },
    children: { marginLeft: 0 },

    // Git specific
    errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
    errorTitle: { fontSize: 18, fontWeight: "700", color: theme.colors.warning, marginBottom: 8 },
    errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: "center", lineHeight: 20 },
    initGitBtn: {
      marginTop: 20,
      paddingVertical: 12,
      paddingHorizontal: 20,
      backgroundColor: theme.accent,
      borderRadius: 12,
    },
    initGitBtnDisabled: { opacity: 0.7 },
    initGitBtnText: { fontSize: 15, fontWeight: "600", color: "#fff" },

    sectionHeaderWrap: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 8,
      marginTop: 6
    },
    sectionTitle: { fontSize: 13, fontWeight: "600", color: theme.colors.textPrimary },
    emptyText: { paddingHorizontal: 16, paddingVertical: 12, color: theme.colors.textSecondary, fontSize: 13 },

    // Redesigned Changes tab
    changesLayout: { flex: 1 },
    changesScrollContent: { paddingHorizontal: 12, paddingVertical: 12, paddingBottom: 20 },
    sectionCard: {
      backgroundColor: theme.colors?.surface ?? theme.colors.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors?.border ?? "rgba(0,0,0,0.08)",
      marginBottom: 12,
      overflow: "hidden",
    },
    sectionCardDark: {
      backgroundColor: theme.colors?.surfaceAlt ?? "rgba(255,255,255,0.04)",
      borderColor: theme.colors?.border ?? "rgba(255,255,255,0.1)",
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors?.border ?? "rgba(0,0,0,0.06)",
      gap: 8,
    },
    changeList: { paddingVertical: 4 },
    changeRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 10,
      minHeight: 44,
    },
    changeRowStaged: {},
    changeRowPressed: { backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)" },
    changeRowIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
    },
    changeRowContent: { flex: 1, minWidth: 0 },
    changeRowPath: {
      fontSize: 13,
      color: theme.colors.textPrimary,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
    changeRowBadge: { marginLeft: 8 },
    stageBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.colors?.accentSoft ?? "rgba(124,58,237,0.12)",
    },
    stageBtnPressed: { opacity: 0.8 },
    stageBtnText: { fontSize: 12, fontWeight: "600", color: theme.accent },
    stageAllBtn: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: theme.colors?.accentSoft ?? "rgba(124,58,237,0.12)",
      marginLeft: "auto",
    },
    stageAllBtnPressed: { opacity: 0.8 },

    changeItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "rgba(0,0,0,0.05)",
    },
    changeItemStaged: { paddingLeft: 24 },
    stagedPathWrap: { flex: 1, minWidth: 0, flexShrink: 1 },
    changePathTouchable: { flex: 1, minWidth: 0 },
    changeFileLabel: { flex: 1, minWidth: 0, fontSize: 12, color: theme.colors.textPrimary, paddingLeft: 4, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
    changeFileLabelStaged: { fontFamily: undefined },
    statusBadgeWrap: { flexShrink: 0, marginLeft: 8, justifyContent: "center" },
    statusLabel: { fontSize: 11, color: theme.accent, fontWeight: "600" },
    stageBtnWrap: { flexShrink: 0, marginLeft: 8 },
    stageAllBtnText: { fontSize: 12, fontWeight: "600" },

    commitForm: {
      padding: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      flexShrink: 0,
    },
    commitFormDark: {
      backgroundColor: theme.colors?.surface ?? theme.colors.background,
      borderTopColor: theme.colors?.border ?? theme.colors.border,
    },
    commitInputRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 12,
    },
    commitInputWrap: {
      flex: 1,
      minWidth: 0,
    },
    commitInputWrapDark: {
      backgroundColor: "rgba(255,255,255,0.06)",
      borderColor: "rgba(255,255,255,0.12)",
    },
    commitInput: {
      minHeight: 80,
      maxHeight: 120,
      backgroundColor: "rgba(0,0,0,0.04)",
      borderRadius: 12,
      padding: 12,
      paddingTop: 12,
      fontSize: 14,
      color: theme.colors.textPrimary,
      textAlignVertical: "top",
      borderWidth: 1,
      borderColor: "rgba(0,0,0,0.08)",
    },
    commitInputWithButton: {
      marginBottom: 0,
      flex: 1,
    },
    commitBtn: {
      backgroundColor: theme.accent,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    commitBtnText: { color: "#FFF", fontSize: 15, fontWeight: "600" },

    commitItem: {
      padding: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    commitHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    commitHash: { fontSize: 12, color: theme.accent, fontWeight: "700", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
    commitDate: { fontSize: 12, color: theme.colors.textSecondary },
    commitMessageTxt: { fontSize: 14, color: theme.colors.textPrimary, marginBottom: 4, fontWeight: "500" },
    commitAuthorTxt: { fontSize: 12, color: theme.colors.textSecondary, opacity: 0.8 },
  });
}
