import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Platform,
  ActivityIndicator,
  LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Typography, IconButton, triggerHaptic } from "../../design-system";
import { useTheme } from "../../theme/index";
import { basename, getRelativePath, getDirname, getParentPath, truncatePathForDisplay } from "../../utils/path";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
} from "../icons/ChatActionIcons";
import { FolderIcon } from "../icons/WorkspaceTreeIcons";

type WorkspaceChild = { name: string; path: string };

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
            <FolderIcon color={theme.colors.textSecondary} />
            <ChevronRightIcon size={14} color={theme.accent} strokeWidth={2.5} />
            <Typography
              variant="footnote"
              tone={isCurrentWorkspace ? "accent" : "primary"}
              numberOfLines={1}
              ellipsizeMode="head"
              style={styles.pickerRowName}
            >
              {child.name}
            </Typography>
            {isLoading ? (
              <ActivityIndicator
                size="small"
                color={theme.accent}
                style={styles.pickerRowLoader}
              />
            ) : null}
          </TouchableOpacity>
          <Button
            label="Select"
            variant="primary"
            size="xs"
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
                <ChevronLeftIcon size={18} color={theme.colors.accent} strokeWidth={2} />
                <Typography variant="caption" tone="accent" style={styles.prevButtonText}>
                  Parent
                </Typography>
              </TouchableOpacity>
            ) : (
              <View style={styles.headerSideBtn} />
            )}
            <View style={styles.titleContainer} pointerEvents="box-none">
              {pickerRoot ? (
                (() => {
                  const displayPath = currentPath || pickerRoot;
                  const shortPath = truncatePathForDisplay(displayPath);
                  const parentPath = getDirname(displayPath);
                  const hasBoldParent = parentPath && parentPath.length > 1 && shortPath === displayPath;
                  const suffix = hasBoldParent ? displayPath.slice(parentPath.length) : "";
                  return (
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="head"
                      style={[styles.title, styles.titlePath]}
                    >
                      {hasBoldParent ? (
                        <>
                          <Text style={[styles.title, styles.titlePath, styles.titlePathBold]}>
                            {parentPath}
                          </Text>
                          <Text style={[styles.title, styles.titlePath]}>
                            {suffix}
                          </Text>
                        </>
                      ) : (
                        shortPath
                      )}
                    </Text>
                  );
                })()
              ) : (
                <Typography
                  variant="subhead"
                  numberOfLines={1}
                  style={[styles.title, styles.titlePath]}
                >
                  Select workspace
                </Typography>
              )}
            </View>
            <IconButton
              variant="ghost"
              size="sm"
              icon={<CloseIcon size={18} color={theme.colors.textMuted} strokeWidth={2} />}
              onPress={() => {
                triggerHaptic("selection");
                onClose();
              }}
              accessibilityLabel="Close"
              style={styles.closeBtn}
            />
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
                  <Typography
                    variant="caption"
                    tone="secondary"
                    numberOfLines={1}
                    ellipsizeMode="head"
                    style={styles.breadcrumbPath}
                  >
                    {truncatePathForDisplay(currentRelativePath)}
                  </Typography>
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
                <View style={styles.pickerRootLabelRow}>
                  <FolderIcon color={theme.colors.textSecondary} />
                  <Typography
                    variant="footnote"
                    numberOfLines={1}
                    ellipsizeMode="head"
                    style={styles.pickerRootLabel}
                  >
                    {basename(currentPath || pickerRoot) || "."}
                  </Typography>
                </View>
                <Button
                  label="Select"
                  variant="primary"
                  size="xs"
                  onPress={() =>
                    handleSelectWorkspace(currentPath || pickerRoot)
                  }
                  disabled={pickerLoading}
                />
              </View>

              {pickerError ? (
                <Typography variant="caption" tone="danger" style={styles.pickerError}>
                  {pickerError}
                </Typography>
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
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderColor,
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
    breadcrumb: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderColor,
    },
    breadcrumbPath: {
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 10,
      lineHeight: 14,
    },
    pickerRootRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderColor,
    },
    pickerRootLabelRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    pickerRootLabel: {
      flex: 1,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 12,
      lineHeight: 16,
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
    },
    pickerListContent: {
      paddingBottom: 32,
    },
    pickerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 6,
      paddingRight: 14,
      paddingLeft: 16,
      marginLeft: 8,
      borderLeftWidth: 2,
      borderLeftColor: theme.accentLight,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderColor,
      minHeight: MIN_TOUCH_TARGET + 4,
    },
    pickerRowCurrent: {
      backgroundColor: theme.accentLight,
    },
    pickerRowExpand: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      minHeight: MIN_TOUCH_TARGET,
      justifyContent: "flex-start",
    },
    pickerRowName: {
      flex: 1,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 12,
      lineHeight: 16,
    },
    pickerRowLoader: {
      marginLeft: 8,
    },
    pickerTreeChildren: {
      marginLeft: 0,
    },
  });
}
