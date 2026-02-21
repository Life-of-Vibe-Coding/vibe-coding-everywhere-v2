/**
 * Legacy Design System Components
 *
 * Uses React Native's built-in Animated API instead of react-native-reanimated.
 *
 * @deprecated Use the modern components from './design-system' instead
 */

import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  Animated,
  Easing,
  type PressableProps,
  type TextInputProps,
  type ViewStyle,
  type TextStyle,
  type StyleProp,
  type DimensionValue,
  type GestureResponderEvent,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";

import { useTheme, type TypographyScale } from "../theme";

// ============================================================================
// Legacy Types
// ============================================================================

type TextVariant = keyof TypographyScale;
type TextTone = "primary" | "secondary" | "muted" | "inverse" | "accent";
type HapticType = "selection" | "light" | "medium";
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const hapticMap: Record<HapticType, () => Promise<void>> = {
  selection: () => Haptics.selectionAsync(),
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
};

// ============================================================================
// Legacy AppText Component
// ============================================================================

export function AppText({
  variant = "body",
  tone = "primary",
  style,
  children,
  ...props
}: {
  variant?: TextVariant;
  tone?: TextTone;
  style?: StyleProp<TextStyle>;
  children?: React.ReactNode;
} & Omit<React.ComponentProps<typeof Text>, "style">) {
  const theme = useTheme();
  const color = useMemo(() => {
    if (tone === "inverse") return theme.colors.textInverse;
    if (tone === "accent") return theme.colors.accent;
    if (tone === "secondary") return theme.colors.textSecondary;
    if (tone === "muted") return theme.colors.textMuted;
    return theme.colors.textPrimary;
  }, [theme, tone]);
  return (
    <Text style={[theme.typography[variant], { color }, style]} {...props}>
      {children}
    </Text>
  );
}

// ============================================================================
// Legacy AppPressable Component
// ============================================================================

export function AppPressable({
  onPress,
  haptic = "selection",
  scaleTo = 0.96,
  style,
  disabled,
  children,
  ...props
}: {
  haptic?: HapticType;
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
} & PressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (hapticMap[haptic]) hapticMap[haptic]().catch(() => {});
      onPress?.(event);
    },
    [haptic, onPress]
  );

  return (
    <Animated.View style={[style, { transform: [{ scale }], opacity }]}>
      <Pressable
        {...props}
        onPress={handlePress}
        disabled={disabled}
        onPressIn={() => {
          if (disabled) return;
          Animated.spring(scale, {
            toValue: scaleTo,
            useNativeDriver: true,
          }).start();
          Animated.timing(opacity, {
            toValue: 0.92,
            duration: 140,
            useNativeDriver: true,
          }).start();
        }}
        onPressOut={() => {
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
          }).start();
          Animated.timing(opacity, {
            toValue: 1,
            duration: 140,
            useNativeDriver: true,
          }).start();
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ============================================================================
// Legacy AppButton Component
// ============================================================================

export function AppButton({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  style,
  labelStyle,
  haptic = "selection",
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  haptic?: HapticType;
}) {
  const theme = useTheme();
  const sizes = {
    sm: { height: 36, paddingHorizontal: theme.spacing.sm },
    md: { height: 44, paddingHorizontal: theme.spacing.md },
    lg: { height: 52, paddingHorizontal: theme.spacing.lg },
  };
  const baseStyle: ViewStyle = {
    height: sizes[size].height,
    paddingHorizontal: sizes[size].paddingHorizontal,
    borderRadius: theme.radii.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: theme.spacing.xs,
  };
  const variantStyle: Record<ButtonVariant, ViewStyle> = {
    primary: { backgroundColor: theme.colors.accent, borderWidth: 0 },
    secondary: {
      backgroundColor: theme.colors.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    ghost: { backgroundColor: "transparent", borderWidth: 0 },
    danger: { backgroundColor: theme.colors.danger, borderWidth: 0 },
  };
  const textTone: TextTone =
    variant === "primary" || variant === "danger" ? "inverse" : "primary";
  return (
    <AppPressable
      onPress={onPress}
      disabled={disabled}
      haptic={haptic}
      style={[
        baseStyle,
        variantStyle[variant],
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      <AppText variant="callout" tone={textTone} style={labelStyle}>
        {label}
      </AppText>
    </AppPressable>
  );
}

// ============================================================================
// Legacy AppIconButton Component
// ============================================================================

export function AppIconButton({
  icon,
  onPress,
  variant = "secondary",
  size = 40,
  style,
  disabled,
  haptic = "selection",
  accessibilityLabel,
}: {
  icon: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: number;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  haptic?: HapticType;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const background =
    variant === "primary"
      ? theme.colors.accent
      : variant === "danger"
        ? theme.colors.danger
        : theme.colors.surfaceMuted;
  return (
    <AppPressable
      onPress={onPress}
      disabled={disabled}
      haptic={haptic}
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: variant === "ghost" ? 0 : 1,
          borderColor:
            variant === "ghost" ? "transparent" : theme.colors.border,
        },
        style,
      ]}
    >
      {icon}
    </AppPressable>
  );
}

// ============================================================================
// Legacy AppCard Component
// ============================================================================

export function AppCard({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.lg,
          borderWidth: 1,
          borderColor: theme.colors.border,
          padding: theme.spacing.md,
          shadowColor: theme.colors.shadow,
          shadowOpacity: Platform.OS === "ios" ? 0.16 : 0.3,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ============================================================================
// Legacy AppInput Component
// ============================================================================

export function AppInput({
  value,
  onChangeText,
  placeholder,
  style,
  containerStyle,
  leading,
  trailing,
  disabled,
  ...props
}: {
  containerStyle?: StyleProp<ViewStyle>;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  disabled?: boolean;
} & Omit<TextInputProps, "editable">) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const borderColor = isFocused ? theme.colors.accent : theme.colors.border;
  const backgroundColor = isFocused
    ? theme.colors.surfaceAlt
    : theme.colors.surface;

  return (
    <View
      style={[
        {
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor,
          backgroundColor,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.xs,
        },
        disabled && { opacity: 0.5 },
        containerStyle,
      ]}
    >
      {leading}
      <TextInput
        {...props}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        editable={!disabled}
        style={[
          theme.typography.body,
          { color: theme.colors.textPrimary, flex: 1 },
          style,
        ]}
        onFocus={(e: NativeSyntheticEvent<TextInputFocusEventData>) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e: NativeSyntheticEvent<TextInputFocusEventData>) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
      />
      {trailing}
    </View>
  );
}

// ============================================================================
// Legacy AppSkeleton Component
// ============================================================================

export function AppSkeleton({
  height = 16,
  width = "100%",
  radius,
  style,
}: {
  height?: number;
  width?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const shimmer = useRef(new Animated.Value(0)).current;
  const [measuredWidth, setMeasuredWidth] = useState(0);

  useEffect(() => {
    if (measuredWidth <= 0) return;
    const animation = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [measuredWidth, shimmer]);

  const shimmerTranslateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-measuredWidth, measuredWidth],
  });

  return (
    <View
      style={[
        {
          height,
          width,
          borderRadius: radius ?? theme.radii.sm,
          backgroundColor: theme.colors.skeleton,
          overflow: "hidden",
        },
        style,
      ]}
      onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
    >
      {measuredWidth > 0 && (
        <Animated.View
          style={{
            width: Math.max(80, measuredWidth / 2),
            height: "100%",
            backgroundColor: theme.colors.skeletonHighlight,
            opacity: 0.7,
            transform: [{ translateX: shimmerTranslateX }],
          }}
        />
      )}
    </View>
  );
}

// ============================================================================
// Legacy ProgressiveImage Component
// ============================================================================

export function ProgressiveImage({
  source,
  style,
  contentFit = "cover",
  placeholderHeight = 180,
}: {
  source: React.ComponentProps<typeof Image>["source"];
  style?: StyleProp<ViewStyle>;
  contentFit?: React.ComponentProps<typeof Image>["contentFit"];
  placeholderHeight?: number;
}) {
  const theme = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  return (
    <View style={[{ backgroundColor: theme.colors.surfaceMuted }, style]}>
      <AppSkeleton height={placeholderHeight} radius={theme.radii.lg} />
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: fadeAnim }]}>
        <Image
          source={source}
          contentFit={contentFit}
          style={StyleSheet.absoluteFillObject}
          onLoad={() => {
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 220,
              useNativeDriver: true,
            }).start();
          }}
        />
      </Animated.View>
    </View>
  );
}

// ============================================================================
// Legacy PerformanceMonitor Component
// ============================================================================

type FpsSample = { current: number; min: number; max: number; avg: number };

function useFpsMonitor(active: boolean) {
  const [sample, setSample] = useState<FpsSample>({
    current: 0,
    min: 0,
    max: 0,
    avg: 0,
  });
  useEffect(() => {
    if (!active) return;
    let frameCount = 0;
    let lastTime = Date.now();
    let total = 0;
    let ticks = 0;
    let min = 999;
    let max = 0;
    let raf = 0;
    const loop = () => {
      frameCount += 1;
      const now = Date.now();
      if (now - lastTime >= 1000) {
        const fps = frameCount;
        frameCount = 0;
        lastTime = now;
        total += fps;
        ticks += 1;
        min = Math.min(min, fps);
        max = Math.max(max, fps);
        setSample({
          current: fps,
          min: min === 999 ? fps : min,
          max,
          avg: Math.round(total / ticks),
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return sample;
}

export function PerformanceMonitor({
  title = "Performance",
}: {
  title?: string;
}) {
  const theme = useTheme();
  const [active, setActive] = useState(false);
  const sample = useFpsMonitor(active);
  return (
    <AppCard style={{ gap: theme.spacing.sm }}>
      <AppText variant="title3">{title}</AppText>
      <View
        style={{
          flexDirection: "row",
          gap: theme.spacing.sm,
          flexWrap: "wrap",
        }}
      >
        <Metric label="Current" value={`${sample.current} fps`} />
        <Metric label="Avg" value={`${sample.avg} fps`} />
        <Metric label="Min" value={`${sample.min} fps`} />
        <Metric label="Max" value={`${sample.max} fps`} />
      </View>
      <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
        <AppButton
          label={active ? "Stop Sample" : "Start Sample"}
          onPress={() => setActive((prev) => !prev)}
        />
      </View>
    </AppCard>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        minWidth: 90,
        paddingVertical: theme.spacing.xs,
        paddingHorizontal: theme.spacing.sm,
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surfaceAlt,
      }}
    >
      <AppText variant="label" tone="muted">
        {label}
      </AppText>
      <AppText variant="callout">{value}</AppText>
    </View>
  );
}
