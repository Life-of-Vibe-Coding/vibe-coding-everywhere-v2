import React from "react";
import { StyleSheet } from "react-native";
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

interface AppHeaderBarProps {
  visible: boolean;
  workspaceName: string;
  iconColor: string;
  workspaceColor: string;
  statusColor: string;
  statusLabel: string;
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

function HeaderButton({ icon, onPress, accessibilityLabel, delay = 0, plain = false, size = 44 }: HeaderButtonProps) {
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
          backgroundColor: plain ? "transparent" : "rgba(255, 255, 255, 0.2)",
          borderColor: plain ? "transparent" : "rgba(255, 255, 255, 0.4)",
          borderWidth: plain ? 0 : StyleSheet.hairlineWidth,
        }}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
      >
        {!plain && <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />}
        {icon}
      </AnimatedPressableView>
    </EntranceAnimation>
  );
}

export function AppHeaderBar({
  visible,
  workspaceName,
  iconColor,
  workspaceColor,
  statusColor,
  statusLabel,
  onOpenExplorer,
  onOpenSessionManagement,
}: AppHeaderBarProps) {
  const theme = useTheme();
  const isDark = theme.mode === "dark";

  if (!visible) return null;

  return (
    <HStack className="relative h-20 flex-row items-center justify-between -mx-4 px-0 -mt-2" pointerEvents="box-none">
      <HeaderButton
        icon={
          <Image
            source={require("../../../assets/setting-icon-final.png")}
            style={{ width: 68, height: 68, opacity: 0.6 }}
            resizeMode="contain"
          />
        }
        onPress={onOpenExplorer}
        accessibilityLabel="Open Explorer"
        delay={100}
        size={72}
        plain
      />
      <Box className="min-w-0 flex-1 shrink justify-center items-center px-2">
        <VStack className="max-w-full gap-0 items-center">
          <GluestackText
            size="xs"
            numberOfLines={1}
            ellipsizeMode="middle"
            style={{
              color: isDark ? "rgba(0, 229, 255, 0.75)" : "rgba(0,0,0,0.5)",
              textTransform: "uppercase",
              letterSpacing: 1.5,
              fontSize: 10,
              textShadowColor: isDark ? "rgba(0, 229, 255, 0.3)" : "transparent",
              textShadowRadius: isDark ? 4 : 0,
              marginBottom: -4
            }}
            className="font-bold text-center"
          >
            {workspaceName}
          </GluestackText>
          <GluestackText
            size="md"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{
              color: isDark ? "#FFFFFF" : "#111",
              fontSize: 22,
              textShadowColor: isDark ? "rgba(255, 255, 255, 0.4)" : "transparent",
              textShadowRadius: isDark ? 12 : 0,
            }}
            className="font-black"
          >
            {statusLabel}
          </GluestackText>
        </VStack>
      </Box>
      <HeaderButton
        icon={
          <SettingsGradientIcon size={36} />
        }
        onPress={onOpenSessionManagement}
        accessibilityLabel="Manage sessions"
        delay={200}
        size={56}
        plain
      />
    </HStack>
  );
}
