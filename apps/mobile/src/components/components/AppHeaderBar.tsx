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
import { MenuIcon, SettingsIcon } from "@/components/icons/HeaderIcons";
import { BlurView } from "expo-blur";

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
}

function HeaderButton({ icon, onPress, accessibilityLabel, delay = 0 }: HeaderButtonProps) {
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
          width: 44,
          height: 44,
          justifyContent: "center",
          alignItems: "center",
          borderRadius: 22,
          overflow: "hidden",
          backgroundColor: "rgba(255, 255, 255, 0.2)",
          borderColor: "rgba(255, 255, 255, 0.4)",
          borderWidth: StyleSheet.hairlineWidth,
        }}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
      >
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
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
  if (!visible) return null;

  return (
    <HStack className="relative h-14 flex-row items-center justify-between px-4 mt-2 mb-2" pointerEvents="box-none">
      <HeaderButton
        icon={<MenuIcon color="#333" />}
        onPress={onOpenExplorer}
        accessibilityLabel="Open Explorer"
        delay={100}
      />
      <Box className="min-w-0 flex-1 shrink justify-center items-center px-2">
        <VStack className="max-w-full gap-0.5 items-center">
          <GluestackText
            size="xs"
            numberOfLines={1}
            style={{ color: "rgba(0,0,0,0.4)", textTransform: "uppercase", letterSpacing: 1 }}
            className="font-bold text-center"
          >
            {workspaceName}
          </GluestackText>
          <GluestackText
            size="md"
            numberOfLines={1}
            ellipsizeMode="middle"
            style={{ color: "#111" }}
            className="font-extrabold"
          >
            {statusLabel}
          </GluestackText>
        </VStack>
      </Box>
      <HeaderButton
        icon={<SettingsIcon color="#333" />}
        onPress={onOpenSessionManagement}
        accessibilityLabel="Manage sessions"
        delay={200}
      />
    </HStack>
  );
}
