/**
 * Theme System - Cocoa Edition
 * 
 * Consistent design system with multi-provider state support.
 */

import React, { createContext, useContext, useMemo, useCallback } from "react";
import { Dimensions, PixelRatio } from "react-native";
import { buildTypographyScale, type TypographyScaleRecord } from "@/theme/typography";

export type Provider = "claude" | "gemini" | "codex" | "cocoa";
export type ColorMode = "dark";
export type ColorModePreference = ColorMode;

export const universalGlassTheme = {
  accent: "#8B75FF",
  accentSoft: "rgba(139, 117, 255, 0.15)",
  accentMuted: "rgba(139, 117, 255, 0.25)",
  accentOnDark: "#A594FF",
} as const;

export type DesignTheme = {
  provider: Provider;
  mode: ColorMode;

  colors: {
    background: string;
    surface: string;
    surfaceAlt: string;
    surfaceMuted: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    textInverse: string;
    accent: string;
    accentSoft: string;
    accentSubtle: string;
    success: string;
    danger: string;
    warning: string;
    info: string;
    overlay: string;
    shadow: string;
    skeleton: string;
    skeletonHighlight: string;
  };
  typography: TypographyScaleRecord;
  spacing: any;
  radii: any;
  motion: any;
  grid: number;
};

const spacing = { xs: 8, sm: 16, md: 24, lg: 32, xl: 40, xxl: 48, xxxl: 64 };
const radii = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };
const motion = { fast: 140, normal: 220, slow: 360, spring: { damping: 18, stiffness: 240, mass: 0.8 } };

function getNeutrals(_mode: ColorMode = "dark") {
  return {
    background: "transparent",
    surface: "rgba(10, 15, 30, 0.6)",
    surfaceAlt: "rgba(15, 20, 40, 0.6)",
    surfaceMuted: "rgba(20, 25, 45, 0.6)",
    border: "rgba(0, 229, 255, 0.25)",
    textPrimary: "#FFFFFF",
    textSecondary: "#A5F5F5",
    textMuted: "rgba(0, 229, 255, 0.5)",
    textInverse: "#000000",
    overlay: "rgba(0, 0, 10, 0.7)",
    shadow: "rgba(0, 229, 255, 0.3)",
    skeleton: "rgba(0, 229, 255, 0.1)",
    skeletonHighlight: "rgba(0, 229, 255, 0.3)",
  };
}

function buildTheme(provider: Provider = "codex", mode: ColorMode = "dark"): DesignTheme {
  const brand = universalGlassTheme;
  const neutral = getNeutrals(mode);
  const accent = provider === "cocoa" ? "#D2B48C" : brand.accentOnDark;

  return {
    provider,
    mode,
    colors: {
      ...neutral,
      accent,
      accentSoft: "rgba(139, 117, 255, 0.18)",
      accentSubtle: "rgba(139, 117, 255, 0.2)",
      success: "#22c55e",
      danger: "#f87171",
      warning: "#fbbf24",
      info: "#60a5fa",
    } as any,
    typography: buildTypographyScale(),
    spacing,
    radii,
    motion,
    grid: 8,
  };
}

export function getTheme(): DesignTheme {
  return buildTheme();
}


type ThemeContextValue = {
  colorMode: ColorModePreference;
};

const ThemeContext = createContext<ThemeContextValue>({ colorMode: "dark" });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => ({ colorMode: "dark" as const }), []);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): DesignTheme {
  const ctx = useContext(ThemeContext);
  return useMemo(() => buildTheme(), []);
}

export function useColorMode(): ColorMode {
  const ctx = useContext(ThemeContext);
  return ctx.colorMode;
}

export function useResponsive() {
  const { width, height } = Dimensions.get("window");
  return useMemo(() => ({ width, height, isSmallScreen: width < 375 }), [width, height]);
}

export { spacing, radii, motion };
export function getTypography() { return buildTypographyScale(); }
