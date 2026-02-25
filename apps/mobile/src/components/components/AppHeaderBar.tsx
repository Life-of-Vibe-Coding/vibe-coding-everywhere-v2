import React from "react";
import { StyleSheet } from "react-native";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Box } from "@/components/ui/box";
import { Text as GluestackText } from "@/components/ui/text";
import {
  AnimatedPressableView,
  EntranceAnimation,
  spacing,
  triggerHaptic,
} from "@/design-system";
import { MenuIcon, SettingsIcon } from "@/components/icons/HeaderIcons";

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
        style={{ width: 44, height: 44, justifyContent: "center", alignItems: "center" }}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
      >
        {icon}
      </AnimatedPressableView>
    </EntranceAnimation>
  );
}

const styles = StyleSheet.create({
  menuButtonOverlay: {
    position: "absolute",
    top: 8,
    left: 0,
    right: 0,
    height: 44,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  sessionIdCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing[1],
    minHeight: 40,
  },
  headerStatusStack: {
    maxWidth: "100%",
  },
});

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
    <HStack style={styles.menuButtonOverlay} pointerEvents="box-none">
      <HeaderButton
        icon={<MenuIcon color={iconColor} />}
        onPress={onOpenExplorer}
        accessibilityLabel="Open Explorer"
        delay={100}
      />
      <Box style={[styles.sessionIdCenter, { flexShrink: 1 }]} className="min-w-0 flex-1">
        <VStack style={styles.headerStatusStack} className="gap-0.5 items-center">
          <GluestackText
            size="xs"
            numberOfLines={2}
            style={{ color: workspaceColor }}
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
            {statusLabel}
          </GluestackText>
        </VStack>
      </Box>
      <HeaderButton
        icon={<SettingsIcon color={iconColor} />}
        onPress={onOpenSessionManagement}
        accessibilityLabel="Manage sessions"
        delay={200}
      />
    </HStack>
  );
}
