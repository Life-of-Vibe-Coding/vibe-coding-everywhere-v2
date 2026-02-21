import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  LayoutChangeEvent,
} from "react-native";
import { AppButton } from "../../design-system";
import { useTheme } from "../../theme/index";
import { triggerHaptic } from "../../design-system";

type WorkspaceChild = { name: string; path: string };

/** Get the last segment of a path. */
function basename(p: string): string {
  const s = p.replace(/\/$/, "").split("/").filter(Boolean);
  return (s[s.length - 1] ?? p) || ".";
}

/** Get relative path from root to fullPath. */
function getRelativePath(fullPath: string, root: string): string {
  const rootNorm = root.replace(/\/$/, "");
  if (fullPath === rootNorm || fullPath === root) return "";
  if (fullPath.startsWith(rootNorm + "/")) {
    return fullPath.slice(rootNorm.length + 1);
  }
  return fullPath;
}

export interface WorkspacePickerModalProps {
  visible: boolean;
  onClose: () => void;
  serverBaseUrl: string;
  workspacePath: string | null;
  onRefreshWorkspace?: () => void;
}

/** Minimum touch target per UI/UX Pro Max (44x44px). */
const MIN_TOUCH_TARGET = 44;

export function WorkspacePickerModal({
  visible,
  onClose,
  serverBaseUrl,
  workspacePath,
  onRefreshWorkspace,
}: WorkspacePickerModalProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const scrollRef = useRef<ScrollView>(null);
  const currentWorkspaceRowY = useRef<number | null>(null);

  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [treeCache, setTreeCache] = useState<Record<string, WorkspaceChild[]>>({});
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [selectingWorkspace, setSelectingWorkspace] = useState(false);

  // Root is always the selected workspace (never OS root)
  const pickerRoot = workspacePath ?? workspaceRoot ?? "";

  const fetchPickerChildren = useCallback(
    async (parentPath: string): Promise<WorkspaceChild[]> => {
      const rootNorm = pickerRoot.replace(/\/$/, "");
      const parentRel =
        parentPath === rootNorm || parentPath === pickerRoot
          ? ""
          : parentPath.startsWith(rootNorm + "/")
            ? parentPath.slice(rootNorm.length + 1)
            : parentPath;
      const params = new URLSearchParams();
      params.set("root", pickerRoot);
      if (parentRel) params.set("parent", parentRel);
      const q = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`${serverBaseUrl}/api/workspace-allowed-children${q}`);
      const data = await res.json();
      const children = data?.children ?? [];
      return children;
    },
    [serverBaseUrl, pickerRoot]
  );

  const handleToggleFolder = useCallback(
    async (child: WorkspaceChild) => {
      if (!pickerRoot) return;
      triggerHaptic("selection");
      const isExpanded = expandedPaths.has(child.path);
      if (isExpanded) {
        setExpandedPaths((prev) => {
          const next = new Set(prev);
          next.delete(child.path);
          return next;
        });
        return;
      }
      setLoadingPaths((prev) => new Set(prev).add(child.path));
      try {
        const children = await fetchPickerChildren(child.path);
        setTreeCache((prev) => ({ ...prev, [child.path]: children }));
        setExpandedPaths((prev) => new Set(prev).add(child.path));
      } catch (e) {
        setPickerError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoadingPaths((prev) => {
          const next = new Set(prev);
          next.delete(child.path);
          return next;
        });
      }
    },
    [pickerRoot, expandedPaths, fetchPickerChildren]
  );

  const handleSelectWorkspace = useCallback(
    (path: string) => {
      setSelectingWorkspace(true);
      triggerHaptic("selection");
      fetch(`${serverBaseUrl}/api/workspace-path`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      })
        .then((res) => {
          if (!res.ok)
            return res.json().then((d) =>
              Promise.reject(new Error(d?.error ?? res.statusText))
            );
          onClose();
          onRefreshWorkspace?.();
        })
        .catch((e) => setPickerError(e?.message ?? "Failed to set workspace"))
        .finally(() => setSelectingWorkspace(false));
    },
    [serverBaseUrl, onClose, onRefreshWorkspace]
  );

  const pickerLoading = loadingPaths.has("") || selectingWorkspace;
  const currentRelativePath =
    pickerRoot && workspacePath ? getRelativePath(workspacePath, pickerRoot) : "";
  const rootChildren = treeCache[""] ?? [];

  // Fetch workspace-path and roots when modal becomes visible
  useEffect(() => {
    if (visible) {
      setPickerError(null);
      fetch(`${serverBaseUrl}/api/workspace-path`)
        .then((res) => res.json())
        .then((data) => {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.log("[WorkspacePicker] API workspace-path response", data);
          }
          setWorkspaceRoot(data?.workspaceRoot ?? data?.path ?? null);
        })
        .catch(() => {
          setWorkspaceRoot(null);
        });
    }
  }, [visible, serverBaseUrl]);

  // Load root children and expand to current workspace when picker opens
  useEffect(() => {
    if (!visible || !pickerRoot) return;

    const expandToCurrentWorkspace = async () => {
      setPickerError(null);
      setLoadingPaths((prev) => new Set(prev).add(""));
      try {
        const children = await fetchPickerChildren(pickerRoot);
        setTreeCache((prev) => ({ ...prev, "": children }));
      } catch (e) {
        setPickerError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoadingPaths((prev) => {
          const n = new Set(prev);
          n.delete("");
          return n;
        });
      }

      // Expand path to current workspace
      if (workspacePath && workspacePath.startsWith(pickerRoot)) {
        const relPath = workspacePath
          .slice(pickerRoot.length)
          .replace(/^\//, "")
          .trim();
        if (!relPath) return; // workspace is root

        const segments = relPath.split("/").filter(Boolean);
        const rootNorm = pickerRoot.replace(/\/$/, "");
        const toExpand: string[] = [];
        let currentPath = rootNorm;
        for (const seg of segments) {
          currentPath = currentPath + "/" + seg;
          toExpand.push(currentPath);
        }

        for (const p of toExpand) {
          const children = await fetchPickerChildren(p);
          setTreeCache((prev) => ({ ...prev, [p]: children }));
          setExpandedPaths((prev) => new Set(prev).add(p));
        }
      }
    };

    expandToCurrentWorkspace();
  }, [visible, pickerRoot, serverBaseUrl, workspacePath, fetchPickerChildren]);

  // Reset state when closing
  useEffect(() => {
    if (!visible) {
      setTreeCache({});
      setExpandedPaths(new Set());
      setLoadingPaths(new Set());
      currentWorkspaceRowY.current = null;
    }
  }, [visible]);

  const handleCurrentWorkspaceLayout = useCallback((e: LayoutChangeEvent) => {
    const { layout } = e.nativeEvent;
    currentWorkspaceRowY.current = layout.y;
    // Scroll to current workspace row after a short delay (tree may still be rendering)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (currentWorkspaceRowY.current != null && scrollRef.current) {
          scrollRef.current.scrollTo({
            y: Math.max(0, currentWorkspaceRowY.current - 80),
            animated: true,
          });
        }
      });
    });
  }, []);

  const renderTreeRow = useCallback(
    (child: WorkspaceChild, depth: number) => {
      const isExpanded = expandedPaths.has(child.path);
      const children = treeCache[child.path];
      const isLoading = loadingPaths.has(child.path);
      const isCurrentWorkspace =
        workspacePath != null && child.path === workspacePath;

      return (
        <View key={child.path}>
          <View
            style={[
              styles.pickerRow,
              { paddingLeft: 16 + depth * 24 },
              isCurrentWorkspace && styles.pickerRowCurrent,
            ]}
            onLayout={isCurrentWorkspace ? handleCurrentWorkspaceLayout : undefined}
          >
            <TouchableOpacity
              style={styles.pickerRowExpand}
              onPress={() => handleToggleFolder(child)}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel={`${isExpanded ? "Collapse" : "Expand"} ${child.name}`}
              hitSlop={12}
            >
              <Text style={styles.pickerRowChevron}>
                {isExpanded ? "▼" : "▶"}
              </Text>
              <Text
                style={[
                  styles.pickerRowName,
                  isCurrentWorkspace && styles.pickerRowNameCurrent,
                ]}
                numberOfLines={2}
              >
                {child.name}
              </Text>
              {isLoading ? (
                <ActivityIndicator
                  size="small"
                  color={theme.accent}
                  style={styles.pickerRowLoader}
                />
              ) : null}
            </TouchableOpacity>
            <AppButton
              label="Select"
              variant="primary"
              size="sm"
              onPress={() => handleSelectWorkspace(child.path)}
              disabled={pickerLoading}
            />
          </View>
          {isExpanded &&
            children &&
            children.length > 0 && (
              <View style={styles.pickerTreeChildren}>
                {children.map((c) => renderTreeRow(c, depth + 1))}
              </View>
            )}
        </View>
      );
    },
    [
      expandedPaths,
      treeCache,
      loadingPaths,
      workspacePath,
      handleToggleFolder,
      handleSelectWorkspace,
      handleCurrentWorkspaceLayout,
      pickerLoading,
      theme,
      styles,
    ]
  );

  if (!visible) return null;

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
            <Text style={styles.title}>Select workspace</Text>
            <TouchableOpacity
              onPress={() => {
                triggerHaptic("selection");
                onClose();
              }}
              style={styles.closeBtn}
              hitSlop={12}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {!pickerRoot ? (
            <ActivityIndicator
              size="large"
              color={theme.accent}
              style={styles.pickerLoader}
            />
          ) : pickerRoot ? (
            <>
              {currentRelativePath ? (
                <View style={styles.breadcrumb}>
                  <Text style={styles.breadcrumbPath} numberOfLines={2}>
                    {currentRelativePath}
                  </Text>
                </View>
              ) : null}

              <View
                style={[
                  styles.pickerRootRow,
                  !currentRelativePath && styles.pickerRowCurrent,
                ]}
                onLayout={
                  !currentRelativePath ? handleCurrentWorkspaceLayout : undefined
                }
              >
                <Text style={styles.pickerRootLabel}>
                  📁 {basename(pickerRoot)}
                </Text>
                <AppButton
                  label="Select"
                  variant="primary"
                  size="sm"
                  onPress={() => handleSelectWorkspace(pickerRoot)}
                  disabled={pickerLoading}
                />
              </View>

              {pickerError ? (
                <Text style={styles.pickerError}>{pickerError}</Text>
              ) : pickerLoading && rootChildren.length === 0 ? (
                <ActivityIndicator
                  size="large"
                  color={theme.accent}
                  style={styles.pickerLoader}
                />
              ) : (
                <ScrollView
                  ref={scrollRef}
                  style={styles.pickerList}
                  contentContainerStyle={styles.pickerListContent}
                  showsVerticalScrollIndicator={true}
                  nestedScrollEnabled
                >
                  {rootChildren.map((child) => renderTreeRow(child, 0))}
                </ScrollView>
              )}
            </>
          ) : null}
        </SafeAreaView>
      </View>
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
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderColor,
    },
    title: {
      fontSize: 20,
      fontWeight: "600",
      color: theme.textPrimary,
    },
    closeBtn: {
      minWidth: MIN_TOUCH_TARGET,
      minHeight: MIN_TOUCH_TARGET,
      alignItems: "center",
      justifyContent: "center",
    },
    closeBtnText: {
      fontSize: 22,
      color: theme.textMuted,
    },
    breadcrumb: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderColor,
    },
    breadcrumbPath: {
      fontSize: 16,
      lineHeight: 24,
      color: theme.colors.textSecondary,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
    pickerRootRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderColor,
    },
    pickerRootLabel: {
      fontSize: 17,
      lineHeight: 24,
      flex: 1,
      color: theme.colors.textPrimary,
    },
    pickerError: {
      fontSize: 16,
      lineHeight: 24,
      color: theme.danger,
      marginHorizontal: 20,
      marginTop: 16,
    },
    pickerLoader: {
      marginVertical: 32,
    },
    pickerList: {
      flex: 1,
    },
    pickerListContent: {
      paddingBottom: 32,
    },
    pickerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: 20,
      paddingRight: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderColor,
      minHeight: MIN_TOUCH_TARGET + 12,
    },
    pickerRowCurrent: {
      backgroundColor: theme.accentLight,
    },
    pickerRowExpand: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: MIN_TOUCH_TARGET,
      justifyContent: "flex-start",
    },
    pickerRowChevron: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      width: 20,
    },
    pickerRowName: {
      fontSize: 17,
      lineHeight: 24,
      flex: 1,
      color: theme.colors.textPrimary,
    },
    pickerRowNameCurrent: {
      fontWeight: "600",
      color: theme.accent,
    },
    pickerRowLoader: {
      marginLeft: 8,
    },
    pickerTreeChildren: {
      marginLeft: 0,
    },
  });
}
