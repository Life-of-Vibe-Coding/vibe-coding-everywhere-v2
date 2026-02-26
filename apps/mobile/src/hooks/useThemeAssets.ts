import { useTheme } from '@/theme';

export function useThemeAssets() {
  const theme = useTheme();
  const isLight = theme.mode === "light";

  return {
    background: isLight 
      ? require("../../assets/theme/light/background.png") 
      : require("../../assets/theme/dark/background.png"),
    leftHeaderIcon: isLight 
      ? require("../../assets/theme/light/left_header_icon.png") 
      : require("../../assets/theme/dark/left_header_icon.png"),
    rightHeaderIcon: isLight 
      ? require("../../assets/theme/light/right_header_icon.svg") 
      : require("../../assets/theme/dark/right_header_icon.svg"),
  };
}
