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
import { buildTypographyScale } from "./typography";

// ============================================================================
// Brand Theme Definitions
// ============================================================================

export const claudeTheme = {
  accent: "#D97706", // More vibrant amber/orange
  accentSoft: "#FFF7ED",
  accentMuted: "#FFEDD5",
  accentOnDark: "#FBBF24",
} as const;

export const geminiTheme = {
  accent: "#2563EB", // Modern blue
  accentSoft: "#EFF6FF",
  accentMuted: "#DBEAFE",
  accentOnDark: "#60A5FA",
} as const;

export const codexTheme = {
  accent: "#000000", // Black/white design: black accent in light mode
  accentSoft: "#F3F4F6",
  accentMuted: "#E5E7EB",
  accentOnDark: "#FFFFFF", // White accent in dark mode
} as const;

export const piTheme = {
  accent: "#7C3AED", // Premium violet/purple
  accentSoft: "#F5F3FF",
  accentMuted: "#EDE9FE",
  accentOnDark: "#A78BFA",
} as const;

export const themes = { claude: claudeTheme, gemini: geminiTheme, codex: codexTheme, pi: piTheme } as const;
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
} from "./typography";
export { buildTypographyScale } from "./typography";

// Alias for backward compatibility
export type TypographyScale = import("./typography").TypographyScaleRecord;

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

const isCodexDesign = (p: Provider) => p === "codex" || p === "pi";

function getNeutrals(mode: ColorMode, provider: Provider) {
  // Codex design: black background + white text (dark) or white background + black text (light)
  if (isCodexDesign(provider)) {
    if (mode === "dark") {
      return {
        background: "#000000",
        surface: "#0A0A0A",
        surfaceAlt: "#141414",
        surfaceMuted: "#1F1F1F",
        border: "#2A2A2A",
        textPrimary: "#FFFFFF",
        textSecondary: "#E5E5E5",
        textMuted: "#A3A3A3",
        textInverse: "#000000",
        overlay: "rgba(0,0,0,0.7)",
        shadow: "rgba(0,0,0,0.6)",
        skeleton: "#141414",
        skeletonHighlight: "#1F1F1F",
      };
    }
    return {
      background: "#FFFFFF",
      surface: "#FFFFFF",
      surfaceAlt: "#FAFAFA",
      surfaceMuted: "#F5F5F5",
      border: "#E5E5E5",
      textPrimary: "#000000",
      textSecondary: "#404040",
      textMuted: "#737373",
      textInverse: "#FFFFFF",
      overlay: "rgba(0,0,0,0.4)",
      shadow: "rgba(0,0,0,0.08)",
      skeleton: "#F5F5F5",
      skeletonHighlight: "#FAFAFA",
    };
  }
  if (mode === "dark") {
    return {
      background: "#0A0B10", // Deeper black
      surface: "#12141C",
      surfaceAlt: "#1B1E29",
      surfaceMuted: "#252936",
      border: "#2E3345",
      textPrimary: "#F8FAFC",
      textSecondary: "#CBD5E1",
      textMuted: "#64748B",
      textInverse: "#0A0B10",
      overlay: "rgba(0,0,0,0.7)",
      shadow: "rgba(0,0,0,0.6)",
      skeleton: "#1B1E29",
      skeletonHighlight: "#252936",
    };
  }
  return {
    background: "#F8FAFC", // Slate-50 for a cleaner look
    surface: "#FFFFFF",
    surfaceAlt: "#F1F5F9",
    surfaceMuted: "#E2E8F0",
    border: "#E2E8F0",
    textPrimary: "#0F172A", // Slate-900
    textSecondary: "#475569", // Slate-600
    textMuted: "#94A3B8", // Slate-400
    textInverse: "#FFFFFF",
    overlay: "rgba(15, 23, 42, 0.4)",
    shadow: "rgba(15, 23, 42, 0.08)",
    skeleton: "#E2E8F0",
    skeletonHighlight: "#F1F5F9",
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
