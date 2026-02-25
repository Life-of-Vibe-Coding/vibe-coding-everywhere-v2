import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  Platform,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Markdown from "react-native-markdown-display";
import { useTheme } from "@/theme/index";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { ScrollView } from "@/components/ui/scroll-view";
import { Pressable } from "@/components/ui/pressable";
import { Button, ButtonText } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
} from "@/components/ui/modal";
import { CloseIcon, ChevronDownIcon, ChevronRightIcon } from "@/components/icons/ChatActionIcons";
import { wrapBareUrlsInMarkdown, stripFrontmatter } from "@/utils/markdown";

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
  const markdownStyles = useMemo(
    () => ({
      body: { color: theme.colors.textPrimary },
      text: { fontSize: 15, lineHeight: 24, color: theme.colors.textPrimary },
      paragraph: { marginTop: 8, marginBottom: 8 },
      heading1: { fontSize: 20, lineHeight: 28, fontWeight: "700" as const, color: theme.colors.textPrimary, marginTop: 16, marginBottom: 8 },
      heading2: { fontSize: 18, lineHeight: 26, fontWeight: "600" as const, color: theme.colors.textPrimary, marginTop: 14, marginBottom: 6 },
      heading3: { fontSize: 16, lineHeight: 24, fontWeight: "600" as const, color: theme.colors.textPrimary, marginTop: 12, marginBottom: 4 },
      heading4: { fontSize: 15, lineHeight: 22, fontWeight: "600" as const, color: theme.colors.textPrimary },
      heading5: { fontSize: 14, lineHeight: 20, fontWeight: "600" as const, color: theme.colors.textPrimary },
      heading6: { fontSize: 13, lineHeight: 18, fontWeight: "600" as const, color: theme.colors.textPrimary },
      link: { color: theme.colors.accent, textDecorationLine: "underline" as const },
      code_inline: {
        fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
        fontSize: 13,
        backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
      },
      fence: {
        fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
        fontSize: 13,
        lineHeight: 20,
        color: theme.colors.textPrimary,
        backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.colors.border,
      },
      blockquote: {
        backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
        borderLeftColor: theme.colors.accent,
        borderLeftWidth: 4,
        paddingLeft: 12,
        paddingVertical: 8,
        marginVertical: 8,
      },
      strong: { fontWeight: "600" as const, color: theme.colors.textPrimary },
      bullet_list: {
        marginTop: 8,
        marginBottom: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.colors.border,
      },
      ordered_list: {
        marginTop: 8,
        marginBottom: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.colors.border,
      },
      list_item: { flexDirection: "row" as const, marginBottom: 4, minHeight: 22, alignItems: "flex-start" as const },
    }),
    [theme]
  );

  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loadedChildren, setLoadedChildren] = useState<Map<string, SkillChild[]>>(new Map());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());

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
    (child: SkillChild, parentPath: string, fullPath: string, depth = 0) => {
      if (child.type === "file") {
        return (
          <Box
            key={fullPath}
            className="flex-row items-center py-1.5 px-2.5 rounded-lg bg-secondary-100 border border-outline-500 mb-1"
            style={depth > 0 ? { marginLeft: 16 * depth } : undefined}
          >
            <Text className="text-xs text-text-muted w-4.5 mr-1.5">•</Text>
            <Text className="text-[13px] text-text-primary font-mono">{child.name}</Text>
          </Box>
        );
      }
      const isExpanded = expandedPaths.has(fullPath);
      const isLoading = loadingPaths.has(fullPath);
      const nested = loadedChildren.get(fullPath) ?? [];
      return (
        <Box key={fullPath}>
          <Pressable
            className="flex-row items-center py-1.5 px-2.5 rounded-lg bg-secondary-100 border border-outline-500 mb-1 min-h-11"
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
            <Text className="text-[13px] text-text-primary font-mono font-semibold">{child.name}</Text>
            {isLoading && (
              <Spinner size="small" color={theme.colors.accent} style={{ marginLeft: 8 }} />
            )}
          </Pressable>
          {isExpanded && (
            <Box className="mb-1">
              {isLoading && nested.length === 0 ? null : nested.map((c) =>
                renderChildRow(c, fullPath, `${fullPath}/${c.name}`, depth + 1)
              )}
            </Box>
          )}
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
  }, [isOpen, skillId, serverBaseUrl]);

  if (!isOpen) return null;

  // When embedded, parent (SkillConfigurationModal) already applies safe insets—avoid doubling.
  const safeStyle = embedded
    ? undefined
    : {
        paddingTop: Math.max(insets.top, 8),
        paddingBottom: Math.max(insets.bottom, 8),
      };

  const content = (
    <Box className="flex-1 bg-background-0">
      <Box className="flex-1" style={safeStyle}>
        <Box className="flex-row items-center justify-between py-4 px-5 border-b border-outline-500">
          <Text className="flex-1 text-lg font-semibold text-text-primary mr-3" numberOfLines={1}>
            {detail?.name ?? skillId ?? "Skill Details"}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityLabel="Close skill details"
            className="p-2 min-w-11 min-h-11 items-center justify-center"
          >
            <CloseIcon size={20} color={theme.colors.textSecondary} />
          </Pressable>
        </Box>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 24,
          }}
          showsVerticalScrollIndicator
        >
          {loading ? (
            <Spinner
              size="small"
              color={theme.colors.accent}
              style={{ marginTop: 24 }}
            />
          ) : error ? (
            <Box className="mt-6">
              <Text className="text-sm text-error-500 mb-3">{error}</Text>
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
                  <Text className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2.5">
                    Child folders & files
                  </Text>
                  <Box>
                    {detail.children.map((child) =>
                      renderChildRow(child, "", child.name)
                    )}
                  </Box>
                </Box>
              ) : null}
              {detail.content ? (
                <Box className="mb-6">
                  <Text className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2.5">
                    SKILL.md
                  </Text>
                  <Box className="px-4 py-3.5 bg-secondary-100 rounded-xl border border-outline-500 overflow-hidden">
                    <Markdown
                      style={markdownStyles}
                      mergeStyle
                      onLinkPress={(url) => {
                        Linking.openURL(url);
                        return false;
                      }}
                    >
                      {wrapBareUrlsInMarkdown(stripFrontmatter(detail.content))}
                    </Markdown>
                  </Box>
                </Box>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </Box>
    </Box>
  );

  if (embedded) {
    return content;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="full"
    >
      <ModalBackdrop onPress={onClose} />
      <ModalContent className="w-full h-full max-w-none rounded-none border-0 p-0">
        <ModalBody className="m-0 p-0">
          {content}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
