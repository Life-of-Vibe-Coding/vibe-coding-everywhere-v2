/**
 * Shared Typography System
 *
 * Single source of truth for typography variants and styles.
 * - Both theme/index.tsx and design-system/theme.tsx implement this interface
 * - No screen-width shrinkage (accessibility: respect OS Dynamic Type / font scaling)
 * - Optional gentle upscale on large screens only
 * - Consolidated font weights: 400, 600, 700 (500 mapped to 600 for bundle size)
 */

import { Dimensions, Platform } from "react-native";

export type TypographyVariant =
  | "display"
  | "title1"
  | "title2"
  | "title3"
  | "headline"
  | "body"
  | "bodyStrong"
  | "callout"
  | "subhead"
  | "footnote"
  | "caption"
  | "caption2"
  | "label"
  | "mono";

export interface TypographyStyle {
  fontSize: number;
  lineHeight: number;
  fontWeight: "400" | "600" | "700";
  letterSpacing: number;
  fontFamily?: string;
}

export type TypographyScaleRecord = Record<TypographyVariant, TypographyStyle>;

/** Platform-specific monospace font */
export const monoFontFamily = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

/**
 * Base typography tokens (base sizes, no responsive scaling).
 * Rely on allowFontScaling={true} (default) for accessibility.
 */
export const typographyBaseTokens: Record<
  TypographyVariant,
  Omit<TypographyStyle, "fontFamily">
> = {
  display: { fontSize: 34, lineHeight: 42, fontWeight: "700", letterSpacing: -0.5 },
  title1: { fontSize: 28, lineHeight: 36, fontWeight: "700", letterSpacing: -0.3 },
  title2: { fontSize: 22, lineHeight: 30, fontWeight: "600", letterSpacing: -0.2 },
  title3: { fontSize: 20, lineHeight: 28, fontWeight: "600", letterSpacing: -0.1 },
  headline: { fontSize: 18, lineHeight: 26, fontWeight: "600", letterSpacing: 0 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400", letterSpacing: 0 },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: "600", letterSpacing: 0 },
  callout: { fontSize: 15, lineHeight: 22, fontWeight: "600", letterSpacing: 0 },
  subhead: { fontSize: 14, lineHeight: 20, fontWeight: "400", letterSpacing: 0.1 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: "400", letterSpacing: 0.1 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 0.2 },
  caption2: { fontSize: 11, lineHeight: 14, fontWeight: "600", letterSpacing: 0.3 },
  label: { fontSize: 11, lineHeight: 14, fontWeight: "600", letterSpacing: 0.6 },
  mono: { fontSize: 13, lineHeight: 18, fontWeight: "600", letterSpacing: 0 },
};

/**
 * Builds typography scale.
 * - No shrink on small screens (accessibility)
 * - Optional 1.05x upscale on screens >= 414px for better readability on tablets
 */
export function buildTypographyScale(): TypographyScaleRecord {
  const { width: screenWidth } = Dimensions.get("window");
  const isLargeScreen = screenWidth >= 414;
  const scale = isLargeScreen ? 1.05 : 1;

  const result = {} as TypographyScaleRecord;

  for (const [key, style] of Object.entries(typographyBaseTokens) as [
    TypographyVariant,
    Omit<TypographyStyle, "fontFamily">,
  ][]) {
    result[key] = {
      ...style,
      fontSize: Math.round(style.fontSize * scale),
      lineHeight: Math.round(style.lineHeight * scale),
      ...(key === "mono" ? { fontFamily: monoFontFamily } : {}),
    };
  }

  return result;
}
