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

export const layoutGlassHeaderStyleDark = {
  backgroundColor: "rgba(15, 23, 42, 0.6)",
  borderBottomWidth: 1.5,
  borderBottomColor: "rgba(34, 197, 94, 0.4)", // Cyberpunk CTA Neon
};

export const layoutGlassHeaderStyleLight = {
  backgroundColor: "rgba(255, 255, 255, 0.6)",
  borderBottomWidth: 1.5,
  borderBottomColor: "rgba(203, 213, 225, 0.5)", // Slate 300
};
