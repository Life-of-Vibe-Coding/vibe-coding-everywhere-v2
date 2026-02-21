import React, { useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "../../theme/index";

export type RunOutputLine = { type: "stdout" | "stderr"; text: string };

interface RunOutputViewProps {
  lines: RunOutputLine[];
  title?: string;
  /** When provided, show the executed command above the output (always visible). */
  command?: string | null;
  maxHeight?: number;
  /** When provided, show "Terminate" button; called to kill the run process and clear output. */
  onTerminate?: () => void;
  /** When true, show container with placeholder when lines are empty (e.g. in integrated Run & Preview page). */
  showWhenEmpty?: boolean;
  /** When provided, show a fullscreen button in the title row that calls this. */
  onFullScreen?: () => void;
  /** When true, allow the output area to grow (e.g. in fullscreen modal). */
  flexOutput?: boolean;
  /** When false, do not show the last command bar at the bottom. Command is always shown inside the output as the first line when provided. Default true for backward compat. */
  showCommand?: boolean;
  /** When provided, URLs in output are shown as underlined links and open in the app's internal browser. */
  onOpenUrl?: (url: string) => void;
  /** When true, a command is currently executing; shows a loading effect on the command line and empty state. */
  isExecuting?: boolean;
}

/** Strip ANSI escape sequences for display. */
function stripAnsi(str: string): string {
  return str.replace(/\x1B\[[0-9;?]*[ -/]*[@-~]|\x1B\][^\x07]*(?:\x07|\x1B\\)|\x1B[@-_]|\x1B.|[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
}

/** Match http/https URLs; trailing punctuation excluded. Allow : in path (e.g. port like :5174). */
const URL_REGEX = /https?:\/\/[^\s\]\)\}\"']+?(?=[,;)\]}\s]|$)/g;

type LineSegment = { type: "text"; value: string } | { type: "url"; value: string };

function segmentLine(text: string): LineSegment[] {
  const segments: LineSegment[] = [];
  let lastEnd = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(URL_REGEX.source, "g");
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastEnd) {
      segments.push({ type: "text", value: text.slice(lastEnd, m.index) });
    }
    segments.push({ type: "url", value: m[0] });
    lastEnd = re.lastIndex;
  }
  if (lastEnd < text.length) {
    segments.push({ type: "text", value: text.slice(lastEnd) });
  }
  return segments.length > 0 ? segments : [{ type: "text", value: text }];
}

export function RunOutputView({
  lines,
  title = "Terminal output",
  command,
  maxHeight = 200,
  onTerminate,
  showWhenEmpty,
  onFullScreen,
  flexOutput,
  showCommand = true,
  onOpenUrl,
  isExecuting = false,
}: RunOutputViewProps) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isExecuting) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.88,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isExecuting, pulseAnim]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          width: "100%",
          borderWidth: 1,
          borderColor: theme.borderColor,
          backgroundColor: theme.beigeBg,
          borderRadius: 10,
          overflow: "hidden",
        },
        containerFlex: { flex: 1, minHeight: 0 },
        titleRow: {
          flexDirection: "row" as const,
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderBottomWidth: 1,
          borderBottomColor: theme.borderColor,
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
        },
        title: { fontSize: 12, fontWeight: "600" as const, color: theme.textMuted },
        titleActions: { flexDirection: "row" as const, alignItems: "center", gap: 12 },
        titleActionButton: { padding: 4 },
        fullScreenIcon: { fontSize: 16, color: theme.textMuted },
        commandBar: {
          flexDirection: "row" as const,
          alignItems: "center",
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderTopWidth: 1,
          borderTopColor: theme.borderColor,
          backgroundColor: theme.beigeBg,
          borderBottomLeftRadius: 10,
          borderBottomRightRadius: 10,
        },
        commandPrefix: {
          fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
          fontSize: 12,
          color: theme.textMuted,
          marginRight: 4,
        },
        commandText: {
          flex: 1,
          fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
          fontSize: 12,
          color: theme.textPrimary,
        },
        terminateButton: { flexDirection: "row" as const, alignItems: "center", gap: 4 },
        terminateIcon: { fontSize: 18, fontWeight: "600" as const, color: theme.accent, lineHeight: 20 },
        terminateText: { fontSize: 12, color: theme.accent },
        scroll: { maxHeight: 200 },
        scrollFlex: { flex: 1, minHeight: 120 },
        content: { padding: 10, paddingBottom: 16 },
        line: {
          fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
          fontSize: 12,
          lineHeight: 18,
        },
        stdout: { color: theme.textPrimary },
        stderr: { color: theme.danger },
        link: { textDecorationLine: "underline" as const, color: theme.accent },
        emptyPlaceholder: { justifyContent: "center", padding: 16 },
        emptyPlaceholderText: { fontSize: 13, color: theme.textMuted, textAlign: "center" as const },
        executingRow: {
          flexDirection: "row" as const,
          alignItems: "center",
          gap: 8,
          paddingVertical: 2,
          paddingHorizontal: 4,
          marginHorizontal: -4,
          borderRadius: 6,
          backgroundColor: theme.accentLight ?? theme.accent + "22",
        },
        executingSpinner: { marginRight: 4 },
      }),
    [theme]
  );

  useEffect(() => {
    if (lines.length > 0) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [lines.length]);

  // When command is provided, show it as the first line inside the output (not in a bar at the bottom).
  // Skip prepend if the first line is already the command echo (e.g. from runOutputLines).
  const firstIsEcho =
    lines.length > 0 &&
    command != null &&
    command !== "" &&
    lines[0].type === "stdout" &&
    lines[0].text.trim().startsWith(`$ ${command.trim()}`);
  const displayLines: RunOutputLine[] =
    command != null && command !== "" && !firstIsEcho
      ? [{ type: "stdout", text: `$ ${command}\n` }, ...lines]
      : lines;

  const isEmpty = displayLines.length === 0;
  const showContainer = isEmpty && !showWhenEmpty && !command;
  if (showContainer) return null;

  const scrollStyle = flexOutput ? styles.scrollFlex : [styles.scroll, { maxHeight }];
  const emptyStyle = flexOutput ? [styles.scroll, styles.scrollFlex, styles.emptyPlaceholder] : [styles.scroll, styles.emptyPlaceholder, { maxHeight }];

  return (
    <View style={[styles.container, flexOutput && styles.containerFlex]}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.titleActions}>
          {onFullScreen && (
            <TouchableOpacity onPress={onFullScreen} hitSlop={8} style={styles.titleActionButton}>
              <Text style={styles.fullScreenIcon}>⛶</Text>
            </TouchableOpacity>
          )}
          {onTerminate && (displayLines.length > 0 || showWhenEmpty || command) && (
            <TouchableOpacity onPress={onTerminate} hitSlop={8} style={styles.terminateButton}>
              <Text style={styles.terminateIcon}>×</Text>
              <Text style={styles.terminateText}>Terminate</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {isEmpty ? (
        <View style={emptyStyle}>
          {command && isExecuting ? (
            <View style={styles.executingRow}>
              <ActivityIndicator size="small" color={theme.accent} style={styles.executingSpinner} />
              <Text style={styles.emptyPlaceholderText}>Running command…</Text>
            </View>
          ) : (
            <Text style={styles.emptyPlaceholderText}>
              {command
                ? "Waiting for output…"
                : "Tap Run on a code block in the chat, or type a command below to see output here."}
            </Text>
          )}
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={scrollStyle}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
        >
          {displayLines.map((line, i) => {
            const plain = stripAnsi(line.text);
            const segments = segmentLine(plain);
            const hasUrl = segments.some((s) => s.type === "url");
            const lineStyle = [styles.line, line.type === "stderr" ? styles.stderr : styles.stdout];
            const isCommandLine = isExecuting && i === 0 && command != null && command !== "" && line.text.trim().startsWith("$ ");
            const lineContent = (
              <>
                {hasUrl && onOpenUrl ? (
                  <Text style={lineStyle} selectable>
                    {segments.map((seg, j) =>
                      seg.type === "text" ? (
                        <Text key={j}>{seg.value}</Text>
                      ) : (
                        <Text
                          key={j}
                          style={styles.link}
                          onPress={() => onOpenUrl(seg.value)}
                        >
                          {seg.value}
                        </Text>
                      )
                    )}
                  </Text>
                ) : (
                  <Text style={lineStyle} selectable>
                    {plain}
                  </Text>
                )}
              </>
            );
            if (isCommandLine) {
              return (
                <Animated.View
                  key={i}
                  style={[styles.executingRow, { opacity: pulseAnim }]}
                >
                  <ActivityIndicator size="small" color={theme.accent} style={styles.executingSpinner} />
                  <View style={{ flex: 1 }}>{lineContent}</View>
                </Animated.View>
              );
            }
            return <View key={i}>{lineContent}</View>;
          })}
        </ScrollView>
      )}
      {/* Command is shown inside the output as the first line; do not show a separate bar at the bottom */}
    </View>
  );
}

