import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  Linking,
} from "react-native";
import Markdown from "react-native-markdown-display";
import { useTheme } from "../../theme/index";
import { CloseIcon, ChevronDownIcon, ChevronRightIcon } from "../icons/ChatActionIcons";
import { wrapBareUrlsInMarkdown, stripFrontmatter } from "../../utils/markdown";

export interface SkillDetailSheetProps {
  visible: boolean;
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
  visible,
  skillId,
  serverBaseUrl,
  onClose,
  embedded = false,
}: SkillDetailSheetProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const markdownStyles = useMemo(
    () => ({
      body: { color: theme.textPrimary },
      text: { fontSize: 15, lineHeight: 24, color: theme.textPrimary },
      paragraph: { marginTop: 8, marginBottom: 8 },
      heading1: { fontSize: 20, lineHeight: 28, fontWeight: "700" as const, color: theme.textPrimary, marginTop: 16, marginBottom: 8 },
      heading2: { fontSize: 18, lineHeight: 26, fontWeight: "600" as const, color: theme.textPrimary, marginTop: 14, marginBottom: 6 },
      heading3: { fontSize: 16, lineHeight: 24, fontWeight: "600" as const, color: theme.textPrimary, marginTop: 12, marginBottom: 4 },
      heading4: { fontSize: 15, lineHeight: 22, fontWeight: "600" as const, color: theme.textPrimary },
      heading5: { fontSize: 14, lineHeight: 20, fontWeight: "600" as const, color: theme.textPrimary },
      heading6: { fontSize: 13, lineHeight: 18, fontWeight: "600" as const, color: theme.textPrimary },
      link: { color: theme.accent, textDecorationLine: "underline" as const },
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
        color: theme.textPrimary,
        backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.borderColor,
      },
      blockquote: {
        backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
        borderLeftColor: theme.accent,
        borderLeftWidth: 4,
        paddingLeft: 12,
        paddingVertical: 8,
        marginVertical: 8,
      },
      strong: { fontWeight: "600" as const, color: theme.textPrimary },
      bullet_list: {
        marginTop: 8,
        marginBottom: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.borderColor,
      },
      ordered_list: {
        marginTop: 8,
        marginBottom: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.borderColor,
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
          <View
            key={fullPath}
            style={[styles.childRow, depth > 0 && { marginLeft: 16 * depth }]}
          >
            <Text style={styles.childFileIcon}>•</Text>
            <Text style={styles.childName}>{child.name}</Text>
          </View>
        );
      }
      const isExpanded = expandedPaths.has(fullPath);
      const isLoading = loadingPaths.has(fullPath);
      const nested = loadedChildren.get(fullPath) ?? [];
      return (
        <View key={fullPath}>
          <TouchableOpacity
            style={[
              styles.childRow,
              styles.childRowFolder,
              depth > 0 && { marginLeft: 16 * depth },
            ]}
            onPress={() => toggleFolder(fullPath)}
            activeOpacity={0.7}
            accessibilityLabel={`${child.name} folder, ${isExpanded ? "expanded" : "collapsed"}`}
            accessibilityRole="button"
          >
            {isExpanded ? (
              <ChevronDownIcon size={12} color={theme.textMuted} style={styles.childChevron} />
            ) : (
              <ChevronRightIcon size={12} color={theme.textMuted} style={styles.childChevron} />
            )}
            <Text style={[styles.childName, styles.childNameFolder]}>{child.name}</Text>
            {isLoading && (
              <ActivityIndicator size="small" color={theme.accent} style={styles.childLoader} />
            )}
          </TouchableOpacity>
          {isExpanded && (
            <View style={styles.nestedList}>
              {isLoading && nested.length === 0 ? null : nested.map((c) =>
                renderChildRow(c, fullPath, `${fullPath}/${c.name}`, depth + 1)
              )}
            </View>
          )}
        </View>
      );
    },
    [expandedPaths, loadedChildren, loadingPaths, toggleFolder, theme, styles]
  );

  useEffect(() => {
    if (!visible || !skillId || !serverBaseUrl) {
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
  }, [visible, skillId, serverBaseUrl]);

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
  }, [visible, skillId, serverBaseUrl]);

  if (!visible) return null;

  const content = (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {detail?.name ?? skillId ?? "Skill Details"}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={12}
              accessibilityLabel="Close skill details"
            >
              <CloseIcon size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
          >
            {loading ? (
              <ActivityIndicator
                size="small"
                color={theme.accent}
                style={styles.loader}
              />
            ) : error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={handleRetry}
                  activeOpacity={0.8}
                  accessibilityLabel="Retry loading skill"
                >
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : detail ? (
              <>
                {detail.children && detail.children.length > 0 ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Child folders & files</Text>
                    <View style={styles.childrenList}>
                      {detail.children.map((child) =>
                        renderChildRow(child, "", child.name)
                      )}
                    </View>
                  </View>
                ) : null}
                {detail.content ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>SKILL.md</Text>
                    <View style={styles.contentCard}>
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
                    </View>
                  </View>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </View>
  );

  if (embedded) {
    return content;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {content}
    </Modal>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
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
      flex: 1,
      fontSize: 18,
      fontWeight: "600",
      color: theme.textPrimary,
      marginRight: 12,
    },
    closeBtn: {
      padding: 8,
      minWidth: 44,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24,
    },
    loader: {
      marginTop: 24,
    },
    errorContainer: {
      marginTop: 24,
    },
    errorText: {
      fontSize: 14,
      color: theme.danger,
      marginBottom: 12,
    },
    retryBtn: {
      alignSelf: "flex-start",
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.borderColor,
    },
    retryText: {
      fontSize: 14,
      color: theme.accent,
      fontWeight: "600",
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: "600",
      color: theme.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 10,
    },
    childrenList: {},
    childRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      backgroundColor: theme.cardBg ?? "rgba(0,0,0,0.04)",
      borderWidth: 1,
      borderColor: theme.borderColor,
      marginBottom: 4,
    },
    childRowFolder: {
      minHeight: 44,
    },
    childFileIcon: {
      fontSize: 12,
      color: theme.textMuted,
      width: 18,
      marginRight: 6,
    },
    childChevron: {
      marginRight: 6,
    },
    childLoader: {
      marginLeft: 8,
    },
    nestedList: {
      marginBottom: 4,
    },
    childName: {
      fontSize: 13,
      color: theme.textPrimary,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
    childNameFolder: {
      fontWeight: "600",
    },
    contentCard: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: theme.cardBg ?? (theme.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"),
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.borderColor,
      overflow: "hidden",
    },
  });
}
