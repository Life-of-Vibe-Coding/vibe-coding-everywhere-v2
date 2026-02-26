import { StyleSheet } from "react-native";
import type { getTheme } from "@/theme/index";

export function createAppStyles(theme: ReturnType<typeof getTheme>) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
  });
}

export const layoutOuterStyle = {
  backgroundColor: "transparent", // Allow global background
};

/**
 * Shared horizontal padding (in px) applied by the ChatPageShell container.
 * Referenced by child components (e.g. FileViewerPage, AppHeaderBar) to
 * counteract it for edge-to-edge layouts, avoiding hardcoded magic numbers.
 */
export const SHELL_HORIZONTAL_PADDING = 24;

export const layoutGlassHeaderStyleDark = {
  backgroundColor: "rgba(15, 23, 42, 0.6)",
  borderBottomWidth: 1.5,
  borderBottomColor: "rgba(34, 197, 94, 0.4)", // Cyberpunk CTA Neon
};

export const layoutGlassHeaderStyleLight = {
  backgroundColor: "#F9F3EA", // Solid cream canvas
  borderBottomWidth: 1.5,
  borderBottomColor: "#E2CDBA", // Deeper tan border
};
