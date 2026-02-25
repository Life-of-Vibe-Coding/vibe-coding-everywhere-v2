/**
 * Theme System - Unified Theme Management
 * 
 * This module provides a comprehensive theming solution for the mobile app.
 * 
 * Features:
 * - Light/Dark mode support with system preference detection
 * - Multiple brand providers (Gemini, Claude, Codex)
 * - WCAG 2.1 AA compliant color contrast
 * - Responsive typography scale
 * - 8px grid spacing system
 * - Smooth animation timing
 */

import React, { createContext, useContext, useMemo, useCallback } from "react";
import { useColorScheme, Platform, Dimensions, PixelRatio } from "react-native";
import { buildTypographyScale } from "@/theme/typography";

// ============================================================================
// Brand Theme Definitions
// ============================================================================

export const universalGlassTheme = {
  accent: "#8B75FF", // Futuristic purple-blue accent
  accentSoft: "rgba(139, 117, 255, 0.15)",
  accentMuted: "rgba(139, 117, 255, 0.25)",
  accentOnDark: "#A594FF",
} as const;

export const claudeTheme = universalGlassTheme;
export const geminiTheme = universalGlassTheme;
export const codexTheme = universalGlassTheme;

export const themes = { claude: claudeTheme, gemini: geminiTheme, codex: codexTheme } as const;
export type Provider = keyof typeof themes;
export type ColorMode = "light" | "dark";
export type ColorModePreference = "system" | ColorMode;

type Brand = (typeof themes)[Provider];

// ============================================================================
// Typography System (shared types + unified scale)
// ============================================================================

export type {
  TypographyVariant,
  TypographyStyle,
  TypographyScaleRecord,
} from "@/theme/typography";
export { buildTypographyScale } from "@/theme/typography";

export type TypographyScale = import("@/theme/typography").TypographyScaleRecord;

// Lazy init to avoid "runtime not ready" (Dimensions at module load on Hermes)
let _typography: TypographyScale | null = null;

function getTypography(): TypographyScale {
  if (_typography) return _typography;
  _typography = buildTypographyScale();
  return _typography;
}

// ============================================================================
// Design System Theme Types
// ============================================================================

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
  typography: TypographyScale;
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
    xxxl: number;
  };
  radii: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    pill: number;
  };
  motion: {
    fast: number;
    normal: number;
    slow: number;
    spring: {
      damping: number;
      stiffness: number;
      mass: number;
    };
  };
  grid: number;
};

// ============================================================================
// Color System - WCAG 2.1 AA Compliant
// ============================================================================

function normalizeHex(input: string): string {
  if (!input.startsWith("#")) return input;
  if (input.length === 4) {
    const r = input[1] ?? "0";
    const g = input[2] ?? "0";
    const b = input[3] ?? "0";
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return input;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHex(hex);
  const raw = normalized.replace("#", "");
  if (raw.length !== 6) return { r: 0, g: 0, b: 0 };
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return { r, g, b };
}

function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ============================================================================
// Theme Building
// ============================================================================

const spacing = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 40,
  xxl: 48,
  xxxl: 64,
};

const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

const motion = {
  fast: 140,
  normal: 220,
  slow: 360,
  spring: {
    damping: 18,
    stiffness: 240,
    mass: 0.8,
  },
};

const isCodexDesign = (p: Provider) => false;

function getNeutrals(mode: ColorMode, provider: Provider) {
  if (mode === "dark") {
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
  return {
    background: "transparent",
    surface: "rgba(255, 255, 255, 0.6)",
    surfaceAlt: "rgba(255, 255, 255, 0.4)",
    surfaceMuted: "rgba(255, 255, 255, 0.2)",
    border: "rgba(0, 0, 0, 0.1)",
    textPrimary: "#000000",
    textSecondary: "#404040",
    textMuted: "#737373",
    textInverse: "#FFFFFF",
    overlay: "rgba(0,0,0,0.4)",
    shadow: "rgba(0,0,0,0.08)",
    skeleton: "rgba(255, 255, 255, 0.5)",
    skeletonHighlight: "rgba(255, 255, 255, 0.8)",
  };
}

function buildTheme(provider: Provider, mode: ColorMode): DesignTheme {
  const brand: Brand = themes[provider];
  const neutral = getNeutrals(mode, provider);
  const accent = mode === "dark" ? brand.accentOnDark : brand.accent;
  const accentSoft = mode === "dark" ? withAlpha(brand.accentOnDark, 0.18) : brand.accentSoft;
  const accentSubtle = withAlpha(accent, mode === "dark" ? 0.2 : 0.14);
  const pageAccentTint = withAlpha(accent, mode === "dark" ? 0.06 : 0.05);
  const success = mode === "dark" ? "#22c55e" : "#16a34a";
  const danger = mode === "dark" ? "#f87171" : "#dc2626";
  const warning = mode === "dark" ? "#fbbf24" : "#d97706";
  const info = mode === "dark" ? "#60a5fa" : "#2563eb";

  const colors = {
    ...neutral,
    pageAccentTint,
    accent,
    accentSoft,
    accentSubtle,
    success,
    danger,
    warning,
    info,
  };

  return {
    provider,
    mode,
    colors,
    typography: getTypography(),
    spacing,
    radii,
    motion,
    grid: 8,
  };
}

export function getTheme(provider: Provider, mode: ColorMode = "light"): DesignTheme {
  return buildTheme(provider, mode);
}

// ============================================================================
// Theme Context
// ============================================================================

type ThemeContextValue = {
  provider: Provider;
  colorMode: ColorModePreference;
  setProvider?: (p: Provider) => void;
  setColorMode?: (m: ColorModePreference) => void;
};

const defaultContextValue: ThemeContextValue = {
  provider: "codex",
  colorMode: "system"
};

export const ThemeContext = React.createContext<ThemeContextValue>(defaultContextValue);

export interface ThemeProviderProps {
  provider?: Provider;
  colorMode?: ColorModePreference;
  onProviderChange?: (provider: Provider) => void;
  onColorModeChange?: (mode: ColorModePreference) => void;
  children: React.ReactNode;
}

export function ThemeProvider({
  provider = "codex",
  colorMode = "system",
  onProviderChange,
  onColorModeChange,
  children,
}: ThemeProviderProps) {
  const setProvider = useCallback(
    (p: Provider) => onProviderChange?.(p),
    [onProviderChange]
  );

  const setColorMode = useCallback(
    (m: ColorModePreference) => onColorModeChange?.(m),
    [onColorModeChange]
  );

  const value = useMemo(
    () => ({
      provider,
      colorMode,
      setProvider,
      setColorMode,
    }),
    [provider, colorMode, setProvider, setColorMode]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ============================================================================
// Theme Hooks
// ============================================================================

export function useColorMode(): ColorMode {
  const system = useColorScheme();
  const ctx = React.useContext(ThemeContext);

  if (ctx?.colorMode && ctx.colorMode !== "system") {
    return ctx.colorMode;
  }

  return system === "dark" ? "dark" : "light";
}

export function useTheme(): DesignTheme {
  const ctx = React.useContext(ThemeContext);
  const mode = useColorMode();
  const provider = ctx?.provider ?? "codex";

  return useMemo(() => buildTheme(provider, mode), [provider, mode]);
}

// ============================================================================
// Responsive Utilities
// ============================================================================

export function useResponsive() {
  const { width, height, scale, fontScale } = Dimensions.get("window");

  return useMemo(() => ({
    width,
    height,
    scale,
    fontScale,
    isSmallScreen: width < 375,
    isMediumScreen: width >= 375 && width < 414,
    isLargeScreen: width >= 414,
    isLandscape: width > height,
    pixelDensity: PixelRatio.get(),
    screenWidth: width,
    screenHeight: height,
  }), [width, height, scale, fontScale]);
}

// ============================================================================
// Export Design System Integration
// ============================================================================

export { spacing, radii, motion, getTypography };
