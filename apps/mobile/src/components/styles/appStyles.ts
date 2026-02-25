import { StyleSheet } from "react-native";
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
  });
}
