import React, { useState, useCallback, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/index";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { ScrollView } from "@/components/ui/scroll-view";
import { Pressable } from "@/components/ui/pressable";
import { Button, ButtonText } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ChevronDownIcon, ChevronRightIcon, CloseIcon } from "@/components/icons/ChatActionIcons";
import { MarkdownContent } from "@/components/reusable/MarkdownContent";
import { ModalScaffold } from "@/components/reusable/ModalScaffold";
import { wrapBareUrlsInMarkdown, stripFrontmatter } from "@/utils/markdown";
import type { ScrollView as RNScrollView } from "react-native";

export interface SkillDetailSheetProps {
  isOpen: boolean;
  skillId: string | null;
  serverBaseUrl: string;
  onClose: () => void;
  /** When true, render as a View overlay instead of Modal (for stacking inside another Modal on iOS) */
  embedded?: boolean;
}

type SkillChild = { name: string; type: "directory" | "file" };

type SkillDetail = {
  id: string;
  name: string;
  description: string;
  content: string;
  children?: SkillChild[];
};

export function SkillDetailSheet({
  isOpen,
  skillId,
  serverBaseUrl,
  onClose,
  embedded = false,
}: SkillDetailSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loadedChildren, setLoadedChildren] = useState<Map<string, SkillChild[]>>(new Map());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const scrollViewRef = React.useRef<RNScrollView>(null);

  const fetchChildren = useCallback(
    (path: string) => {
      if (!skillId || !serverBaseUrl) return;
      setLoadingPaths((prev) => new Set(prev).add(path));
      const q = path ? `?path=${encodeURIComponent(path)}` : "";
      fetch(`${serverBaseUrl}/api/skills/${encodeURIComponent(skillId)}/children${q}`)
        .then((r) => {
          if (!r.ok) throw new Error("Failed to load");
          return r.json();
        })
        .then((data) => {
          const kids = data?.children ?? [];
          setLoadedChildren((prev) => new Map(prev).set(path, kids));
        })
        .catch(() => {
          setLoadedChildren((prev) => new Map(prev).set(path, []));
        })
        .finally(() => {
          setLoadingPaths((prev) => {
            const next = new Set(prev);
            next.delete(path);
            return next;
          });
        });
    },
    [skillId, serverBaseUrl]
  );

  const toggleFolder = useCallback(
    (path: string) => {
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
          if (!loadedChildren.has(path) && !loadingPaths.has(path)) {
            fetchChildren(path);
          }
        }
        return next;
      });
    },
    [loadedChildren, loadingPaths, fetchChildren]
  );

  const renderChildRow = useCallback(
    (child: SkillChild, fullPath: string, depth = 0) => {
      if (child.type === "file") {
        return (
          <Box
            key={fullPath}
            className="mb-1 flex-row items-center rounded-lg border border-outline-500 bg-secondary-100 px-2.5 py-1.5"
            style={depth > 0 ? { marginLeft: 16 * depth } : undefined}
          >
            <Text className="mr-1.5 w-4.5 text-xs text-text-muted">-</Text>
            <Text className="font-mono text-[13px] text-text-primary">{child.name}</Text>
          </Box>
        );
      }
      const isExpanded = expandedPaths.has(fullPath);
      const isLoading = loadingPaths.has(fullPath);
      const nested = loadedChildren.get(fullPath) ?? [];
      return (
        <Box key={fullPath}>
          <Pressable
            className="mb-1 min-h-11 flex-row items-center rounded-lg border border-outline-500 bg-secondary-100 px-2.5 py-1.5"
            style={depth > 0 ? { marginLeft: 16 * depth } : undefined}
            onPress={() => toggleFolder(fullPath)}
            accessibilityLabel={`${child.name} folder, ${isExpanded ? "expanded" : "collapsed"}`}
            accessibilityRole="button"
          >
            <Box className="mr-1.5">
              {isExpanded ? (
                <ChevronDownIcon size={12} color={theme.colors.textSecondary} />
              ) : (
                <ChevronRightIcon size={12} color={theme.colors.textSecondary} />
              )}
            </Box>
            <Text className="font-mono text-[13px] font-semibold text-text-primary">{child.name}</Text>
            {isLoading ? (
              <Spinner size="small" color={theme.colors.accent} style={{ marginLeft: 8 }} />
            ) : null}
          </Pressable>
          {isExpanded ? (
            <Box className="mb-1">
              {isLoading && nested.length === 0
                ? null
                : nested.map((c) => renderChildRow(c, `${fullPath}/${c.name}`, depth + 1))}
            </Box>
          ) : null}
        </Box>
      );
    },
    [expandedPaths, loadedChildren, loadingPaths, toggleFolder, theme]
  );

  useEffect(() => {
    if (!isOpen || !skillId || !serverBaseUrl) {
      setDetail(null);
      setError(null);
      setExpandedPaths(new Set());
      setLoadedChildren(new Map());
      setLoadingPaths(new Set());
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`${serverBaseUrl}/api/skills/${encodeURIComponent(skillId)}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Skill not found" : `Failed to load: ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setDetail({
          id: data.id,
          name: data.name,
          description: data.description ?? "",
          content: data.content ?? "",
          children: data.children ?? [],
        });
      })
      .catch((err) => {
        setDetail(null);
        setError(err?.message ?? "Failed to load skill");
      })
      .finally(() => setLoading(false));
  }, [isOpen, skillId, serverBaseUrl]);

  useEffect(() => {
    if (isOpen) {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    }
  }, [isOpen, skillId]);

  const handleRetry = useCallback(() => {
    if (!skillId || !serverBaseUrl) return;
    setError(null);
    setLoading(true);
    fetch(`${serverBaseUrl}/api/skills/${encodeURIComponent(skillId)}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Skill not found" : `Failed to load: ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setDetail({
          id: data.id,
          name: data.name,
          description: data.description ?? "",
          content: data.content ?? "",
          children: data.children ?? [],
        });
      })
      .catch((err) => {
        setError(err?.message ?? "Failed to load skill");
      })
      .finally(() => setLoading(false));
  }, [skillId, serverBaseUrl]);

  if (!isOpen) return null;

  const body = (
    <ScrollView
      ref={scrollViewRef}
      key={skillId ?? "skill-detail"}
      className="flex-1"
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 24,
      }}
      showsVerticalScrollIndicator
    >
      {loading ? (
        <Spinner size="small" color={theme.colors.accent} style={{ marginTop: 24 }} />
      ) : error ? (
        <Box className="mt-6">
          <Text className="mb-3 text-sm text-error-500">{error}</Text>
          <Button
            variant="outline"
            size="sm"
            onPress={handleRetry}
            accessibilityLabel="Retry loading skill"
            className="self-start"
          >
            <ButtonText>Retry</ButtonText>
          </Button>
        </Box>
      ) : detail ? (
        <>
          {detail.children && detail.children.length > 0 ? (
            <Box className="mb-6">
              <Text className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Child folders & files
              </Text>
              <Box>
                {detail.children.map((child) => renderChildRow(child, child.name))}
              </Box>
            </Box>
          ) : null}
          {detail.content ? (
            <Box className="mb-6">
              <Text className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                SKILL.md
              </Text>
              <Box className="rounded-xl border border-outline-500 bg-secondary-100 px-4 pt-4 pb-3.5">
                <MarkdownContent
                  content={wrapBareUrlsInMarkdown(stripFrontmatter(detail.content))}
                />
              </Box>
            </Box>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );

  if (embedded) {
    const safeStyle = {
      paddingTop: 0,
      paddingBottom: Math.max(insets.bottom, 8),
    };

    return (
      <Box className="flex-1 bg-background-0" style={safeStyle}>
        <Box className="flex-row items-center justify-between border-b border-outline-500 px-5 py-4">
          <Text className="mr-3 flex-1 text-lg font-semibold text-text-primary" numberOfLines={1}>
            {detail?.name ?? skillId ?? "Skill Details"}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityLabel="Close skill details"
            className="min-h-11 min-w-11 items-center justify-center p-2"
          >
            <CloseIcon size={20} color={theme.colors.textSecondary} />
          </Pressable>
        </Box>
        {body}
      </Box>
    );
  }

  return (
    <ModalScaffold
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      title={detail?.name ?? skillId ?? "Skill Details"}
      contentClassName="h-full w-full max-w-none rounded-none border-0 p-0"
      bodyClassName="m-0 p-0"
      bodyProps={{ scrollEnabled: false }}
    >
      <Box className="flex-1 bg-background-0">{body}</Box>
    </ModalScaffold>
  );
}
