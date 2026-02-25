import React, { useState, useCallback, useEffect, useRef } from "react";
import type { LayoutChangeEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { triggerHaptic, EntranceAnimation } from "@/design-system";
import { useTheme } from "@/theme/index";
import { getRelativePath, getDirname, getParentPath, truncatePathForDisplay, basename } from "@/utils/path";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/components/icons/ChatActionIcons";
import { FolderIcon } from "@/components/icons/WorkspaceTreeIcons";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Text as GText } from "@/components/ui/text";
import { ScrollView } from "@/components/ui/scroll-view";
import { Spinner } from "@/components/ui/spinner";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { ModalScaffold } from "@/components/reusable/ModalScaffold";

type WorkspaceChild = { name: string; path: string };

export interface WorkspacePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverBaseUrl: string;
  workspacePath: string | null;
  onRefreshWorkspace?: () => void;
  /** Called when user selects a new workspace; use to init new session. */
  onWorkspaceSelected?: (path: string) => void;
}

export function WorkspacePickerModal({
  isOpen,
  onClose,
  serverBaseUrl,
  workspacePath,
  onRefreshWorkspace,
  onWorkspaceSelected,
}: WorkspacePickerModalProps) {
  const theme = useTheme();
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

  // Fetch workspace-path and roots when modal opens
  useEffect(() => {
    if (isOpen) {
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
  }, [isOpen, serverBaseUrl, workspacePath]);

  // Load root children when picker opens; preload path to current workspace for faster drill-down
  useEffect(() => {
    if (!isOpen || !pickerRoot) return;

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
  }, [isOpen, pickerRoot, serverBaseUrl, workspacePath, fetchPickerChildren]);

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
      !isOpen ||
      !pickerRoot ||
      currentPath !== "" ||
      loadingPaths.has("")
    ) return;
    if (treeCache[""] === undefined) {
      loadRootChildren();
    }
  }, [isOpen, pickerRoot, currentPath, treeCache, loadingPaths, loadRootChildren]);

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setTreeCache({});
      setCurrentPath("");
      setBrowseRoot("");
      setLoadingPaths(new Set());
      currentWorkspaceRowY.current = null;
    }
  }, [isOpen]);

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
      const relativeChildPath = pickerRoot ? getRelativePath(child.path, pickerRoot) : child.name;

      return (
        <EntranceAnimation key={child.path} variant="slideUp" delay={index * 32} duration={220}>
          <Card
            variant={isCurrentWorkspace ? "filled" : "outline"}
            size="sm"
            className={`mx-4 mb-2 rounded-2xl border ${isCurrentWorkspace ? "border-primary-300 bg-primary-50" : "border-outline-200 bg-background-0"}`}
            onLayout={isCurrentWorkspace ? handleCurrentWorkspaceLayout : undefined}
          >
            <HStack className="items-center justify-between gap-3">
              <Pressable
                onPress={() => handleNavigateInto(child.path)}
                disabled={isLoading}
                className="flex-1 min-w-0 min-h-11 justify-center rounded-xl"
                accessibilityRole="button"
                accessibilityLabel={`Open ${child.name}`}
              >
                <HStack className="items-center gap-2.5">
                  <FolderIcon color={theme.colors.textSecondary} />
                  <ChevronRightIcon size={14} color={theme.colors.accent} strokeWidth={2.5} />
                  <VStack className="flex-1 min-w-0">
                    <GText
                      size="sm"
                      numberOfLines={1}
                      ellipsizeMode="head"
                      className={`font-mono ${isCurrentWorkspace ? "text-primary-700" : "text-typography-900"}`}
                    >
                      {child.name}
                    </GText>
                    <GText
                      size="xs"
                      numberOfLines={1}
                      ellipsizeMode="middle"
                      className="text-typography-500 font-mono"
                    >
                      {relativeChildPath || child.name}
                    </GText>
                  </VStack>
                  {isLoading ? (
                    <Spinner
                      size="small"
                      color={theme.colors.accent}
                    />
                  ) : null}
                </HStack>
              </Pressable>
              <Button
                action="primary"
                variant="solid"
                size="sm"
                className="min-h-11 rounded-xl px-4"
                onPress={() => handleSelectWorkspace(child.path)}
                isDisabled={pickerLoading}
              >
                <ButtonText>Select</ButtonText>
              </Button>
            </HStack>
          </Card>
        </EntranceAnimation>
      );
    },
    [
      loadingPaths,
      workspacePath,
      pickerRoot,
      handleNavigateInto,
      handleSelectWorkspace,
      handleCurrentWorkspaceLayout,
      pickerLoading,
      theme,
    ]
  );

  if (!isOpen) return null;

  return (
    <ModalScaffold
      isOpen={isOpen}
      onClose={onClose}
      title="Workspace Picker"
      subtitle={pickerRoot ? truncatePathForDisplay(currentPath || pickerRoot) : "Select workspace"}
      size="full"
      contentClassName="w-full h-full max-w-none rounded-none border-0 p-0"
      bodyClassName="m-0 p-0"
      bodyProps={{ scrollEnabled: false }}
    >
      <Box className="flex-1 bg-background-50">
        <SafeAreaView style={{ flex: 1 }} edges={["left", "right", "bottom"]}>
          <EntranceAnimation variant="fade" duration={180}>
            <VStack className="border-b border-outline-200 bg-background-0 px-4 pb-4 pt-3" space="sm">
              <HStack className="items-center justify-start">
                {canGoBack ? (
                  <Pressable
                    onPress={handleGoToParent}
                    className="min-h-11 min-w-[98px] rounded-xl border border-outline-200 bg-background-50 px-3.5 flex-row items-center gap-1.5"
                    accessibilityLabel="Go back to parent folder"
                    accessibilityRole="button"
                  >
                    <ChevronLeftIcon size={18} color={theme.colors.accent} strokeWidth={2} />
                    <GText size="xs" bold className="text-primary-600">Parent</GText>
                  </Pressable>
                ) : (
                  <Box className="min-h-11 min-w-[90px]" />
                )}
              </HStack>

              <Card variant="filled" size="sm" className="rounded-2xl bg-background-50 border border-outline-100">
                <VStack space="xs" className="py-0.5">
                  <GText size="xs" className="uppercase tracking-wider text-typography-500">
                    Workspace Browser
                  </GText>
                  <GText
                    size="sm"
                    bold
                    numberOfLines={1}
                    ellipsizeMode="head"
                    className="font-mono text-typography-900"
                  >
                    {pickerRoot ? truncatePathForDisplay(currentPath || pickerRoot) || "/" : "Select workspace"}
                  </GText>
                </VStack>
              </Card>
              <GText size="xs" className="text-typography-500">
                Choose a folder, then tap Use Folder.
              </GText>
            </VStack>
          </EntranceAnimation>

          {!pickerRoot ? (
            <EntranceAnimation variant="fade" duration={220} delay={80}>
              <VStack className="flex-1 items-center justify-center">
                <Spinner
                  size="large"
                  color={theme.colors.accent}
                />
              </VStack>
            </EntranceAnimation>
          ) : (
            <EntranceAnimation variant="fade" duration={200} delay={60}>
              <ScrollView
                ref={scrollRef}
                className="flex-1"
                contentContainerStyle={{ paddingBottom: 28 }}
                showsVerticalScrollIndicator
                nestedScrollEnabled
              >
                <VStack className="pt-3" space="sm">
                  <Card
                    variant={!currentPath && !currentRelativePath ? "filled" : "outline"}
                    size="sm"
                    className={`mx-4 rounded-2xl border ${!currentPath && !currentRelativePath ? "border-primary-300 bg-primary-50" : "border-outline-200 bg-background-0"}`}
                    onLayout={
                      !currentPath && !currentRelativePath
                        ? handleCurrentWorkspaceLayout
                        : undefined
                    }
                  >
                    <HStack className="items-center justify-between gap-3">
                      <Pressable
                        onPress={() => {
                          triggerHaptic("selection");
                          if (!currentPath && viewChildren.length === 0 && !viewLoading) {
                            loadRootChildren();
                          }
                        }}
                        className="flex-1 min-w-0 min-h-11 justify-center rounded-xl"
                        accessibilityRole="button"
                        accessibilityLabel={`Current location ${truncatePathForDisplay(currentPath || pickerRoot)}`}
                      >
                        <HStack className="items-center gap-2.5">
                          <FolderIcon color={theme.colors.textSecondary} />
                          <VStack className="flex-1 min-w-0">
                            <GText
                              size="sm"
                              numberOfLines={1}
                              ellipsizeMode="head"
                              className={`font-mono ${!currentPath && !currentRelativePath ? "text-primary-700" : "text-typography-900"}`}
                            >
                              {basename(currentPath || pickerRoot) || truncatePathForDisplay(currentPath || pickerRoot) || "."}
                            </GText>
                            <GText size="xs" className="text-typography-500">
                              Current folder
                            </GText>
                          </VStack>
                          {!currentPath && viewLoading ? (
                            <Spinner size="small" color={theme.colors.accent} />
                          ) : null}
                        </HStack>
                      </Pressable>
                      <Button
                        action="primary"
                        variant="solid"
                        size="sm"
                        className="min-h-11 rounded-xl px-4"
                        onPress={() => handleSelectWorkspace(currentPath || pickerRoot)}
                        isDisabled={pickerLoading}
                      >
                        <ButtonText>Use Folder</ButtonText>
                      </Button>
                    </HStack>
                  </Card>

                  {pickerError ? (
                    <Card variant="outline" size="sm" className="mx-4 rounded-xl border-error-300 bg-error-50">
                      <GText size="xs" className="text-error-700">
                        {pickerError}
                      </GText>
                    </Card>
                  ) : (pickerLoading || viewLoading) && viewChildren.length === 0 ? (
                    <VStack className="mx-4 mt-4 min-h-[160px] items-center justify-center rounded-2xl border border-outline-200 bg-background-0">
                      <Spinner
                        size="large"
                        color={theme.colors.accent}
                      />
                    </VStack>
                  ) : (
                    <VStack>
                      <GText size="xs" className="mx-4 mb-1 mt-2 uppercase tracking-wider text-typography-500">
                        Subfolders ({viewChildren.length})
                      </GText>
                      {viewChildren.map((child, index) => renderChildRow(child, index))}
                      {!pickerError && viewChildren.length === 0 && !viewLoading ? (
                        <Card variant="outline" size="sm" className="mx-4 mt-2 rounded-xl border-outline-200 bg-background-0">
                          <GText size="xs" className="text-typography-500">
                            No subfolders here. Tap the current folder card to refresh.
                          </GText>
                        </Card>
                      ) : null}
                    </VStack>
                  )}
                </VStack>
              </ScrollView>
            </EntranceAnimation>
          )}
        </SafeAreaView>
      </Box>
    </ModalScaffold>
  );
}
