/**
 * Modern Design System Theme Configuration
 * 
 * Comprehensive theming system supporting:
 * - Light/Dark mode with system preference detection
 * - WCAG 2.1 AA accessibility compliance
 * - Dynamic color theming with brand color support
 * - 8px grid system for consistent spacing
 * - Fluid motion/animation timing
 */

import { useColorScheme, Platform, Dimensions, PixelRatio } from "react-native";
import React, { createContext, useContext, useMemo, useCallback } from "react";

// ============================================================================
// Color System - WCAG 2.1 AA Compliant
// ============================================================================

/** 
 * Color contrast ratios for WCAG 2.1 AA compliance
 * Normal text: 4.5:1 minimum
 * Large text (18pt+ or 14pt+ bold): 3:1 minimum
 */
export const contrastRatios = {
  normal: 4.5,
  large: 3.0,
  enhanced: 7.0, // AAA level for critical text
} as const;

/** Calculate relative luminance for contrast ratio calculation */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** Calculate contrast ratio between two colors */
export function getContrastRatio(color1: string, color2: string): number {
  const hex1 = color1.replace("#", "");
  const hex2 = color2.replace("#", "");
  const rgb1 = {
    r: parseInt(hex1.slice(0, 2), 16),
    g: parseInt(hex1.slice(2, 4), 16),
    b: parseInt(hex1.slice(4, 6), 16),
  };
  const rgb2 = {
    r: parseInt(hex2.slice(0, 2), 16),
    g: parseInt(hex2.slice(2, 4), 16),
    b: parseInt(hex2.slice(4, 6), 16),
  };
  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// ============================================================================
// Base Color Palettes
// ============================================================================

const neutralColors = {
  white: "#ffffff",
  gray50: "#f8f7f5",
  gray100: "#f1f2f6",
  gray200: "#e7e9ef",
  gray300: "#e2e4ea",
  gray400: "#c5c9d2",
  gray500: "#9aa3b2",
  gray600: "#6b7280",
  gray700: "#4b5563",
  gray800: "#3e4250",
  gray900: "#12131a",
  black: "#0d0f14",
} as const;

const semanticColors = {
  success: { light: "#16a34a", dark: "#22c55e" },
  danger: { light: "#dc2626", dark: "#f87171" },
  warning: { light: "#d97706", dark: "#fbbf24" },
  info: { light: "#2563eb", dark: "#60a5fa" },
} as const;

// Brand color configurations
export const brandColors = {
  gemini: {
    light: {
      accent: "#1a73e8",
      accentSoft: "#e8f0fe",
      accentMuted: "#d2e3fc",
      accentOnDark: "#8ab4f8",
    },
    dark: {
      accent: "#8ab4f8",
      accentSoft: "rgba(138, 180, 248, 0.18)",
      accentMuted: "rgba(138, 180, 248, 0.12)",
      accentOnDark: "#8ab4f8",
    },
  },
  claude: {
    light: {
      accent: "#b3541e",
      accentSoft: "#f6ddc8",
      accentMuted: "#f0d4bf",
      accentOnDark: "#f2b07f",
    },
    dark: {
      accent: "#f2b07f",
      accentSoft: "rgba(242, 176, 127, 0.18)",
      accentMuted: "rgba(242, 176, 127, 0.12)",
      accentOnDark: "#f2b07f",
    },
  },
} as const;

// ============================================================================
// Typography System
// ============================================================================

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
  fontWeight: "400" | "500" | "600" | "700" | "800";
  letterSpacing: number;
  fontFamily?: string;
}

// Dynamic font sizing - lazy init to avoid "runtime not ready" (Dimensions/Platform at module load)
export type TypographyScaleRecord = Record<TypographyVariant, TypographyStyle>;

let _typographyScale: TypographyScaleRecord | null = null;

function getTypographyScale(): TypographyScaleRecord {
  if (_typographyScale) return _typographyScale;
  const { width: screenWidth } = Dimensions.get("window");
  const isSmallScreen = screenWidth < 375;
  const isLargeScreen = screenWidth >= 414;
  const getResponsiveSize = (base: number): number => {
    if (isSmallScreen) return base * 0.9;
    if (isLargeScreen) return base * 1.05;
    return base;
  };
  _typographyScale = {
    display: {
      fontSize: getResponsiveSize(34),
      lineHeight: getResponsiveSize(42),
      fontWeight: "700",
      letterSpacing: -0.5,
    },
    title1: {
      fontSize: getResponsiveSize(28),
      lineHeight: getResponsiveSize(36),
      fontWeight: "700",
      letterSpacing: -0.3,
    },
    title2: {
      fontSize: getResponsiveSize(22),
      lineHeight: getResponsiveSize(30),
      fontWeight: "600",
      letterSpacing: -0.2,
    },
    title3: {
      fontSize: getResponsiveSize(20),
      lineHeight: getResponsiveSize(28),
      fontWeight: "600",
      letterSpacing: -0.1,
    },
    headline: {
      fontSize: getResponsiveSize(18),
      lineHeight: getResponsiveSize(26),
      fontWeight: "600",
      letterSpacing: 0,
    },
    body: {
      fontSize: getResponsiveSize(16),
      lineHeight: getResponsiveSize(24),
      fontWeight: "400",
      letterSpacing: 0,
    },
    bodyStrong: {
      fontSize: getResponsiveSize(16),
      lineHeight: getResponsiveSize(24),
      fontWeight: "600",
      letterSpacing: 0,
    },
    callout: {
      fontSize: getResponsiveSize(15),
      lineHeight: getResponsiveSize(22),
      fontWeight: "500",
      letterSpacing: 0,
    },
    subhead: {
      fontSize: getResponsiveSize(14),
      lineHeight: getResponsiveSize(20),
      fontWeight: "400",
      letterSpacing: 0.1,
    },
    footnote: {
      fontSize: getResponsiveSize(13),
      lineHeight: getResponsiveSize(18),
      fontWeight: "400",
      letterSpacing: 0.1,
    },
    caption: {
      fontSize: getResponsiveSize(12),
      lineHeight: getResponsiveSize(16),
      fontWeight: "500",
      letterSpacing: 0.2,
    },
    caption2: {
      fontSize: getResponsiveSize(11),
      lineHeight: getResponsiveSize(14),
      fontWeight: "500",
      letterSpacing: 0.3,
    },
    label: {
      fontSize: getResponsiveSize(11),
      lineHeight: getResponsiveSize(14),
      fontWeight: "600",
      letterSpacing: 0.6,
    },
    mono: {
      fontSize: getResponsiveSize(13),
      lineHeight: getResponsiveSize(18),
      fontWeight: "500",
      letterSpacing: 0,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
  };
  return _typographyScale;
}

// ============================================================================
// Spacing System (8px Grid)
// ============================================================================

export const spacing = {
  "0": 0,
  "0.5": 4,
  "1": 8,
  "2": 12,
  "3": 16,
  "4": 20,
  "5": 24,
  "6": 32,
  "7": 40,
  "8": 48,
  "9": 64,
  "10": 80,
  "11": 96,
  "12": 128,
} as const;

export type SpacingToken = keyof typeof spacing;

// ============================================================================
// Border Radius System
// ============================================================================

export const radii = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  pill: 9999,
  full: 9999,
} as const;

export type RadiusToken = keyof typeof radii;

// ============================================================================
// Motion/Timing System
// ============================================================================

export const motion = {
  /** Ultra-fast for micro-interactions (button presses) */
  instant: 80,
  /** Fast for small state changes */
  fast: 140,
  /** Normal for most transitions */
  normal: 220,
  /** Slow for emphasis animations */
  slow: 360,
  /** Very slow for page transitions */
  deliberate: 500,
} as const;

export const springConfigs = {
  /** Snappy spring for button presses */
  snappy: {
    damping: 22,
    stiffness: 380,
    mass: 0.6,
  },
  /** Standard spring for general use */
  standard: {
    damping: 18,
    stiffness: 240,
    mass: 0.8,
  },
  /** Gentle spring for large elements */
  gentle: {
    damping: 15,
    stiffness: 150,
    mass: 1,
  },
  /** Bouncy spring for playful interactions */
  bouncy: {
    damping: 12,
    stiffness: 300,
    mass: 0.8,
  },
  /** Slow spring for dramatic entrances */
  dramatic: {
    damping: 20,
    stiffness: 120,
    mass: 1.2,
  },
} as const;

// Easing curves
export const easings = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => 1 - (1 - t) * (1 - t),
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  spring: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
} as const;

// ============================================================================
// Shadow System - lazy to avoid Platform at module load (runtime not ready on Hermes)
// ============================================================================

export type ShadowsRecord = {
  none: Record<string, never>;
  xs: object;
  sm: object;
  md: object;
  lg: object;
  xl: object;
  inner: object;
};

let _shadows: ShadowsRecord | null = null;

function getShadows(): ShadowsRecord {
  if (_shadows) return _shadows;
  _shadows = {
    none: {},
    xs: Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: { elevation: 1 },
      default: {},
    }) ?? {},
    sm: Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
      default: {},
    }) ?? {},
    md: Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
      default: {},
    }) ?? {},
    lg: Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.14,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
      default: {},
    }) ?? {},
    xl: Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.18,
        shadowRadius: 32,
      },
      android: { elevation: 16 },
      default: {},
    }) ?? {},
    inner: Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: {},
      default: {},
    }) ?? {},
  };
  return _shadows;
}

export type ShadowToken = keyof ShadowsRecord;

// ============================================================================
// Theme Type Definitions
// ============================================================================

export type ColorMode = "light" | "dark";
export type ColorModePreference = "system" | ColorMode;
export type BrandProvider = "gemini" | "claude";

export interface ThemeColors {
  // Background colors
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceAlt: string;
  surfaceMuted: string;
  
  // Border colors
  border: string;
  borderSubtle: string;
  borderStrong: string;
  
  // Text colors
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  textInverse: string;
  textPlaceholder: string;
  
  // Brand colors
  accent: string;
  accentSoft: string;
  accentMuted: string;
  accentSubtle: string;
  accentOnDark: string;
  
  // Semantic colors
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  
  // Utility colors
  overlay: string;
  shadow: string;
  skeleton: string;
  skeletonHighlight: string;
  
  // Special colors
  assistantBg: string;
  userBg: string;
}

export interface Theme {
  provider: BrandProvider;
  mode: ColorMode;
  colors: ThemeColors;
  typography: TypographyScaleRecord;
  spacing: typeof spacing;
  radii: typeof radii;
  motion: typeof motion;
  spring: typeof springConfigs;
  easings: typeof easings;
  shadows: ShadowsRecord;
}

// ============================================================================
// Theme Building Functions
// ============================================================================

function withAlpha(color: string, alpha: number): string {
  const hex = color.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildColors(provider: BrandProvider, mode: ColorMode): ThemeColors {
  const brand = brandColors[provider][mode];
  const isDark = mode === "dark";
  
  // Neutral palette selection
  const neutrals = isDark ? {
    background: neutralColors.black,
    surface: "#151821",
    surfaceElevated: "#1d202a",
    surfaceAlt: "#1d202a",
    surfaceMuted: "#262b36",
    border: "#2e3340",
    borderSubtle: "#1e222d",
    borderStrong: "#3d4352",
    textPrimary: "#f5f7fb",
    textSecondary: "#d1d7e3",
    textTertiary: "#9aa3b2",
    textMuted: "#6b7280",
    textInverse: neutralColors.black,
    textPlaceholder: "#6b7280",
    overlay: "rgba(0, 0, 0, 0.7)",
    shadow: "rgba(0, 0, 0, 0.5)",
    skeleton: "#1e222d",
    skeletonHighlight: "#2a3140",
  } : {
    background: neutralColors.gray50,
    surface: neutralColors.white,
    surfaceElevated: neutralColors.white,
    surfaceAlt: neutralColors.gray100,
    surfaceMuted: neutralColors.gray200,
    border: neutralColors.gray300,
    borderSubtle: neutralColors.gray200,
    borderStrong: neutralColors.gray400,
    textPrimary: neutralColors.gray900,
    textSecondary: neutralColors.gray800,
    textTertiary: neutralColors.gray600,
    textMuted: neutralColors.gray500,
    textInverse: neutralColors.white,
    textPlaceholder: neutralColors.gray500,
    overlay: "rgba(13, 15, 20, 0.5)",
    shadow: "rgba(16, 24, 40, 0.12)",
    skeleton: neutralColors.gray200,
    skeletonHighlight: neutralColors.gray100,
  };

  // Semantic colors
  const semantic = {
    success: semanticColors.success[mode],
    successSoft: withAlpha(semanticColors.success[mode], isDark ? 0.2 : 0.12),
    danger: semanticColors.danger[mode],
    dangerSoft: withAlpha(semanticColors.danger[mode], isDark ? 0.2 : 0.12),
    warning: semanticColors.warning[mode],
    warningSoft: withAlpha(semanticColors.warning[mode], isDark ? 0.2 : 0.12),
    info: semanticColors.info[mode],
    infoSoft: withAlpha(semanticColors.info[mode], isDark ? 0.2 : 0.12),
  };

  return {
    ...neutrals,
    ...brand,
    ...semantic,
    accentSubtle: withAlpha(brand.accent, isDark ? 0.2 : 0.14),
    assistantBg: neutrals.surfaceAlt,
    userBg: isDark ? "#1e2a3a" : "#fef3e2",
  };
}

export function buildTheme(provider: BrandProvider, mode: ColorMode): Theme {
  return {
    provider,
    mode,
    colors: buildColors(provider, mode),
    typography: getTypographyScale(),
    spacing,
    radii,
    motion,
    spring: springConfigs,
    easings,
    shadows: getShadows(),
  };
}

// ============================================================================
// Theme Context
// ============================================================================

interface ThemeContextValue {
  provider: BrandProvider;
  mode: ColorModePreference;
  setProvider?: (provider: BrandProvider) => void;
  setMode?: (mode: ColorModePreference) => void;
}

const defaultContextValue: ThemeContextValue = {
  provider: "gemini",
  mode: "system",
};

const ThemeContext = createContext<ThemeContextValue>(defaultContextValue);

export interface ModernThemeProviderProps {
  provider?: BrandProvider;
  mode?: ColorModePreference;
  onProviderChange?: (provider: BrandProvider) => void;
  onModeChange?: (mode: ColorModePreference) => void;
  children: React.ReactNode;
}

export function ModernThemeProvider({
  provider = "gemini",
  mode = "system",
  onProviderChange,
  onModeChange,
  children,
}: ModernThemeProviderProps) {
  const setProvider = useCallback(
    (p: BrandProvider) => onProviderChange?.(p),
    [onProviderChange]
  );
  
  const setMode = useCallback(
    (m: ColorModePreference) => onModeChange?.(m),
    [onModeChange]
  );

  const value = useMemo(
    () => ({
      provider,
      mode,
      setProvider,
      setMode,
    }),
    [provider, mode, setProvider, setMode]
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

export function useThemeContext(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function useThemeMode(): ColorMode {
  const systemMode = useColorScheme();
  const { mode } = useContext(ThemeContext);
  
  if (mode === "system") {
    return systemMode === "dark" ? "dark" : "light";
  }
  return mode;
}

export function useTheme(): Theme {
  const { provider } = useContext(ThemeContext);
  const mode = useThemeMode();
  
  return useMemo(() => buildTheme(provider, mode), [provider, mode]);
}

export function useColors(): ThemeColors {
  return useTheme().colors;
}

export function useTypography(): TypographyScaleRecord {
  return useTheme().typography;
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
    
    // Responsive sizing helpers
    scaleSize: (size: number) => Math.round(size * scale),
    scaleFont: (size: number) => Math.round(size * fontScale),
    
    // Breakpoint helpers
    gt: {
      xs: width >= 320,
      sm: width >= 375,
      md: width >= 414,
      lg: width >= 768,
      xl: width >= 1024,
    },
  }), [width, height, scale, fontScale]);
}
