/**
 * Theme System - Unified Theme Management
 * 
 * This module provides a comprehensive theming solution that bridges
 * the legacy theme system with the modern design system.
 * 
 * Features:
 * - Light/Dark mode support with system preference detection
 * - Multiple brand providers (Gemini, Claude)
 * - WCAG 2.1 AA compliant color contrast
 * - Responsive typography scale
 * - 8px grid spacing system
 * - Smooth animation timing
 */

import React, { createContext, useContext, useMemo, useCallback } from "react";
import { useColorScheme, Platform, Dimensions, PixelRatio } from "react-native";

// ============================================================================
// Brand Theme Definitions
// ============================================================================

export const claudeTheme = {
  accent: "#b3541e",
  accentSoft: "#f6ddc8",
  accentMuted: "#f0d4bf",
  accentOnDark: "#f2b07f",
} as const;

export const geminiTheme = {
  accent: "#1a73e8",
  accentSoft: "#e8f0fe",
  accentMuted: "#d2e3fc",
  accentOnDark: "#8ab4f8",
} as const;

export const codexTheme = {
  accent: "#19c37d",
  accentSoft: "#d1fae5",
  accentMuted: "#a7f3d0",
  accentOnDark: "#6ee7b7",
} as const;

export const piTheme = {
  accent: "#19c37d",
  accentSoft: "#d1fae5",
  accentMuted: "#a7f3d0",
  accentOnDark: "#6ee7b7",
} as const;

export const themes = { claude: claudeTheme, gemini: geminiTheme, codex: codexTheme, pi: piTheme } as const;
export type Provider = keyof typeof themes;
export type ColorMode = "light" | "dark";
export type ColorModePreference = "system" | ColorMode;

type Brand = (typeof themes)[Provider];

// ============================================================================
// Typography System
// ============================================================================

export type TypographyScale = {
  display: { fontSize: number; lineHeight: number; fontWeight: "700"; letterSpacing: number };
  title1: { fontSize: number; lineHeight: number; fontWeight: "700"; letterSpacing: number };
  title2: { fontSize: number; lineHeight: number; fontWeight: "600"; letterSpacing: number };
  title3: { fontSize: number; lineHeight: number; fontWeight: "600"; letterSpacing: number };
  body: { fontSize: number; lineHeight: number; fontWeight: "400"; letterSpacing: number };
  bodyStrong: { fontSize: number; lineHeight: number; fontWeight: "600"; letterSpacing: number };
  callout: { fontSize: number; lineHeight: number; fontWeight: "500"; letterSpacing: number };
  caption: { fontSize: number; lineHeight: number; fontWeight: "500"; letterSpacing: number };
  label: { fontSize: number; lineHeight: number; fontWeight: "600"; letterSpacing: number };
  mono: { fontSize: number; lineHeight: number; fontWeight: "500"; letterSpacing: number };
};

// Lazy init to avoid "runtime not ready" (Dimensions at module load on Hermes)
let _typography: TypographyScale | null = null;

function getTypography(): TypographyScale {
  if (_typography) return _typography;
  const { width: screenWidth } = Dimensions.get("window");
  const isSmallScreen = screenWidth < 375;
  const isLargeScreen = screenWidth >= 414;
  const responsiveSize = (base: number): number => {
    if (isSmallScreen) return Math.round(base * 0.9);
    if (isLargeScreen) return Math.round(base * 1.05);
    return base;
  };
  _typography = {
    display: { fontSize: responsiveSize(32), lineHeight: responsiveSize(40), fontWeight: "700", letterSpacing: -0.4 },
    title1: { fontSize: responsiveSize(24), lineHeight: responsiveSize(32), fontWeight: "700", letterSpacing: -0.2 },
    title2: { fontSize: responsiveSize(20), lineHeight: responsiveSize(28), fontWeight: "600", letterSpacing: -0.1 },
    title3: { fontSize: responsiveSize(18), lineHeight: responsiveSize(26), fontWeight: "600", letterSpacing: 0 },
    body: { fontSize: responsiveSize(16), lineHeight: responsiveSize(24), fontWeight: "400", letterSpacing: 0 },
    bodyStrong: { fontSize: responsiveSize(16), lineHeight: responsiveSize(24), fontWeight: "600", letterSpacing: 0 },
    callout: { fontSize: responsiveSize(14), lineHeight: responsiveSize(20), fontWeight: "500", letterSpacing: 0 },
    caption: { fontSize: responsiveSize(12), lineHeight: responsiveSize(16), fontWeight: "500", letterSpacing: 0.2 },
    label: { fontSize: responsiveSize(11), lineHeight: responsiveSize(14), fontWeight: "600", letterSpacing: 0.6 },
    mono: { fontSize: responsiveSize(13), lineHeight: responsiveSize(18), fontWeight: "500", letterSpacing: 0 },
  };
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
  // Legacy theme properties for backward compatibility
  beigeBg: string;
  cardBg: string;
  surfaceBg: string;
  borderColor: string;
  textPrimary: string;
  textMuted: string;
  assistantBg: string;
  userBg: string;
  accent: string;
  accentLight: string;
  success: string;
  danger: string;
  shadow: string;
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

function getNeutrals(mode: ColorMode, provider: Provider) {
  if (mode === "dark") {
    return {
      background: "#0d0f14",
      surface: "#151821",
      surfaceAlt: "#1d202a",
      surfaceMuted: "#262b36",
      border: "#2e3340",
      textPrimary: "#f5f7fb",
      textSecondary: "#d1d7e3",
      textMuted: "#9aa3b2",
      textInverse: "#0d0f14",
      overlay: "rgba(0,0,0,0.55)",
      shadow: "rgba(0,0,0,0.5)",
      skeleton: "#1e222d",
      skeletonHighlight: "#2a3140",
    };
  }
  return {
    background: provider === "gemini" || provider === "codex" || provider === "pi" ? "#ffffff" : "#f8f7f5",
    surface: "#ffffff",
    surfaceAlt: "#f1f2f6",
    surfaceMuted: "#e7e9ef",
    border: "#e2e4ea",
    textPrimary: "#12131a",
    textSecondary: "#3e4250",
    textMuted: "#6b7280",
    textInverse: "#ffffff",
    overlay: "rgba(10,12,18,0.4)",
    shadow: "rgba(16,24,40,0.12)",
    skeleton: "#e6e8ee",
    skeletonHighlight: "#f5f6f9",
  };
}

function buildTheme(provider: Provider, mode: ColorMode): DesignTheme {
  const brand: Brand = themes[provider];
  const neutral = getNeutrals(mode, provider);
  const accent = mode === "dark" ? brand.accentOnDark : brand.accent;
  const accentSoft = mode === "dark" ? withAlpha(brand.accentOnDark, 0.18) : brand.accentSoft;
  const accentSubtle = withAlpha(accent, mode === "dark" ? 0.2 : 0.14);
  const success = mode === "dark" ? "#22c55e" : "#16a34a";
  const danger = mode === "dark" ? "#f87171" : "#dc2626";
  const warning = mode === "dark" ? "#fbbf24" : "#d97706";
  const info = mode === "dark" ? "#60a5fa" : "#2563eb";
  
  const colors = {
    ...neutral,
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
    // Legacy properties
    beigeBg: colors.background,
    cardBg: colors.surface,
    surfaceBg: colors.surfaceAlt,
    borderColor: colors.border,
    textPrimary: colors.textPrimary,
    textMuted: colors.textSecondary,
    assistantBg: colors.surfaceAlt,
    userBg: colors.surface,
    accent: colors.accent,
    accentLight: colors.accentSoft,
    success: colors.success,
    danger: colors.danger,
    shadow: colors.shadow,
  };
}

export function getTheme(provider: Provider, mode: ColorMode = "light"): DesignTheme {
  return buildTheme(provider, mode);
}

// Default theme - lazy to avoid Dimensions at module load (runtime not ready on Hermes)
let _defaultTheme: DesignTheme | null = null;
export function getDefaultTheme(): DesignTheme {
  return _defaultTheme ?? (_defaultTheme = getTheme("pi", "light"));
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
  provider: "pi", 
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
  provider = "pi",
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

export function useProvider(): Provider {
  try {
    const ctx = React.useContext(ThemeContext);
    if (ctx != null && typeof ctx === "object" && "provider" in ctx) {
      const p = (ctx as { provider: Provider }).provider;
      if (p === "claude" || p === "gemini" || p === "codex" || p === "pi") return p;
    }
  } catch (_) {
    // Fall through to default
  }
  return "pi";
}

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
  const provider = ctx?.provider ?? "pi";
  
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
