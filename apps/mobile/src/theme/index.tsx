/**
 * Theme System - Cocoa Edition
 * 
 * Consistent design system with multi-provider state support.
 */

import React, { createContext, useContext, useMemo, useCallback } from "react";
import { Dimensions, PixelRatio, useColorScheme } from "react-native";
import { buildTypographyScale, type TypographyScaleRecord } from "@/theme/typography";

export type Provider = "claude" | "gemini" | "codex" | "cocoa";
export type ColorMode = "dark" | "light";
export type ColorModePreference = ColorMode | "system";

export const darkUniversalGlassTheme = {
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
    cocoaCream?: string;
    cocoaTan?: string;
    cocoaBrown?: string;
    cocoaDark?: string;
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

function getNeutrals(mode: ColorMode = "light") {
  if (mode === "light") {
    return {
      background: "#F9F3EA", // Soft cream from the image background
      surface: "#F1E5D1", // Light tan for surfaces/cards
      surfaceAlt: "#E8D8C2", // Mid tan
      surfaceMuted: "#E2CDBA", // Deeper tan for secondary backgrounds
      border: "#D1BCA3", // Subdued tan border
      textPrimary: "#4A2E1B", // Deep chocolate brown
      textSecondary: "#87664B",
      textMuted: "#A38268", // Solid medium warm brown
      textInverse: "#F9F3EA",
      overlay: "rgba(74, 46, 27, 0.4)",
      shadow: "rgba(74, 46, 27, 0.1)",
      skeleton: "#E2CDBA",
      skeletonHighlight: "#F1E5D1",
      cocoaCream: "#F9F3EA",
      cocoaTan: "#F1E5D1",
      cocoaBrown: "#87664B",
      cocoaDark: "#4A2E1B",
    };
  }

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
    // Dark mode cocoa colors (for consistency with light mode)
    cocoaCream: "#1a1a2e",
    cocoaTan: "#16213e",
    cocoaBrown: "#A5F5F5",
    cocoaDark: "#FFFFFF",
  };
}

export function buildTheme(provider: Provider = "codex", mode: ColorMode = "light"): DesignTheme {
  const brand = darkUniversalGlassTheme;
  const neutral = getNeutrals(mode);
  const isLight = mode === "light";
  const defaultAccent = isLight ? "#87664B" : brand.accentOnDark;
  const accent = provider === "cocoa" ? "#D2B48C" : defaultAccent;

  return {
    provider,
    mode,
    colors: {
      ...neutral,
      accent,
      accentSoft: isLight ? "rgba(135, 102, 75, 0.18)" : "rgba(139, 117, 255, 0.18)",
      accentSubtle: isLight ? "rgba(135, 102, 75, 0.2)" : "rgba(139, 117, 255, 0.2)",
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
  activeMode: ColorMode;
  activeProvider: Provider;
};

const ThemeContext = createContext<ThemeContextValue>({ activeMode: "light", activeProvider: "codex" });

export function ThemeProvider({ children, mode, provider = "codex" }: { children: React.ReactNode, mode?: ColorMode, provider?: Provider }) {
  const systemColorScheme = useColorScheme();

  const activeMode = useMemo(() => {
    if (mode) return mode;
    return (systemColorScheme === "dark" ? "dark" : "light") as ColorMode;
  }, [systemColorScheme, mode]);

  const value = useMemo(() => ({ activeMode, activeProvider: provider }), [activeMode, provider]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): DesignTheme {
  const ctx = useContext(ThemeContext);
  return useMemo(() => buildTheme(ctx.activeProvider, ctx.activeMode), [ctx.activeProvider, ctx.activeMode]);
}

export function useColorMode(): ColorMode {
  const ctx = useContext(ThemeContext);
  return ctx.activeMode;
}

export function useResponsive() {
  const { width, height } = Dimensions.get("window");
  return useMemo(() => ({ width, height, isSmallScreen: width < 375 }), [width, height]);
}

export { spacing, radii, motion };
export function getTypography() { return buildTypographyScale(); }
