import os
import re

ws_file = "src/components/file/WorkspaceSidebar.tsx"
gh_file = "src/components/file/GithubViewerModal.tsx"
app_file = "App.tsx"

with open(ws_file, 'r') as f:
    ws_content = f.read()

with open(gh_file, 'r') as f:
    gh_content = f.read()

def extract_block(text, start_str, end_str=None, include_end=False):
    start = text.find(start_str)
    if start == -1: return ""
    if not end_str: return text[start:]
    
    end = text.find(end_str, start + len(start_str))
    if end == -1: return ""
    
    if include_end:
        return text[start:end + len(end_str)]
    return text[start:end]

gh_types = extract_block(gh_content, "export type GitCommit =", "interface GithubViewerModalProps", include_end=False)

fetchers = extract_block(gh_content, "const fetchCommits = useCallback", "const getFileColor", include_end=False)
fetchers = re.sub(r"const fetchTree.*?\n    }, \[baseUrl\]\);\n", "", fetchers, flags=re.DOTALL)
fetchers = fetchers.replace("currentPath", '""')

git_ui = extract_block(gh_content, "const formatDate =", "const renderFilesTab = () => {", include_end=False)
git_ui = git_ui.replace("const styles = useMemo(() => createStyles(theme), [theme]);", "")

git_ui2 = extract_block(gh_content, "const renderChangesTab =", "const overlayContent = (", include_end=False)

gh_styles = extract_block(gh_content, "        // Commits UI\n", "    });\n}")

new_ws_imports = """import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  Alert,
  Platform,
} from "react-native";
"""

ws_head = extract_block(ws_content, 'import { useTheme }', 'const SIDE_MARGIN = 12;')

new_ws_component_start = """const SIDE_MARGIN = 12;
const RESERVED_BOTTOM = 100;

export function WorkspaceSidebar({ visible, embedded, onClose, onFileSelect }: WorkspaceSidebarProps) {
  const theme = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [data, setData] = useState<WorkspaceData | null>(null);
  
  // Sidebar logic state
  const [loading, setLoading] = useState(true);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(DEFAULT_REFRESH_MS);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([""]));
  const [activeTab, setActiveTab] = useState<"files" | "commits" | "changes">("files");

  // Git Data States
  const [gitLoading, setGitLoading] = useState(false);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [stagedFiles, setStagedFiles] = useState<GitStatusItem[]>([]);
  const [unstagedFiles, setUnstagedFiles] = useState<GitStatusItem[]>([]);
  const [untrackedFiles, setUntrackedFiles] = useState<string[]>([]);
  const [gitError, setGitError] = useState<string | null>(null);
  
  // Reuse existing 'error' state naming from GithubViewerModal by aliasing gitError
  const error = gitError;
  const setError = setGitError;

  // Changes State
  const [commitMessage, setCommitMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const baseUrl = getDefaultServerConfig().getBaseUrl();
  const drawerWidth = windowWidth - 2 * SIDE_MARGIN;
  const maxDrawerHeight = Math.round(windowHeight * 0.85);
  const drawerHeight = embedded
      ? Math.min(maxDrawerHeight, Math.max(300, windowHeight - RESERVED_BOTTOM))
      : maxDrawerHeight;

  """

ws_body_1 = extract_block(ws_content, "const fetchConfig =", "const styles = useMemo(()")
ws_body_1 = ws_body_1.replace("useEffect(() => {\n    if (!visible) return;\n    setLoading(true);\n    fetchConfig();\n    fetchTree();\n  }, [visible, fetchConfig, fetchTree]);", """  useEffect(() => {
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
""")

ws_ret = extract_block(ws_content, "const styles = useMemo(()", "const overlayContent = (")

ws_render_switch = """const renderFilesTab = () => (
    <>
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
    </>
  );

"""

ws_drawer_ui = extract_block(ws_content, "          <View style={styles.header}>", "          <View style={styles.workspaceName}>")
ws_tabs_ui = """
          <View style={styles.tabContainer}>
            {(["files", "commits", "changes"] as const).map(tab => (
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
          </View>
"""
ws_render_call = """
          {gitLoading && activeTab !== "files" ? (
              <View style={styles.loading}>
                  <ActivityIndicator size="large" color={theme.accent} />
              </View>
            ) : gitError && activeTab !== "files" ? (
              <ScrollView style={styles.scroll} contentContainerStyle={styles.errorContainer}>
                  <Text style={styles.errorTitle}>Git Error</Text>
                  <Text style={styles.errorText}>{gitError}</Text>
              </ScrollView>
          ) : activeTab === "commits" ? renderCommitsTab() :
              activeTab === "files" ? renderFilesTab() :
              renderChangesTab()}
"""

ws_tail = extract_block(ws_content, "if (embedded) {", "function createWorkspaceSidebarStyles")

base_styles = extract_block(ws_content, "function createWorkspaceSidebarStyles(theme", "\n});\n}")

new_styles = base_styles + "\n" + """
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
    tabActive: {
        borderBottomWidth: 2,
        borderBottomColor: theme.accent,
    },
    tabText: {
        fontSize: 14,
        fontWeight: "600",
        color: theme.textMuted,
    },
    tabTextActive: {
        color: theme.accent,
    },
    errorContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 32,
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: theme.colors.warning,
        marginBottom: 8,
    },
    errorText: {
        fontSize: 14,
        color: theme.textMuted,
        textAlign: "center",
        lineHeight: 20,
    },
""" + gh_styles + "\n});\n}"


final_file = new_ws_imports + "\n" + gh_types + "\n" + ws_head + "\n" + new_ws_component_start + "\n" + fetchers + "\n" + ws_body_1 + "\n" + git_ui + "\n" + git_ui2 + "\n" + ws_ret + "\n" + ws_render_switch + "\n" + """  const overlayContent = (
    <View style={[styles.overlay, embedded && styles.overlayEmbedded]}>
      <TouchableOpacity
        style={styles.mask}
        activeOpacity={1}
        onPress={onClose}
      />
      <View style={[styles.drawerCenter, { paddingHorizontal: SIDE_MARGIN }]} pointerEvents="box-none">
        <View style={[styles.drawer, { width: drawerWidth, height: drawerHeight }]}>
""" + ws_drawer_ui + ws_tabs_ui + ws_render_call + """        </View>
      </View>
    </View>
  );

""" + ws_tail + new_styles

# write output
with open(ws_file, "w") as f:
    f.write(final_file)


with open(app_file, "r") as f:
    app_text = f.read()

app_text = re.sub(r'import \{ GithubViewerModal \} from "\./src/components/file/GithubViewerModal";\n', '', app_text)
app_text = re.sub(r'import \{ GithubIcon \} from "\./src/components/icons/GithubIcon";\n', '', app_text)
app_text = re.sub(r'const \[githubViewerVisible, setGithubViewerVisible\] = useState\(false\);\n\s*', '', app_text)

app_text = re.sub(r'<HeaderButton\s+icon=\{\<GithubIcon[^\}]+\}\s+onPress=\{[^\}]+\}\s+accessibilityLabel="Open Github Viewer"\s+delay=\{150\}\s+/>\s*', '', app_text)

github_modal_pattern = r'\{\/\* GitHub Viewer Overlay \*\/\}[\s\S]*?<GithubViewerModal[\s\S]*?\/>\s*<\/View>'
app_text = re.sub(github_modal_pattern, '', app_text)

app_text = app_text.replace('!sidebarVisible && !githubViewerVisible', '!sidebarVisible')

with open(app_file, "w") as f:
    f.write(app_text)

print("done")
