import { ChevronDownIcon, ChevronRightIcon, CloseIcon } from "@/components/icons/ChatActionIcons";
import { MarkdownContent } from "@/components/reusable/MarkdownContent";
import { ModalScaffold } from "@/components/reusable/ModalScaffold";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme/index";
import { stripFrontmatter, wrapBareUrlsInMarkdown } from "@/utils/markdown";
import React, { useCallback, useEffect, useState } from "react";
import type { ScrollView as RNScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const isDark = theme.mode === "dark";
  const pageSurface = isDark ? "rgba(7, 11, 21, 0.94)" : "rgba(255, 255, 255, 0.96)";
  const headerSurface = isDark ? "rgba(10, 16, 30, 0.94)" : "rgba(248, 250, 252, 0.98)";
  const panelBorder = isDark ? "rgba(162, 210, 255, 0.28)" : "rgba(15, 23, 42, 0.12)";
  const titleColor = isDark ? "#EAF4FF" : "#0F172A";
  const bodyColor = isDark ? "#D9E8F9" : "#1E293B";
  const mutedColor = isDark ? "rgba(217, 232, 249, 0.82)" : "#475569";
  const cardSurface = isDark ? "rgba(16, 24, 40, 0.9)" : "rgba(248, 250, 252, 0.96)";
  const markdownThemeStyles = {
    body: {
      color: bodyColor,
      lineHeight: 22,
      fontSize: 14,
    },
    text: {
      color: bodyColor,
    },
    paragraph: {
      color: bodyColor,
    },
    heading1: {
      color: titleColor,
    },
    heading2: {
      color: titleColor,
    },
    heading3: {
      color: titleColor,
    },
    heading4: {
      color: titleColor,
    },
    heading5: {
      color: titleColor,
    },
    heading6: {
      color: titleColor,
    },
    code_inline: {
      backgroundColor: isDark ? "rgba(148, 163, 184, 0.16)" : "#E2E8F0",
      color: isDark ? "#E2E8F0" : "#0F172A",
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    code_block: {
      backgroundColor: isDark ? "rgba(2, 6, 23, 0.9)" : "#0F172A",
      color: "#F8FAFC",
      borderRadius: 8,
      padding: 12,
    },
    fence: {
      backgroundColor: isDark ? "rgba(2, 6, 23, 0.9)" : "#0F172A",
      color: "#F8FAFC",
      borderRadius: 8,
      padding: 12,
    },
    link: {
      color: isDark ? "#93C5FD" : "#2563EB",
    },
    bullet_list_icon: {
      color: bodyColor,
    },
    ordered_list_icon: {
      color: bodyColor,
    },
  };

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
            className="mb-1 flex-row items-center rounded-lg border px-2.5 py-1.5"
            style={[
              { borderColor: panelBorder, backgroundColor: cardSurface },
              depth > 0 ? { marginLeft: 16 * depth } : undefined,
            ]}
          >
            <Text className="mr-1.5 w-4.5 text-xs" style={{ color: mutedColor }}>-</Text>
            <Text className="font-mono text-[13px]" style={{ color: bodyColor }}>{child.name}</Text>
          </Box>
        );
      }
      const isExpanded = expandedPaths.has(fullPath);
      const isLoading = loadingPaths.has(fullPath);
      const nested = loadedChildren.get(fullPath) ?? [];
      return (
        <Box key={fullPath}>
          <Pressable
            className="mb-1 min-h-11 flex-row items-center rounded-lg border px-2.5 py-1.5"
            style={({ pressed }) => [
              { borderColor: panelBorder, backgroundColor: pressed ? (isDark ? "rgba(173, 222, 255, 0.12)" : "rgba(15, 23, 42, 0.06)") : cardSurface },
              depth > 0 ? { marginLeft: 16 * depth } : undefined,
            ]}
            onPress={() => toggleFolder(fullPath)}
            accessibilityLabel={`${child.name} folder, ${isExpanded ? "expanded" : "collapsed"}`}
            accessibilityRole="button"
          >
            <Box className="mr-1.5">
              {isExpanded ? (
                <ChevronDownIcon size={12} color={mutedColor} />
              ) : (
                <ChevronRightIcon size={12} color={mutedColor} />
              )}
            </Box>
            <Text className="font-mono text-[13px] font-semibold" style={{ color: bodyColor }}>{child.name}</Text>
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
              <Text className="mb-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: mutedColor }}>
                Child folders & files
              </Text>
              <Box>
                {detail.children.map((child) => renderChildRow(child, child.name))}
              </Box>
            </Box>
          ) : null}
          {detail.content ? (
            <Box className="mb-6">
              <Text className="mb-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: mutedColor }}>
                SKILL.md
              </Text>
              <Box
                className="rounded-xl border px-4 pt-4 pb-3.5"
                style={{ borderColor: panelBorder, backgroundColor: cardSurface }}
              >
                <MarkdownContent
                  content={wrapBareUrlsInMarkdown(stripFrontmatter(detail.content))}
                  markdownProps={{ style: markdownThemeStyles, mergeStyle: true }}
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
      paddingTop: Math.max(insets.top, 8),
      paddingBottom: Math.max(insets.bottom, 8),
    };

    return (
      <Box className="flex-1" style={[safeStyle, { backgroundColor: pageSurface }]}>
        <Box
          className="flex-row items-center justify-between border-b px-5 py-4"
          style={{ borderBottomColor: panelBorder, backgroundColor: headerSurface }}
        >
          <Text className="mr-3 flex-1 text-lg font-semibold" style={{ color: titleColor }} numberOfLines={1}>
            {detail?.name ?? skillId ?? "Skill Details"}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityLabel="Close skill details"
            className="min-h-11 min-w-11 items-center justify-center p-2"
          >
            <CloseIcon size={20} color={mutedColor} />
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
      <Box className="flex-1" style={{ backgroundColor: pageSurface }}>{body}</Box>
    </ModalScaffold>
  );
}
