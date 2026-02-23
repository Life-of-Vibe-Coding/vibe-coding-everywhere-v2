import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  Modal,
  ScrollView,
  View,
  Platform,
  ActivityIndicator,
  LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { triggerHaptic, EntranceAnimation, AnimatedPressableView } from "../../design-system";
import { useTheme } from "../../theme/index";
import { getRelativePath, getDirname, getParentPath, truncatePathForDisplay, basename } from "../../utils/path";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
} from "../icons/ChatActionIcons";
import { FolderIcon } from "../icons/WorkspaceTreeIcons";
import { Box } from "../../../components/ui/box";
import { Button, ButtonText, ButtonIcon } from "../../../components/ui/button";
import { Pressable } from "../../../components/ui/pressable";
import { Text as GText } from "../../../components/ui/text";

type WorkspaceChild = { name: string; path: string };

export interface WorkspacePickerModalProps {
  visible: boolean;
  onClose: () => void;
  serverBaseUrl: string;
  workspacePath: string | null;
  onRefreshWorkspace?: () => void;
  /** Called when user selects a new workspace; use to init new session. */
  onWorkspaceSelected?: (path: string) => void;
}

/** Minimum touch target per UI/UX Pro Max (44x44px). */
const MIN_TOUCH_TARGET = 44;

export function WorkspacePickerModal({
  visible,
  onClose,
  serverBaseUrl,
  workspacePath,
  onRefreshWorkspace,
  onWorkspaceSelected,
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
      if (!res.ok) {
        const msg = data?.error ?? res.statusText;
        throw new Error(msg);
      }
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
        setTreeCache((prev) => ({ ...prev, [cacheKey]: [] }));
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
          onWorkspaceSelected?.(path);
          onClose();
          onRefreshWorkspace?.();
        })
        .catch((e) => setPickerError(e?.message ?? "Failed to set workspace"))
        .finally(() => setSelectingWorkspace(false));
    },
    [serverBaseUrl, onClose, onRefreshWorkspace, onWorkspaceSelected]
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
        setTreeCache((prev) => ({ ...prev, "": [] }));
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

  // Fallback: when at root and children for current folder were not loaded (e.g. initial load failed or raced), load them
  const loadRootChildren = useCallback(async () => {
    if (!pickerRoot) return;
    const key = "";
    setLoadingPaths((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    try {
      const children = await fetchPickerChildren(pickerRoot);
      setTreeCache((prev) => ({ ...prev, [key]: children }));
      setPickerError(null);
    } catch (e) {
      setPickerError(e instanceof Error ? e.message : "Failed to load");
      setTreeCache((prev) => ({ ...prev, [key]: [] }));
    } finally {
      setLoadingPaths((prev) => {
        const n = new Set(prev);
        n.delete(key);
        return n;
      });
    }
  }, [pickerRoot, fetchPickerChildren]);

  useEffect(() => {
    if (
      !visible ||
      !pickerRoot ||
      currentPath !== "" ||
      loadingPaths.has("")
    ) return;
    if (treeCache[""] === undefined) {
      loadRootChildren();
    }
  }, [visible, pickerRoot, currentPath, treeCache, loadingPaths, loadRootChildren]);

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
    (child: WorkspaceChild, index: number) => {
      const isLoading = loadingPaths.has(child.path);
      const isCurrentWorkspace =
        workspacePath != null && child.path === workspacePath;

      return (
        <EntranceAnimation key={child.path} variant="slideUp" delay={index * 40} duration={220}>
          <Box
            style={[
              styles.pickerRow,
              isCurrentWorkspace && styles.pickerRowCurrent,
            ]}
            onLayout={isCurrentWorkspace ? handleCurrentWorkspaceLayout : undefined}
            className="rounded-r-lg overflow-hidden"
          >
          <AnimatedPressableView
            onPress={() => handleNavigateInto(child.path)}
            disabled={isLoading}
            style={styles.pickerRowExpand}
            accessibilityRole="button"
            accessibilityLabel={`Open ${child.name}`}
          >
            <View style={styles.pickerRowInner}>
              <FolderIcon color={theme.colors.textSecondary} />
              <ChevronRightIcon size={14} color={theme.colors?.accent ?? theme.accent} strokeWidth={2.5} />
              <GText
                size="sm"
                numberOfLines={1}
                ellipsizeMode="head"
                className={isCurrentWorkspace ? "text-primary-500 flex-1 font-mono" : "text-typography-900 flex-1 font-mono"}
                style={styles.pickerRowName}
              >
                {child.name}
              </GText>
              {isLoading ? (
                <ActivityIndicator
                  size="small"
                  color={theme.colors?.accent ?? theme.accent}
                  style={styles.pickerRowLoader}
                />
              ) : null}
            </View>
          </AnimatedPressableView>
          <Button action="primary" variant="solid" size="xs" onPress={() => handleSelectWorkspace(child.path)} isDisabled={pickerLoading}>
            <ButtonText>Select</ButtonText>
          </Button>
        </Box>
        </EntranceAnimation>
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
      <Box style={styles.fullScreen} className="bg-background-0">
        <SafeAreaView style={styles.safe}>
          <EntranceAnimation variant="fade" duration={180}>
            <Box style={styles.header} className="flex-row items-center justify-between py-2.5 px-4 border-b border-outline-200 bg-background-0">
            {canGoBack ? (
              <AnimatedPressableView
                onPress={handleGoToParent}
                style={[styles.headerSideBtn, { borderRadius: 8 }]}
                accessibilityLabel="Go back to parent folder"
                accessibilityRole="button"
              >
                <ChevronLeftIcon size={18} color={theme.colors.accent} strokeWidth={2} />
                <GText size="xs" bold className="text-primary-500 ml-0.5">Parent</GText>
              </AnimatedPressableView>
            ) : (
              <Box style={styles.headerSideBtn} />
            )}
            <Box style={styles.titleContainer} pointerEvents="box-none" className="flex-1 min-w-0 justify-center items-center px-2">
              <GText
                size="sm"
                bold
                numberOfLines={1}
                ellipsizeMode="head"
                className="text-center w-full text-typography-900 font-mono"
                style={styles.headerPath}
              >
                {pickerRoot ? truncatePathForDisplay(currentPath || pickerRoot) || "/" : "Select workspace"}
              </GText>
            </Box>
            <Button action="default" variant="link" size="sm" onPress={() => { triggerHaptic("selection"); onClose(); }} accessibilityLabel="Close" className="-mr-2 min-w-11 min-h-11">
              <ButtonIcon as={CloseIcon} size="md" style={{ color: theme.colors.textMuted }} />
            </Button>
          </Box>
          </EntranceAnimation>

          {!pickerRoot ? (
            <EntranceAnimation variant="fade" duration={220} delay={80}>
              <ActivityIndicator
                size="large"
                color={theme.colors?.accent ?? theme.accent}
                style={styles.pickerLoader}
              />
            </EntranceAnimation>
          ) : pickerRoot ? (
            <EntranceAnimation variant="fade" duration={200} delay={60}>
              <Box style={styles.pickerContent}>
                {/* First row: current workspace path (always visible, primary action) */}
                <Box
                  style={[
                    styles.pickerRootRow,
                    !currentPath && !currentRelativePath && styles.pickerRowCurrent,
                  ]}
                  className={!currentPath && !currentRelativePath ? "rounded-lg mx-2 mt-2 border-l-4 border-primary-500" : "rounded-lg mx-2 mt-2"}
                  onLayout={
                    !currentPath && !currentRelativePath
                      ? handleCurrentWorkspaceLayout
                      : undefined
                  }
                >
                  <AnimatedPressableView
                    onPress={() => {
                      if (!currentPath && viewChildren.length === 0 && !viewLoading) {
                        loadRootChildren();
                      }
                    }}
                    style={styles.pickerRootLabelRow}
                    accessibilityRole="button"
                    accessibilityLabel={`Current location ${truncatePathForDisplay(currentPath || pickerRoot)}`}
                  >
                    <View style={styles.pickerRootLabelInner}>
                      <FolderIcon color={theme.colors.textSecondary} />
                      <GText size="sm" numberOfLines={1} ellipsizeMode="head" className={`flex-1 font-mono ${!currentPath && !currentRelativePath ? "text-primary-500" : "text-typography-900"}`} style={styles.pickerRootLabel}>
                        {basename(currentPath || pickerRoot) || truncatePathForDisplay(currentPath || pickerRoot) || "."}
                      </GText>
                      {!currentPath && viewLoading ? (
                        <ActivityIndicator size="small" color={theme.colors?.accent ?? theme.accent} />
                      ) : null}
                    </View>
                  </AnimatedPressableView>
                  <Button action="primary" variant="solid" size="xs" onPress={() => handleSelectWorkspace(currentPath || pickerRoot)} isDisabled={pickerLoading}>
                    <ButtonText>Select</ButtonText>
                  </Button>
                </Box>

                {pickerError ? (
                  <GText size="xs" className="text-error-600 mx-4 mt-3">
                    {pickerError}
                  </GText>
                ) : (pickerLoading || viewLoading) && viewChildren.length === 0 ? (
                  <Box style={styles.pickerLoaderContainer}>
                    <ActivityIndicator
                      size="large"
                      color={theme.colors?.accent ?? theme.accent}
                      style={styles.pickerLoader}
                    />
                  </Box>
                ) : (
                  <ScrollView
                    ref={scrollRef}
                    style={styles.pickerList}
                    contentContainerStyle={styles.pickerListContent}
                    showsVerticalScrollIndicator={true}
                    nestedScrollEnabled
                  >
                    {viewChildren.map((child, index) => renderChildRow(child, index))}
                    {!pickerError && viewChildren.length === 0 && !viewLoading ? (
                      <GText size="xs" className="text-typography-500 mx-4 mt-2 px-2">
                        No subfolders here. Tap the folder name above to refresh.
                      </GText>
                    ) : null}
                  </ScrollView>
                )}
              </Box>
            </EntranceAnimation>
          ) : null}
        </SafeAreaView>
      </Box>
    </Modal>
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
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderColor,
      ...(Platform.OS === "ios"
        ? { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2 }
        : { elevation: 2 }),
    },
    titleContainer: {
      flex: 1,
      minWidth: 0,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 8,
    },
    title: {
      textAlign: "center",
      width: "100%",
    },
    headerPath: {
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 13,
      color: theme.colors.textPrimary,
    },
    titlePath: {
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 11,
      color: theme.colors.textPrimary,
    },
    titlePathBold: {
      fontWeight: "700",
    },
    headerSideBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      minWidth: 72,
      minHeight: MIN_TOUCH_TARGET,
      justifyContent: "flex-start",
      flexShrink: 0,
    },
    prevButtonText: {
      marginLeft: 2,
    },
    closeBtn: {
      marginRight: -8,
      flexShrink: 0,
    },
    pickerContent: {
      flex: 1,
      minHeight: 0,
    },
    pickerLoaderContainer: {
      flex: 1,
      minHeight: 120,
      justifyContent: "center",
    },
    pickerRootRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginHorizontal: 12,
      marginVertical: 4,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceAlt,
      borderBottomWidth: 0,
    },
    pickerRootLabelRow: {
      flex: 1,
      minWidth: 0,
    },
    pickerRootLabelInner: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      minWidth: 0,
      gap: 8,
    },
    pickerRootLabel: {
      flex: 1,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 16,
      lineHeight: 22,
    },
    pickerError: {
      marginHorizontal: 16,
      marginTop: 12,
    },
    pickerLoader: {
      marginVertical: 32,
    },
    pickerList: {
      flex: 1,
      minHeight: 120,
    },
    pickerListContent: {
      paddingBottom: 32,
    },
    pickerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
      paddingRight: 14,
      paddingLeft: 16,
      marginHorizontal: 12,
      marginVertical: 4,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceAlt,
      borderLeftWidth: 3,
      borderLeftColor: theme.accentLight,
      minHeight: MIN_TOUCH_TARGET + 4,
    },
    pickerRowCurrent: {
      backgroundColor: theme.accentLight,
      borderLeftColor: theme.accent,
    },
    pickerRowExpand: {
      flex: 1,
      minWidth: 0,
      minHeight: MIN_TOUCH_TARGET,
    },
    pickerRowInner: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      minWidth: 0,
      gap: 8,
    },
    pickerRowName: {
      flex: 1,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 16,
      lineHeight: 22,
    },
    pickerRowLoader: {
      marginLeft: 8,
    },
    pickerTreeChildren: {
      marginLeft: 0,
    },
  });
}
