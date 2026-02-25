import { StyleSheet, Platform } from "react-native";
import { spacing } from "../../design-system";
import type { getTheme } from "../../theme/index";

export function createAppStyles(theme: ReturnType<typeof getTheme>) {
  return StyleSheet.create({
    providerTintOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 58,
      backgroundColor: theme.colors.pageAccentTint,
    },
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    keyboardView: {
      flex: 1,
    },
    page: {
      flex: 1,
      flexDirection: "column",
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 16,
    },
    topSection: {
      flex: 1,
      minHeight: 0,
      position: "relative",
      overflow: Platform.OS === "ios" ? "visible" : "hidden",
    },
    contentArea: {
      flex: 1,
      minHeight: 0,
      overflow: Platform.OS === "ios" ? "visible" : "hidden",
    },
    sidebarOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 5,
    },
    fileViewerOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 6,
    },
    sessionIdCenter: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: spacing[1],
      minHeight: 40,
    },
    headerStatusStack: {
      maxWidth: "100%",
    },
    headerStatusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    runningDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    menuButtonOverlay: {
      position: "absolute",
      top: 8,
      left: 0,
      right: 0,
      height: 44,
      zIndex: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
    },
    chatShell: {
      flex: 1,
      marginTop: 58,
      minHeight: 0,
    },
    chatArea: {
      flex: 1,
    },
    inputBar: {
      flexShrink: 0,
      flexGrow: 0,
      paddingTop: 12,
      paddingBottom: 8,
    },
    chatMessages: {
      paddingVertical: 12,
      paddingHorizontal: spacing["4"],
      gap: 16,
      paddingBottom: 48,
    },
  });
}
