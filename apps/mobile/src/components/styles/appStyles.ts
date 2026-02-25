import { StyleSheet, Platform } from "react-native";
import { spacing } from "@/design-system";
import type { getTheme } from "@/theme/index";

export function createAppStyles(theme: ReturnType<typeof getTheme>) {
  return StyleSheet.create({
    providerTintOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 58,
      backgroundColor: theme.colors.accentSoft,
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
      paddingBottom: 0,
      marginBottom: 0,
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
      height: "100%",
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
      marginHorizontal: spacing[1],
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
      marginTop: 0,
    },
    chatArea: {
      flex: 1,
      minHeight: 0,
    },
    chatMessages: {
      marginTop: 58,
      paddingHorizontal: spacing["3"],
    },
    inputBar: {
      paddingBottom: 8,
    },
  });
}
