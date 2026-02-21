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
  TextInput,
  useWindowDimensions,
  Platform,
  Alert,
} from "react-native";
import { useTheme } from "../../theme/index";
import { getDefaultServerConfig } from "../../core";
import {
  FolderIconByType,
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
}

const SIDE_MARGIN = 12;
const RESERVED_BOTTOM = 100;
const IGNORED_FILES = new Set([".gitignore", ".env", ".env.example", ".env.local"]);

export function WorkspaceSidebar({ visible, embedded, onClose, onFileSelect, onCommitByAI }: WorkspaceSidebarProps) {
  const theme = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [data, setData] = useState<WorkspaceData | null>(null);

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
  const maxDrawerHeight = Math.round(windowHeight * 0.85);
  const drawerHeight =
    embedded
      ? Math.min(maxDrawerHeight, Math.max(300, windowHeight - RESERVED_BOTTOM))
      : maxDrawerHeight;

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
                <FolderIconByType
                  name={item.name}
                  expanded={isExpanded}
                  color={ATOM_ONE_LIGHT.folder}
                />
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
          <View style={styles.treeIconChevron} />
          <View style={styles.treeIconWrap}>
            <FileIconByType name={item.name} color={fileColor} />
          </View>
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
      <View style={styles.workspaceName}>
        <Text style={styles.workspaceNameText}>
          {data?.root ?? "Workspace"}
        </Text>
      </View>
      <View style={styles.searchBarContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search files..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
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
          {filteredTree.map((item) => renderItem(item, 0))}
        </ScrollView>
      )}
    </>
  );

  const renderChangesTab = () => {
    const hasStaged = stagedFiles.length > 0;
    const hasUnstaged = unstagedFiles.length > 0;
    const hasUntracked = untrackedFiles.length > 0;

    return (
      <View style={{ flex: 1, backgroundColor: theme.beigeBg }}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

          <View style={styles.sectionHeaderWrap}>
            <Text style={styles.sectionTitle}>Staged Changes</Text>
          </View>
          {hasStaged ? stagedFiles.map((f, i) => (
            <View key={`staged:${f.file}:${i}`} style={styles.changeItem}>
              {f.isDirectory ? (
                <Text style={[styles.changeFileLabel, { flex: 1 }]} numberOfLines={1}>{f.file}</Text>
              ) : (
                <TouchableOpacity style={{ flex: 1, minWidth: 0 }} onPress={() => handleFilePress("__diff__:staged:" + f.file)}>
                  <Text style={styles.changeFileLabel} numberOfLines={1}>{f.file}</Text>
                </TouchableOpacity>
              )}
              <Text style={[styles.statusLabel, styles.statusLabelRight]}>{f.status}</Text>
            </View>
          )) : <Text style={styles.emptyText}>No staged changes</Text>}

          <View style={styles.sectionHeaderWrap}>
            <Text style={styles.sectionTitle}>Unstaged Changes</Text>
            {hasUnstaged && (
              <TouchableOpacity onPress={handleStageAll} style={styles.stageAllBtn}>
                <Text style={styles.stageAllBtnText}>Stage All</Text>
              </TouchableOpacity>
            )}
          </View>
          {hasUnstaged && unstagedFiles.map((f, i) => (
            <View key={`unstaged:${f.file}:${i}`} style={styles.changeItem}>
              {f.isDirectory ? (
                <Text style={[styles.changeFileLabel, { flex: 1 }]} numberOfLines={1}>{f.file}</Text>
              ) : (
                <TouchableOpacity style={{ flex: 1 }} onPress={() => handleFilePress("__diff__:unstaged:" + f.file)}>
                  <Text style={styles.changeFileLabel} numberOfLines={1}>{f.file}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => handleStageFile(f.file)}>
                <Text style={styles.stageBtnText}>Stage</Text>
              </TouchableOpacity>
            </View>
          ))}
          {!hasUnstaged && !hasUntracked && <Text style={styles.emptyText}>No unstaged changes</Text>}

          {hasUntracked && (
            <>
              <View style={styles.sectionHeaderWrap}>
                <Text style={styles.sectionTitle}>Untracked Files</Text>
              </View>
              {untrackedFiles.map((u, i) => (
                <View key={`untracked:${u.file}:${i}`} style={styles.changeItem}>
                  {u.isDirectory ? (
                    <Text style={[styles.changeFileLabel, { flex: 1 }]} numberOfLines={1}>{u.file}</Text>
                  ) : (
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => handleFilePress("__diff__:unstaged:" + u.file)}>
                      <Text style={styles.changeFileLabel} numberOfLines={1}>{u.file}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => handleStageFile(u.file)}>
                    <Text style={styles.stageBtnText}>Stage</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

        </ScrollView>
        <View style={styles.commitForm}>
          {onCommitByAI ? (
            <>
              <TextInput
                style={styles.commitInput}
                placeholder="Describe what to commit (e.g. fix typo, add feature). AI will use the git skill."
                placeholderTextColor={theme.textMuted}
                value={aiCommitQuery}
                onChangeText={setAiCommitQuery}
                multiline
                editable={!actionLoading}
              />
              <TouchableOpacity
                style={[
                  styles.commitBtn,
                  (!aiCommitQuery.trim() || (!hasStaged && !hasUnstaged && !hasUntracked)) && { opacity: 0.5 },
                ]}
                onPress={() => {
                  const q = aiCommitQuery.trim();
                  if (!q) return;
                  onCommitByAI?.(q);
                  setAiCommitQuery("");
                  onClose();
                }}
                disabled={
                  !aiCommitQuery.trim() || (!hasStaged && !hasUnstaged && !hasUntracked) || actionLoading
                }
              >
                <Text style={styles.commitBtnText}>Commit by AI</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                style={styles.commitInput}
                placeholder="Commit message..."
                placeholderTextColor={theme.textMuted}
                value={commitMessage}
                onChangeText={setCommitMessage}
                multiline
                editable={!actionLoading}
              />
              <TouchableOpacity
                style={[styles.commitBtn, (!hasStaged || !commitMessage.trim()) && { opacity: 0.5 }]}
                onPress={handleCommit}
                disabled={!hasStaged || !commitMessage.trim() || actionLoading}
              >
                <Text style={styles.commitBtnText}>{actionLoading ? "Committing..." : "Commit"}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderCommitsTab = () => {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {commits.length > 0 ? commits.map(c => (
          <View key={c.hash} style={styles.commitItem}>
            <View style={styles.commitHeaderRow}>
              <Text style={styles.commitHash}>{c.hash.slice(0, 7)}</Text>
              <Text style={styles.commitDate}>{c.date}</Text>
            </View>
            <Text style={styles.commitMessageTxt}>{c.message}</Text>
            <Text style={styles.commitAuthorTxt}>{c.author}</Text>
          </View>
        )) : <Text style={styles.emptyText}>No commits found</Text>}
      </ScrollView>
    );
  };

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
            <Text style={styles.headerTitle}>
              {activeTab === "changes" ? "Source Control"
                : activeTab === "commits" ? "Git History"
                  : "Explorer"}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabContainer}>
            {(["files", "changes", "commits"] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.tabCloseBtn}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Close file explorer"
            >
              <Text style={styles.tabCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {gitLoading && activeTab !== "files" ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={theme.accent} />
            </View>
          ) : gitError && activeTab !== "files" ? (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.errorContainer}>
              <Text style={styles.errorTitle}>Git Error</Text>
              <Text style={styles.errorText}>{gitError}</Text>
              {gitError.includes("not a git repository") && (
                <TouchableOpacity
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
                </TouchableOpacity>
              )}
            </ScrollView>
          ) : activeTab === "commits" ? renderCommitsTab() :
            activeTab === "files" ? renderFilesTab() :
              renderChangesTab()}

          <View style={styles.footer}>
            <TouchableOpacity style={styles.footerCloseBtn} onPress={onClose}>
              <Text style={styles.footerCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>

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
    overlay: { flex: 1 },
    overlayEmbedded: { minHeight: 0 },
    mask: { ...StyleSheet.absoluteFillObject, backgroundColor: "transparent" },
    drawerCenter: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
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
      backgroundColor: theme.beigeBg,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.textPrimary,
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
    closeBtnText: { fontSize: 18, color: theme.textMuted },
    tabContainer: {
      flexDirection: "row",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderColor,
      backgroundColor: theme.beigeBg,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: "center",
    },
    tabActive: { borderBottomWidth: 2, borderBottomColor: theme.accent },
    tabText: { fontSize: 13, fontWeight: "600", color: theme.textMuted },
    tabTextActive: { color: theme.accent },
    tabCloseBtn: {
      width: 36,
      alignSelf: "stretch",
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 4,
    },
    tabCloseBtnText: { fontSize: 18, color: theme.textMuted, fontWeight: "600" },
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
    searchBarContainer: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderColor,
      backgroundColor: theme.beigeBg,
    },
    searchInput: {
      backgroundColor: "rgba(0,0,0,0.06)",
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      fontSize: 14,
      color: theme.textPrimary,
      borderWidth: 1,
      borderColor: "rgba(0,0,0,0.08)",
    },
    loading: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 24, backgroundColor: theme.beigeBg },
    scroll: { flex: 1, backgroundColor: theme.beigeBg },
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
    treeIcon: { width: 14, marginRight: 4, fontSize: 10, color: theme.textMuted },
    treeIconChevron: { width: 14, marginRight: 4 },
    treeIconWrap: { width: 22, height: 22, borderRadius: 6, overflow: "hidden", alignItems: "center", justifyContent: "center", marginRight: 6 },
    treeLabel: { flex: 1, fontSize: 14, color: theme.textPrimary },
    treeLabelIgnored: { color: theme.textMuted },
    children: { marginLeft: 0 },

    // Git specific
    errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
    errorTitle: { fontSize: 18, fontWeight: "700", color: theme.colors.warning, marginBottom: 8 },
    errorText: { fontSize: 14, color: theme.textMuted, textAlign: "center", lineHeight: 20 },
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
      paddingVertical: 10,
      marginTop: 8
    },
    sectionTitle: { fontSize: 13, fontWeight: "700", color: theme.textPrimary, textTransform: "uppercase", letterSpacing: 0.5 },
    emptyText: { paddingHorizontal: 16, paddingVertical: 12, color: theme.textMuted, fontSize: 14, fontStyle: "italic" },

    changeItem: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "rgba(0,0,0,0.05)",
    },
    changeFileLabel: { flex: 1, minWidth: 0, fontSize: 14, color: theme.textPrimary, marginRight: 8, paddingLeft: 4, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
    statusLabel: { fontSize: 13, color: theme.accent, fontWeight: "600" },
    statusLabelRight: { flexShrink: 0 },
    stageAllBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.06)" },
    stageAllBtnText: { color: theme.accent, fontSize: 13, fontWeight: "600" },
    stageBtnText: { color: theme.accent, fontSize: 14, fontWeight: "600" },

    commitForm: {
      padding: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.borderColor,
      backgroundColor: theme.beigeBg,
    },
    commitInput: {
      minHeight: 80,
      maxHeight: 120,
      backgroundColor: "rgba(0,0,0,0.04)",
      borderRadius: 12,
      padding: 12,
      paddingTop: 12,
      fontSize: 14,
      color: theme.textPrimary,
      textAlignVertical: "top",
      marginBottom: 12,
      borderWidth: 1,
      borderColor: "rgba(0,0,0,0.08)",
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
      borderBottomColor: theme.borderColor,
    },
    commitHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    commitHash: { fontSize: 12, color: theme.accent, fontWeight: "700", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
    commitDate: { fontSize: 12, color: theme.textMuted },
    commitMessageTxt: { fontSize: 14, color: theme.textPrimary, marginBottom: 4, fontWeight: "500" },
    commitAuthorTxt: { fontSize: 12, color: theme.textMuted, opacity: 0.8 },

    footer: {
      padding: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.borderColor,
      backgroundColor: theme.beigeBg,
    },
    footerCloseBtn: {
      backgroundColor: theme.surfaceBg,
      borderWidth: 1,
      borderColor: theme.borderColor,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    footerCloseBtnText: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.textPrimary,
    }
  });
}
