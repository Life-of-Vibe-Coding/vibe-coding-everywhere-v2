import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Platform,
  Dimensions,
  type TextStyle,
  Linking,
} from "react-native";
import { Highlight, themes } from "prism-react-renderer";
import Markdown from "react-native-markdown-display";
import { WebView } from "react-native-webview";
import { useTheme } from "@/theme/index";
import { Box } from "@/components/ui/box";
import { Text, Text as RNText } from "@/components/ui/text";
import { ScrollView } from "@/components/ui/scroll-view";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
} from "@/components/ui/modal";
import { Image } from "@/components/ui/image";
import { StatusBar } from "@/components/ui/status-bar";
import { wrapBareUrlsInMarkdown } from "@/utils/markdown";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const LINE_HEIGHT = 22;
const FONT_SIZE = 13;
const MAX_DISPLAY_LINES = 3000; // Avoid render freeze for very large files that slip through

/** Map file extension to Prism language (prism-react-renderer built-in set). */
function getLanguage(path: string | null): string {
  if (!path || !path.includes(".")) return "plaintext";
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    json: "json",
    md: "markdown",
    mdx: "mdx",
    css: "css",
    scss: "scss",
    html: "markup",
    py: "python",
    yml: "yaml",
    yaml: "yaml",
    sh: "bash",
    bash: "bash",
  };
  return map[ext] ?? "plaintext";
}

/** Convert CSS-like style from Prism theme to RN TextStyle (drop unsupported). */
function toRNStyle(style: Record<string, unknown> | undefined): TextStyle {
  if (!style || typeof style !== "object") return {};
  const out: TextStyle = {};
  if (typeof style.color === "string") out.color = style.color;
  if (typeof style.backgroundColor === "string") out.backgroundColor = style.backgroundColor;
  if (style.fontStyle === "italic" || style.fontStyle === "normal") out.fontStyle = style.fontStyle;
  if (typeof style.fontWeight === "string" || typeof style.fontWeight === "number")
    out.fontWeight = style.fontWeight as TextStyle["fontWeight"];
  if (typeof style.textDecorationLine === "string") out.textDecorationLine = style.textDecorationLine as TextStyle["textDecorationLine"];
  if (typeof style.opacity === "number") out.opacity = style.opacity;
  return out;
}

/** MIME type for image data URI from path extension. */
function getImageMime(path: string | null): string {
  if (!path || !path.includes(".")) return "image/png";
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const m: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    ico: "image/x-icon",
    svg: "image/svg+xml",
  };
  return m[ext] ?? "image/png";
}

/** True if path suggests a Markdown file that should be rendered as formatted prose. */
function isMarkdownFile(path: string | null): boolean {
  if (!path || !path.includes(".")) return false;
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return ext === "md" || ext === "mdx";
}

/** True if path suggests an HTML file that should be rendered. */
function isHtmlFile(path: string | null): boolean {
  if (!path || !path.includes(".")) return false;
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return ext === "html" || ext === "htm";
}

export type CodeRefPayload = {
  path: string;
  startLine: number;
  endLine: number;
  snippet: string;
};

interface FileViewerModalProps {
  isOpen: boolean;
  /** When true, render as content only (no Modal). Parent must place in a container that does not cover the app footer. */
  embedded?: boolean;
  path: string | null;
  content: string | null;
  isImage?: boolean;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  /** When user selects lines and taps "Add to prompt", called with file path, line range, and snippet. */
  onAddCodeReference?: (ref: CodeRefPayload) => void;
}

const codeBaseStyle: TextStyle = {
  fontSize: FONT_SIZE,
  lineHeight: LINE_HEIGHT,
  fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
};

export function FileViewerModal({
  isOpen,
  embedded,
  path,
  content,
  isImage = false,
  loading,
  error,
  onClose,
  onAddCodeReference,
}: FileViewerModalProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createFileViewerStyles(theme), [theme]);
  const markdownStyles = useMemo(
    () => ({
      body: { color: theme.colors.textPrimary },
      text: { fontSize: 15, lineHeight: 24, color: theme.colors.textPrimary },
      paragraph: { marginTop: 8, marginBottom: 8 },
      heading1: { fontSize: 22, lineHeight: 30, fontWeight: "700" as const, color: theme.colors.textPrimary, marginTop: 16, marginBottom: 8 },
      heading2: { fontSize: 19, lineHeight: 27, fontWeight: "600" as const, color: theme.colors.textPrimary, marginTop: 14, marginBottom: 6 },
      heading3: { fontSize: 17, lineHeight: 24, fontWeight: "600" as const, color: theme.colors.textPrimary, marginTop: 12, marginBottom: 4 },
      heading4: { fontSize: 15, lineHeight: 22, fontWeight: "600" as const, color: theme.colors.textPrimary },
      heading5: { fontSize: 14, lineHeight: 20, fontWeight: "600" as const, color: theme.colors.textPrimary },
      heading6: { fontSize: 13, lineHeight: 18, fontWeight: "600" as const, color: theme.colors.textPrimary },
      link: { color: theme.colors.accent, textDecorationLine: "underline" as const },
      code_inline: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 13, backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
      fence: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 13, lineHeight: 20, color: theme.colors.textPrimary, backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", padding: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
      blockquote: { backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", borderLeftColor: theme.colors.accent, borderLeftWidth: 4, paddingLeft: 12, paddingVertical: 8, marginVertical: 8 },
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
  if (!isOpen) return null;

  const isDiffMode = path?.startsWith("__diff__:");
  const realPath = isDiffMode ? path!.replace(/^__diff__:(staged|unstaged):/, "") : path;

  const language = isDiffMode ? "diff" : getLanguage(realPath);
  const imageUri = isImage && content ? `data:${getImageMime(realPath)};base64,${content}` : null;

  const [imageScale, setImageScale] = useState(1);
  /** Line selection for "Add to prompt" (1-based). First tap sets start, second tap sets end. */
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);

  useEffect(() => {
    if (imageUri) setImageScale(1);
  }, [imageUri]);
  useEffect(() => {
    if (!isOpen) {
      setSelectionStart(null);
      setSelectionEnd(null);
    }
  }, [isOpen]);

  const zoomIn = useCallback(() => {
    setImageScale((s) => Math.min(s + 0.5, 4));
  }, []);
  const zoomOut = useCallback(() => {
    setImageScale((s) => Math.max(s - 0.5, 0.25));
  }, []);
  const zoomReset = useCallback(() => {
    setImageScale(1);
  }, []);

  const allLines = content != null ? content.split("\n") : [];
  const truncated = allLines.length > MAX_DISPLAY_LINES;
  const lines = truncated ? allLines.slice(0, MAX_DISPLAY_LINES) : allLines;
  const onLinePress = useCallback(
    (lineIndex: number) => {
      const lineNum = lineIndex + 1;
      if (selectionStart == null) {
        setSelectionStart(lineNum);
        setSelectionEnd(lineNum);
      } else if (selectionStart === selectionEnd) {
        setSelectionStart(Math.min(selectionStart, lineNum));
        setSelectionEnd(Math.max(selectionEnd, lineNum));
      } else {
        setSelectionStart(null);
        setSelectionEnd(null);
      }
    },
    [selectionStart, selectionEnd]
  );
  const clearSelection = useCallback(() => {
    setSelectionStart(null);
    setSelectionEnd(null);
  }, []);
  const handleAddToPrompt = useCallback(() => {
    if (!path || !content || selectionStart == null || selectionEnd == null || !onAddCodeReference)
      return;
    const start = Math.min(selectionStart, selectionEnd);
    const end = Math.max(selectionStart, selectionEnd);
    const snippet = lines.slice(start - 1, end).join("\n");
    onAddCodeReference({ path, startLine: start, endLine: end, snippet });
    clearSelection();
  }, [path, content, selectionStart, selectionEnd, lines, onAddCodeReference, clearSelection]);
  const hasSelection = selectionStart != null && selectionEnd != null;
  const displayFileName = (realPath && realPath.trim() !== "") ? realPath : "Untitled";
  const headerLabel = isDiffMode && path?.startsWith("__diff__:staged:") ? "Diff (Staged)"
    : isDiffMode && path?.startsWith("__diff__:unstaged:") ? "Diff (Unstaged)"
      : "File";

  const topInset = embedded ? 0 : insets.top;
  const contentView = (
    <Box style={[styles.container, embedded ? undefined : { paddingTop: topInset }]}>
      <Box style={styles.header}>
        <Box style={styles.headerTitleWrap}>
          <Text style={styles.headerLabel}>{headerLabel}</Text>
          <Text style={styles.path} numberOfLines={1} ellipsizeMode="middle">
            {displayFileName}
          </Text>
        </Box>
        <Pressable
          onPress={onClose}
          style={styles.closeBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
      </Box>

      {loading && (
        <Box style={styles.center}>
          <Spinner size="large" color={theme.colors.accent} />
        </Box>
      )}

      {error && !loading && (
        <Box style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </Box>
      )}

      {imageUri && (
        <Box style={styles.imageWrap}>
          <Box style={styles.zoomBar}>
            <Pressable style={styles.zoomBtn} onPress={zoomOut} accessibilityLabel="Zoom out">
              <Text style={styles.zoomBtnText}>−</Text>
            </Pressable>
            <Pressable style={styles.zoomLabel} onPress={zoomReset}>
              <Text style={styles.zoomLabelText}>{Math.round(imageScale * 100)}%</Text>
            </Pressable>
            <Pressable style={styles.zoomBtn} onPress={zoomIn} accessibilityLabel="Zoom in">
              <Text style={styles.zoomBtnText}>+</Text>
            </Pressable>
          </Box>
          <ScrollView
            style={styles.codeScroll}
            contentContainerStyle={styles.imageScrollContent}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          >
            <Box style={[styles.imageScaleWrap, { transform: [{ scale: imageScale }] }]}>
              <Image
                source={{ uri: imageUri }}
                style={[styles.image, { width: Dimensions.get("window").width - 32 }]}
                resizeMode="contain"
              />
            </Box>
          </ScrollView>
        </Box>
      )}

      {content !== null && !loading && !error && !isImage && isMarkdownFile(path) && (
        <Box style={styles.markdownWrap}>
          <ScrollView
            style={styles.markdownScroll}
            contentContainerStyle={styles.markdownScrollContent}
            showsVerticalScrollIndicator
            showsHorizontalScrollIndicator={false}
          >
            <Markdown
              style={markdownStyles}
              mergeStyle
              onLinkPress={(url) => {
                Linking.openURL(url);
                return false;
              }}
            >
              {wrapBareUrlsInMarkdown(content)}
            </Markdown>
          </ScrollView>
        </Box>
      )}

      {content !== null && !loading && !error && !isImage && isHtmlFile(path) && (
        <Box style={styles.htmlWrap}>
          <WebView
            source={{ html: content }}
            style={styles.htmlWebView}
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            scalesPageToFit
          />
        </Box>
      )}

      {content !== null && !loading && !error && !isImage && !isMarkdownFile(realPath) && !isHtmlFile(realPath) && (
        <Box style={styles.codeWrap}>
          {truncated && (
            <Box style={styles.truncatedBanner}>
              <Text style={styles.truncatedText}>
                Showing first {MAX_DISPLAY_LINES} of {allLines.length} lines
              </Text>
            </Box>
          )}
          {hasSelection && onAddCodeReference && (
            <Box style={styles.addRefBar}>
              <Text style={styles.addRefHint}>
                {selectionStart === selectionEnd
                  ? `Line ${selectionStart}`
                  : `Lines ${selectionStart}-${selectionEnd}`}
              </Text>
              <Pressable style={styles.addRefBtn} onPress={handleAddToPrompt}>
                <Text style={styles.addRefBtnText}>Add to prompt</Text>
              </Pressable>
              <Pressable style={styles.cancelRefBtn} onPress={clearSelection}>
                <Text style={styles.cancelRefBtnText}>Cancel</Text>
              </Pressable>
            </Box>
          )}
          <ScrollView
            style={styles.codeScroll}
            contentContainerStyle={styles.codeScrollContent}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
          >
            <Box style={styles.codeWithNumbers}>
              {lines.map((lineContent, i) => {
                const lineNum = i + 1;
                const selected =
                  selectionStart != null &&
                  selectionEnd != null &&
                  lineNum >= Math.min(selectionStart, selectionEnd) &&
                  lineNum <= Math.max(selectionStart, selectionEnd);

                let diffStyle = null;
                if (isDiffMode) {
                  if (lineContent.startsWith("+") && !lineContent.startsWith("+++")) {
                    diffStyle = { backgroundColor: theme.mode === "dark" ? "rgba(34, 197, 94, 0.25)" : "rgba(34, 197, 94, 0.15)" };
                  } else if (lineContent.startsWith("-") && !lineContent.startsWith("---")) {
                    diffStyle = { backgroundColor: theme.mode === "dark" ? "rgba(239, 68, 68, 0.25)" : "rgba(239, 68, 68, 0.15)" };
                  } else if (lineContent.startsWith("@@ ")) {
                    diffStyle = { backgroundColor: theme.mode === "dark" ? "rgba(59, 130, 246, 0.2)" : "rgba(59, 130, 246, 0.1)" };
                  }
                }

                return (
                  <Pressable
                    key={i}
                    style={[styles.codeRow, selected && styles.codeRowSelected, diffStyle]}
                    onPress={() => onLinePress(i)}
                  >
                    <Box style={[styles.lineNumCell, selected && styles.lineNumCellSelected]}>
                      <Text style={[styles.lineNumText, selected && styles.lineNumTextSelected]}>
                        {lineNum}
                      </Text>
                    </Box>
                    <Box style={styles.codeCell}>
                      <Highlight theme={themes.vsLight} code={lineContent} language={language}>
                        {({ tokens, getTokenProps }) => (
                          <RNText style={codeBaseStyle} selectable>
                            {(tokens[0] ?? []).map((token, k) => {
                              const tokenProps = getTokenProps({ token });
                              const rnStyle = toRNStyle(tokenProps.style as Record<string, unknown>);
                              return (
                                <RNText key={k} style={rnStyle}>
                                  {tokenProps.children}
                                </RNText>
                              );
                            })}
                          </RNText>
                        )}
                      </Highlight>
                    </Box>
                  </Pressable>
                );
              })}
            </Box>
          </ScrollView>
        </Box>
      )}
    </Box>
  );

  if (embedded) {
    return contentView;
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="full"
    >
      <ModalBackdrop onPress={onClose} />
      <ModalContent className="w-full h-full max-w-none rounded-none border-0 p-0">
        <ModalBody className="m-0 p-0">
          <StatusBar barStyle="dark-content" />
          {contentView}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

function createFileViewerStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 12,
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 48,
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: theme.colors.surfaceAlt,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTitleWrap: {
      flex: 1,
      marginRight: 12,
      minWidth: 0,
    },
    headerLabel: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      marginBottom: 2,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    path: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    closeBtn: {
      padding: 4,
    },
    closeBtnText: {
      fontSize: 18,
      color: theme.colors.textSecondary,
    },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    errorText: {
      fontSize: 14,
      color: theme.colors.danger,
    },
    imageWrap: {
      flex: 1,
    },
    zoomBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 24,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
    },
    zoomBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    zoomBtnText: {
      fontSize: 24,
      fontWeight: "300",
      color: theme.colors.textPrimary,
    },
    zoomLabel: {
      minWidth: 56,
      alignItems: "center",
    },
    zoomLabelText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontWeight: "500",
    },
    imageScaleWrap: {
      alignSelf: "center",
      width: Dimensions.get("window").width - 32,
    },
    markdownWrap: {
      flex: 1,
    },
    markdownScroll: {
      flex: 1,
      backgroundColor: theme.colors.surfaceAlt,
    },
    markdownScrollContent: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      paddingBottom: 32,
    },
    htmlWrap: {
      flex: 1,
    },
    htmlWebView: {
      flex: 1,
      backgroundColor: theme.colors.surfaceAlt,
    },
    codeWrap: {
      flex: 1,
    },
    truncatedBanner: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      backgroundColor: theme.colors.accentSoft,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    truncatedText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    addRefBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      backgroundColor: theme.colors.accentSoft,
    },
    addRefHint: {
      fontSize: 13,
      color: theme.colors.textPrimary,
    },
    addRefBtn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: theme.colors.accent,
    },
    addRefBtnText: {
      fontSize: 14,
      color: theme.colors.textInverse,
      fontWeight: "600",
    },
    cancelRefBtn: {
      paddingVertical: 6,
      paddingHorizontal: 8,
    },
    cancelRefBtnText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    codeScroll: {
      flex: 1,
      backgroundColor: theme.colors.surfaceAlt,
    },
    codeScrollContent: {
      paddingVertical: 12,
      paddingBottom: 32,
      paddingHorizontal: 0,
    },
    codeWithNumbers: {
      paddingLeft: 4,
      paddingRight: 8,
    },
    codeRow: {
      flexDirection: "row",
      minHeight: LINE_HEIGHT,
      alignItems: "flex-start",
    },
    codeRowSelected: {
      backgroundColor: theme.colors.accentSoft,
    },
    lineNumCell: {
      minWidth: 28,
      paddingRight: 6,
      borderRightWidth: 1,
      borderRightColor: theme.colors.border,
      minHeight: LINE_HEIGHT,
      justifyContent: "flex-start",
      paddingVertical: 2,
      alignItems: "flex-end",
    },
    lineNumCellSelected: {
      backgroundColor: "transparent",
    },
    lineNumText: {
      fontSize: FONT_SIZE,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      color: theme.colors.textSecondary,
    },
    lineNumTextSelected: {
      color: theme.colors.accent,
      fontWeight: "600",
    },
    codeCell: {
      flex: 1,
      paddingLeft: 4,
      minHeight: LINE_HEIGHT,
      justifyContent: "flex-start",
    },
    imageScrollContent: {
      flexGrow: 1,
      padding: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    image: {
      width: "100%",
      minHeight: 200,
      maxWidth: Dimensions.get("window").width - 32,
    },
  });
}
