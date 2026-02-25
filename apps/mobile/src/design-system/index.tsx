/**
 * Modern Design System for React Native
 *
 * A comprehensive, accessible, and performant design system featuring:
 * - WCAG 2.1 AA compliant color system
 * - Scalable typography with responsive sizing
 * - 8px grid spacing system
 * - Smooth animations using RN built-in Animated API
 * - Haptic feedback integration
 * - Dark/light mode support
 */

// ============================================================================
// Theme System Exports
// ============================================================================

export {
  // Theme Provider
  ModernThemeProvider,

  // Hooks
  useTheme,
  useThemeContext,
  useThemeMode,
  useColors,
  useTypography,
  useResponsive,

  // Utilities
  buildTheme,
  getContrastRatio,
  contrastRatios,

  // Constants
  spacing,
  radii,
  motion,
  springConfigs,
  easings,
  brandColors,

  // Types
  type Theme,
  type ThemeColors,
  type ColorMode,
  type ColorModePreference,
  type BrandProvider,
  type TypographyVariant,
  type TypographyStyle,
  type SpacingToken,
  type RadiusToken,
  type ShadowToken,
} from "@/design-system/theme";

// ============================================================================
// Animation System Exports
// ============================================================================

export {
  // Hooks
  useSpringAnimation,
  usePressableAnimation,
  useHaptic,
  usePerformanceMonitor,

  // Utilities
  triggerHaptic,

  // Components
  AnimatedPressableView,
  Skeleton,
  SkeletonText,
  SkeletonCard,
  ProgressiveImage,
  TypingDots,
  EntranceAnimation,
  StaggeredList,
  PulseAnimation,
  FlashAnimation,
  SwipeableCard,

  // Types
  type AnimationVariant,
  type AnimationConfig,
  type HapticConfig,
} from "@/design-system/animations";

// ============================================================================
// Component Exports
// ============================================================================

export {
  // Typography
  Typography,

  // Buttons
  Button,
  IconButton,

  // Layout
  Card,
  Divider,

  // Form Elements
  Input,

  // Data Display
  Badge,
  Avatar,
  Chip,
  ListItem,

  // Utilities
  KeyboardAware,

  // Types
  type ButtonVariant,
  type ButtonSize,
  type CardVariant,
  type TextTone,
  type BadgeVariant,
  type BadgeSize,
  type AvatarSize,
} from "@/design-system/components";

export { cn } from "@/utils/cn";
