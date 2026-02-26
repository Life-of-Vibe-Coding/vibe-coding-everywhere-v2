import { useTheme } from '@/theme';
import { useMemo } from 'react';

// Pre-require assets to ensure they exist at bundle time
const lightAssets = {
  background: require("../../assets/theme/light/background.png"),
  leftHeaderIcon: require("../../assets/theme/light/left_header_icon.png"),
  rightHeaderIcon: require("../../assets/theme/light/right_header_icon.svg"),
};

const darkAssets = {
  background: require("../../assets/theme/dark/background.png"),
  leftHeaderIcon: require("../../assets/theme/dark/left_header_icon.png"),
  rightHeaderIcon: require("../../assets/theme/dark/right_header_icon.svg"),
};

export type ThemeAssets = {
  background: number;
  leftHeaderIcon: number;
  rightHeaderIcon: number;
};

export function useThemeAssets(): ThemeAssets {
  const theme = useTheme();
  const isLight = theme.mode === "light";

  return useMemo(() => (isLight ? lightAssets : darkAssets), [isLight]);
}
