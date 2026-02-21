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

/** Get directory containing path (parent folder). */
function getDirname(p: string): string {
  const norm = p.replace(/\/$/, "");
  const lastSlash = norm.lastIndexOf("/");
  if (lastSlash <= 0) return lastSlash === 0 ? "/" : "";
  return norm.slice(0, lastSlash) || "/";
}

/** Get parent path; returns "" if already at root (use "" for root in state). */
function getParentPath(path: string, root: string): string {
  const rootNorm = root.replace(/\/$/, "");
  if (!path || path === rootNorm || path.length <= rootNorm.length) return "";
  if (!path.startsWith(rootNorm + "/")) return "";
  const suffix = path.slice(rootNorm.length + 1);
  const idx = suffix.lastIndexOf("/");
  if (idx === -1) return ""; // one level deep, parent is root
  return rootNorm + "/" + suffix.slice(0, idx);
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
  const [allowedRoot, setAllowedRoot] = useState<string | null>(null);
  const [browseRoot, setBrowseRoot] = useState<string>("");
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [treeCache, setTreeCache] = useState<Record<string, WorkspaceChild[]>>({});
  const [currentPath, setCurrentPath] = useState<string>("");
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [selectingWorkspace, setSelectingWorkspace] = useState(false);

  const pickerRoot = browseRoot || (workspacePath ?? workspaceRoot ?? "");

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

  const handleNavigateInto = useCallback(
    async (path: string) => {
      if (!pickerRoot) return;
      triggerHaptic("selection");
      setCurrentPath(path);
      const cacheKey = path || pickerRoot;
      if (treeCache[cacheKey]) return;
      setLoadingPaths((prev) => new Set(prev).add(cacheKey));
      try {
        const children = await fetchPickerChildren(path || pickerRoot);
        setTreeCache((prev) => ({ ...prev, [cacheKey]: children }));
      } catch (e) {
        setPickerError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoadingPaths((prev) => {
          const next = new Set(prev);
          next.delete(cacheKey);
          return next;
        });
      }
    },
    [pickerRoot, treeCache, fetchPickerChildren]
  );

  const handleGoToParent = useCallback(() => {
    if (!pickerRoot) return;
    triggerHaptic("selection");
    if (currentPath !== "") {
      const parent = getParentPath(currentPath, pickerRoot);
      setCurrentPath(parent);
    } else {
      // At root: go up to parent of browse root (e.g. from workspace to its parent)
      const parentBrowseRoot = getDirname(pickerRoot);
      const norm = (allowedRoot ?? "").replace(/\/$/, "") || "";
      const validParent =
        norm &&
        parentBrowseRoot &&
        parentBrowseRoot !== pickerRoot &&
        (parentBrowseRoot === norm || parentBrowseRoot.startsWith(norm + "/"));
      if (validParent) {
        setBrowseRoot(parentBrowseRoot);
        setCurrentPath("");
        setTreeCache((prev) => {
          const next = { ...prev };
          delete next[""];
          delete next[pickerRoot];
          return next;
        });
      }
    }
  }, [pickerRoot, currentPath, allowedRoot]);

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
  const viewCacheKey = currentPath || "";
  const viewChildren = treeCache[viewCacheKey] ?? [];
  const viewLoading = loadingPaths.has(viewCacheKey);
  const allowedNorm = (allowedRoot ?? "").replace(/\/$/, "") || "";
  const parentOfBrowseRoot = pickerRoot ? getDirname(pickerRoot) : "";
  const canGoUpFromRoot =
    !!allowedNorm &&
    !!parentOfBrowseRoot &&
    parentOfBrowseRoot !== pickerRoot &&
    (parentOfBrowseRoot === allowedNorm ||
      parentOfBrowseRoot.startsWith(allowedNorm + "/"));
  const canGoBack = currentPath !== "" || canGoUpFromRoot;

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
          const root = data?.workspaceRoot ?? data?.path ?? null;
          setWorkspaceRoot(root);
          setAllowedRoot(data?.allowedRoot ?? root ?? null);
          setBrowseRoot(workspacePath ?? root ?? "");
        })
        .catch(() => {
          setWorkspaceRoot(null);
          setAllowedRoot(null);
          setBrowseRoot("");
        });
    }
  }, [visible, serverBaseUrl, workspacePath]);

  // Load root children when picker opens; preload path to current workspace for faster drill-down
  useEffect(() => {
    if (!visible || !pickerRoot) return;

    const loadInitial = async () => {
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

      // Preload ancestors of current workspace for faster navigation
      if (workspacePath && workspacePath.startsWith(pickerRoot)) {
        const relPath = workspacePath
          .slice(pickerRoot.length)
          .replace(/^\//, "")
          .trim();
        if (relPath) {
          const segments = relPath.split("/").filter(Boolean);
          const rootNorm = pickerRoot.replace(/\/$/, "");
          let p = rootNorm;
          for (const seg of segments) {
            p = p + "/" + seg;
            try {
              const children = await fetchPickerChildren(p);
              setTreeCache((prev) => ({ ...prev, [p]: children }));
            } catch {
              /* ignore */
            }
          }
        }
      }
    };

    loadInitial();
  }, [visible, pickerRoot, serverBaseUrl, workspacePath, fetchPickerChildren]);

  // Reset state when closing
  useEffect(() => {
    if (!visible) {
      setTreeCache({});
      setCurrentPath("");
      setBrowseRoot("");
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

  const renderChildRow = useCallback(
    (child: WorkspaceChild) => {
      const isLoading = loadingPaths.has(child.path);
      const isCurrentWorkspace =
        workspacePath != null && child.path === workspacePath;

      return (
        <View
          key={child.path}
          style={[
            styles.pickerRow,
            isCurrentWorkspace && styles.pickerRowCurrent,
          ]}
          onLayout={isCurrentWorkspace ? handleCurrentWorkspaceLayout : undefined}
        >
          <TouchableOpacity
            style={styles.pickerRowExpand}
            onPress={() => handleNavigateInto(child.path)}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel={`Open ${child.name}`}
            hitSlop={12}
          >
            <Text style={styles.pickerRowChevron}>▶</Text>
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
      );
    },
    [
      loadingPaths,
      workspacePath,
      handleNavigateInto,
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
            {canGoBack ? (
              <TouchableOpacity
                onPress={handleGoToParent}
                style={styles.headerSideBtn}
                hitSlop={12}
                accessibilityLabel="Go back to parent folder"
                accessibilityRole="button"
              >
                <Text style={styles.prevButtonText}>← Parent</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.headerSideBtn} />
            )}
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
                  !currentPath && !currentRelativePath && styles.pickerRowCurrent,
                ]}
                onLayout={
                  !currentPath && !currentRelativePath
                    ? handleCurrentWorkspaceLayout
                    : undefined
                }
              >
                <Text style={styles.pickerRootLabel}>
                  📁 {basename(currentPath || pickerRoot)}
                </Text>
                <AppButton
                  label="Select"
                  variant="primary"
                  size="sm"
                  onPress={() =>
                    handleSelectWorkspace(currentPath || pickerRoot)
                  }
                  disabled={pickerLoading}
                />
              </View>

              {pickerError ? (
                <Text style={styles.pickerError}>{pickerError}</Text>
              ) : (pickerLoading || viewLoading) && viewChildren.length === 0 ? (
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
                  {viewChildren.map((child) => renderChildRow(child))}
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
    headerSideBtn: {
      minWidth: 72,
      minHeight: MIN_TOUCH_TARGET,
      alignItems: "flex-start",
      justifyContent: "center",
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
    prevButtonText: {
      fontSize: 17,
      color: theme.accent,
      fontWeight: "500",
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
