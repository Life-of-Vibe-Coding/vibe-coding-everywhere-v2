import React, { useEffect, useRef } from "react";
import { StyleSheet, Animated } from "react-native";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Box } from "@/components/ui/box";
import { Text as GluestackText } from "@/components/ui/text";
import {
  AnimatedPressableView,
  EntranceAnimation,
  triggerHaptic,
} from "@/design-system";
import { SettingsGradientIcon } from "@/components/icons/HeaderIcons";
import { BlurView } from "expo-blur";
import { useTheme } from "@/theme/index";
import { Image } from "react-native";
import { layoutGlassHeaderStyleDark, layoutGlassHeaderStyleLight } from "@/components/styles/appStyles";
import { useThemeAssets } from "@/hooks/useThemeAssets";

interface AppHeaderBarProps {
  visible: boolean;
  iconColor: string;
  onOpenExplorer: () => void;
  onOpenSessionManagement: () => void;
}

interface HeaderButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  delay?: number;
  plain?: boolean;
  size?: number;
}

function HeaderButton({ icon, onPress, accessibilityLabel, delay = 0, plain = false, size = 44, isDark = true }: HeaderButtonProps & { isDark?: boolean }) {
  return (
    <EntranceAnimation variant="scale" delay={delay}>
      <AnimatedPressableView
        onPress={() => {
          triggerHaptic("light");
          onPress();
        }}
        haptic={undefined}
        scaleTo={0.92}
        style={{
          width: size,
          height: size,
          justifyContent: "center",
          alignItems: "center",
          borderRadius: plain ? 0 : 12,
          overflow: plain ? "visible" : "hidden",
          backgroundColor: plain ? "transparent" : (isDark ? "rgba(255, 255, 255, 0.05)" : "#E2CDBA"), // surfaceMuted for light
          borderColor: plain ? "transparent" : (isDark ? "rgba(255, 255, 255, 0.1)" : "#D1BCA3"), // border for light
          borderWidth: plain ? 0 : StyleSheet.hairlineWidth,
        }}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
      >
        {!plain && isDark && <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />}
        {icon}
      </AnimatedPressableView>
    </EntranceAnimation>
  );
}

function FlickerLogo({ isDark }: { isDark: boolean }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const assets = useThemeAssets();

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const runFlicker = () => {
      // 1. Primary "glitch" burst
      const sequences = [];
      const burstCount = Math.floor(Math.random() * 3) + 2;

      for (let i = 0; i < burstCount; i++) {
        sequences.push(
          Animated.timing(opacity, {
            toValue: Math.random() * 0.4 + 0.3, // Drop to 0.3 - 0.7
            duration: Math.random() * 40 + 20,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1.0,
            duration: Math.random() * 40 + 20,
            useNativeDriver: true,
          })
        );
      }

      Animated.sequence(sequences).start(() => {
        // 2. Wait for next burst
        const nextDelay = Math.random() * 4000 + 1000; // 1-5 seconds
        timeoutId = setTimeout(runFlicker, nextDelay);
      });
    };

    const initialDelay = setTimeout(runFlicker, 2000);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(initialDelay);
    };
  }, [opacity]);

  return (
    <Animated.View style={{ opacity }}>
      <Image
        source={assets.leftHeaderIcon}
        style={{ width: 80, height: 80 }}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

export function AppHeaderBar({
  visible,
  iconColor,
  onOpenExplorer,
  onOpenSessionManagement,
}: AppHeaderBarProps) {
  const theme = useTheme();
  const isDark = theme.mode === "dark";

  if (!visible) return null;

  return (
    <Box
      style={isDark ? layoutGlassHeaderStyleDark : { backgroundColor: "transparent" }}
      className="relative z-10 -mx-6 px-6 pb-2 overflow-hidden"
    >
      {isDark && <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />}
      <HStack className="relative h-20 flex-row items-center justify-between px-0 -mt-2" pointerEvents="box-none">
        <HeaderButton
          icon={<Box style={{ marginLeft: -10 }}><FlickerLogo isDark={isDark} /></Box>}
          onPress={onOpenExplorer}
          accessibilityLabel="Open Explorer"
          delay={100}
          size={72}
          plain
          isDark={isDark}
        />
        <Box className="min-w-0 flex-1 shrink justify-center items-center px-2" />
        <HeaderButton
          icon={
            <SettingsGradientIcon size={36} />
          }
          onPress={onOpenSessionManagement}
          accessibilityLabel="Manage sessions"
          delay={200}
          size={56}
          plain
          isDark={isDark}
        />
      </HStack>
    </Box>
  );
}
