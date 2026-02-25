import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
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

type ThemeLike = {
  colors: {
    textPrimary: string;
    accent: string;
    success: string;
    warning: string;
    textMuted: string;
  };
};

type HeaderStyleSet = {
  menuButtonOverlay: StyleProp<ViewStyle>;
  sessionIdCenter: StyleProp<ViewStyle>;
  headerStatusStack: StyleProp<ViewStyle>;
  headerStatusRow: StyleProp<ViewStyle>;
};

interface AppHeaderBarProps {
  visible: boolean;
  theme: ThemeLike;
  styles: HeaderStyleSet;
  workspaceName: string;
  sessionRunning: boolean;
  waitingForUserInput: boolean;
  sessionIdLabel: string;
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
        style={{ width: 40, height: 40, justifyContent: "center", alignItems: "center" }}
        accessibilityLabel={accessibilityLabel}
      >
        {icon}
      </AnimatedPressableView>
    </EntranceAnimation>
  );
}

export function AppHeaderBar({
  visible,
  theme,
  styles,
  workspaceName,
  sessionRunning,
  waitingForUserInput,
  sessionIdLabel,
  onOpenExplorer,
  onOpenSessionManagement,
}: AppHeaderBarProps) {
  if (!visible) return null;
  const showStart = !sessionRunning;
  const statusColor = showStart
    ? theme.colors.accent
    : waitingForUserInput
      ? theme.colors.warning
      : theme.colors.success;
  const statusText = showStart ? "Start" : waitingForUserInput ? "Wait" : "Running";

  return (
    <HStack style={styles.menuButtonOverlay} pointerEvents="box-none">
      <HeaderButton
        icon={<MenuIcon color={theme.colors.textPrimary} />}
        onPress={onOpenExplorer}
        accessibilityLabel="Open Explorer"
        delay={100}
      />
      <Box style={[styles.sessionIdCenter, { flexShrink: 1 }]} className="min-w-0 flex-1">
        <VStack style={styles.headerStatusStack} className="gap-0.5 items-center">
          <GluestackText
            size="xs"
            numberOfLines={2}
            style={{ color: theme.colors.accent }}
            className="font-medium text-center"
          >
            {workspaceName}
          </GluestackText>
          <GluestackText
            size="xs"
            numberOfLines={1}
            ellipsizeMode="middle"
            style={{ color: statusColor }}
            className="font-medium"
          >
            {statusText}
            {!showStart ? `: ${sessionIdLabel}` : ""}
          </GluestackText>
        </VStack>
      </Box>
      <HeaderButton
        icon={<SettingsIcon color={theme.colors.textPrimary} />}
        onPress={onOpenSessionManagement}
        accessibilityLabel="Manage sessions"
        delay={200}
      />
    </HStack>
  );
}
