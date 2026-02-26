import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  StyleSheet,
  FlatList,
  type TextStyle,
} from "react-native";
import { WebView } from "react-native-webview";
import { useTheme } from "@/theme/index";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { ScrollView } from "@/components/ui/scroll-view";
import { Spinner } from "@/components/ui/spinner";
import { StatusBar } from "@/components/ui/status-bar";
import { wrapBareUrlsInMarkdown } from "@/utils/markdown";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MarkdownContent } from "@/components/reusable/MarkdownContent";
import { ModalScaffold } from "@/components/reusable/ModalScaffold";
import {
  FileViewerHeader,
  FileViewerCodeLine,
  FileViewerSelectionFooter,
  FileViewerImageViewer,
  type CodeLineRecord,
} from "@/components/file/FileViewerSubcomponents";

const LINE_HEIGHT = 22;
const FONT_SIZE = 13;
const MAX_DISPLAY_LINES = 3000; // Avoid render freeze for very large files that slip through

import { BlurView } from "expo-blur";
import clsx from "clsx";

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
  fontFamily: "monospace",
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
  const codeBaseStyleWithTheme = useMemo<TextStyle>(
    () => ({ ...codeBaseStyle, color: theme.colors.textPrimary }),
    [theme.colors.textPrimary]
  );
  if (!isOpen) return null;

  const isDiffMode = path?.startsWith("__diff__:");
  const realPath = isDiffMode ? path!.replace(/^__diff__:(staged|unstaged):/, "") : path;

  const language = isDiffMode ? "diff" : getLanguage(realPath);
  const imageUri = isImage && content ? `data:${getImageMime(realPath)};base64,${content}` : null;

  const [imageScale, setImageScale] = useState(1);
  /** Line selection for "Add to prompt" (1-based). First tap sets start, second tap sets end. */
  const [selection, setSelection] = useState<{ start: number | null; end: number | null }>({
    start: null,
    end: null,
  });

  useEffect(() => {
    if (imageUri) setImageScale(1);
  }, [imageUri]);
  useEffect(() => {
    if (!isOpen) {
      setSelection({ start: null, end: null });
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
  const lineData = useMemo(
    () => lines.map((lineContent, index) => ({ id: `${path}-${index}`, lineContent, index })),
    [lines, path]
  );
  const lineListContainerStyle = useMemo(
    () => ({ paddingVertical: 12, paddingBottom: 32, paddingHorizontal: 0 }),
    []
  );

  const onLinePress = useCallback((lineIndex: number) => {
    const lineNum = lineIndex + 1;
    setSelection((prev) => {
      if (prev.start == null) {
        return { start: lineNum, end: lineNum };
      }
      if (prev.start === prev.end) {
        return {
          start: Math.min(prev.start, lineNum),
          end: Math.max(prev.end, lineNum),
        };
      }
      return { start: null, end: null };
    });
  }, []);
  const clearSelection = useCallback(() => {
    setSelection({ start: null, end: null });
  }, []);
  const handleAddToPrompt = useCallback(() => {
    if (!path || !content || selection.start == null || selection.end == null || !onAddCodeReference)
      return;
    const start = Math.min(selection.start, selection.end);
    const end = Math.max(selection.start, selection.end);
    const snippet = lines.slice(start - 1, end).join("\n");
    onAddCodeReference({ path, startLine: start, endLine: end, snippet });
    clearSelection();
  }, [path, content, lines, onAddCodeReference, clearSelection, selection.start, selection.end]);
  const selectionStart = selection.start;
  const selectionEnd = selection.end;
  const selectionRange = useMemo(() => {
    if (selectionStart == null || selectionEnd == null) return null;
    return {
      start: Math.min(selectionStart, selectionEnd),
      end: Math.max(selectionStart, selectionEnd),
    };
  }, [selectionStart, selectionEnd]);
  const hasSelection = selectionRange != null;
  const isLineSelected = useCallback(
    (index: number) => {
      if (!selectionRange) return false;
      const lineNum = index + 1;
      return lineNum >= selectionRange.start && lineNum <= selectionRange.end;
    },
    [selectionRange]
  );
  const displayFileName = (realPath && realPath.trim() !== "") ? realPath : "Untitled";
  const headerLabel = isDiffMode && path?.startsWith("__diff__:staged:") ? "Diff (Staged)"
    : isDiffMode && path?.startsWith("__diff__:unstaged:") ? "Diff (Unstaged)"
      : "File";

  const topInset = embedded ? 0 : insets.top;
  const contentBody = (
    <Box
      className={clsx("flex-1 overflow-hidden", !embedded && "rounded-lg")}
      style={[{ backgroundColor: theme.colors.surfaceAlt }, embedded ? undefined : { paddingTop: topInset }]}
    >
      {!embedded && <BlurView intensity={70} tint={theme.mode === "dark" ? "dark" : "light"} style={StyleSheet.absoluteFill} />}
      {embedded ? (
        <FileViewerHeader
          headerLabel={headerLabel}
          displayFileName={displayFileName}
          onClose={onClose}
        />
      ) : null}

      <StatusBar barStyle={theme.mode === "dark" ? "light-content" : "dark-content"} />

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
        <FileViewerImageViewer
          imageUri={imageUri}
          imageScale={imageScale}
          zoomOut={zoomOut}
          zoomIn={zoomIn}
          zoomReset={zoomReset}
          theme={theme}
        />
      )}

      {content !== null && !loading && !error && !isImage && isMarkdownFile(path) && (
        <Box className="flex-1">
          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 28,
              paddingBottom: 32,
              backgroundColor: theme.colors.surfaceAlt,
            }}
            showsVerticalScrollIndicator
            showsHorizontalScrollIndicator={false}
          >
            <MarkdownContent content={wrapBareUrlsInMarkdown(content)} />
          </ScrollView>
        </Box>
      )}

      {!!content && !loading && !error && !isImage && isHtmlFile(path) && (
        <Box className="flex-1">
          <WebView
            source={{ html: content || "<html></html>" }}
            style={{ flex: 1, backgroundColor: theme.colors.surfaceAlt }}
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            scalesPageToFit
          />
        </Box>
      )}

      {content !== null && !loading && !error && !isImage && !isMarkdownFile(realPath) && !isHtmlFile(realPath) && (
        <Box className="flex-1">
          {truncated && (
            <Box className="py-2 px-4 border-b border-outline-500" style={{ backgroundColor: theme.colors.accentSoft }}>
              <Text className="text-sm" style={{ color: theme.colors.textSecondary }}>
                Showing first {MAX_DISPLAY_LINES} of {allLines.length} lines
              </Text>
            </Box>
          )}
          {onAddCodeReference && (
            <FileViewerSelectionFooter
              hasSelection={hasSelection}
              selectionStart={selectionStart}
              selectionEnd={selectionEnd}
              onAddToPrompt={handleAddToPrompt}
              onClearSelection={clearSelection}
              theme={theme}
            />
          )}
          <FlatList
            data={lineData}
            keyExtractor={(item) => item.id}
            style={styles.codeListScroll}
            contentContainerStyle={lineListContainerStyle}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <FileViewerCodeLine
                item={item as CodeLineRecord}
                isDiffMode={!!isDiffMode}
                isDarkMode={theme.mode === "dark"}
                language={language}
                isSelected={isLineSelected(item.index)}
                onLinePress={onLinePress}
                codeBaseStyle={codeBaseStyleWithTheme}
                theme={theme}
                lineNumStyle={styles.lineNumText}
                lineNumSelectedStyle={styles.lineNumTextSelected}
                lineRowStyle={styles.codeRow}
                selectedLineStyle={styles.codeRowSelected}
                lineNumSelectedContainerStyle={styles.lineNumCellSelected}
                lineNumContainerStyle={styles.lineNumCell}
                codeContainerStyle={styles.codeCell}
              />
            )}
          />
        </Box>
      )}
    </Box>
  );

  if (embedded) {
    return contentBody;
  }

  return (
    <ModalScaffold
      isOpen
      onClose={onClose}
      size="full"
      title={displayFileName}
      subtitle={headerLabel}
      contentClassName="w-full h-full max-w-none rounded-none border-0 p-0"
      bodyClassName="m-0 p-0"
      bodyProps={{ scrollEnabled: false }}
    >
      {contentBody}
    </ModalScaffold>
  );
}

function createFileViewerStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
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
    codeListScroll: {
      flex: 1,
      backgroundColor: theme.colors.surfaceAlt,
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
      fontFamily: "monospace",
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
  });
}
