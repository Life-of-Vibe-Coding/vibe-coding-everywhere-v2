import React from "react";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { TabBarPills } from "@/components/reusable/TabBarPills";
import type { SidebarTab } from "@/components/hooks/useSidebarState";
import { useTheme } from "@/theme/index";

type SidebarHeaderProps = {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onClose: () => void;
};

export function SidebarHeader({ activeTab, onTabChange, onClose }: SidebarHeaderProps) {
  const theme = useTheme();
  return (
    <Box
      className="flex-row items-center justify-center border-b"
      style={{
        borderBottomColor: theme.mode === "dark" ? "rgba(162, 210, 255, 0.15)" : theme.colors.border,
        backgroundColor: theme.mode === "dark" ? "rgba(8, 12, 22, 0.4)" : "transparent",
      }}
    >
      <Box className="w-[48px]" />
      <Box className="flex-1 flex-row items-center">
        <TabBarPills
          tabs={[
            { key: "files", label: "Files" },
            { key: "changes", label: "Changes" },
            { key: "commits", label: "Commits" },
          ]}
          value={activeTab}
          onChange={(tab) => onTabChange(tab as SidebarTab)}
          className="w-full"
          variant="segment"
        />
      </Box>
      <Box className="w-[48px] flex-row items-center justify-end">
        <Pressable
          className="w-11 h-11 rounded-lg items-center justify-center border"
          style={({ pressed }) => ({
            borderColor: pressed ? theme.colors.accent : "transparent",
            backgroundColor: pressed
              ? theme.mode === "dark"
                ? "rgba(160, 209, 255, 0.16)"
                : theme.colors.surfaceAlt
              : theme.mode === "dark"
                ? "rgba(255, 255, 255, 0.05)"
                : theme.colors.surfaceMuted,
            shadowColor: pressed ? theme.colors.accent : "transparent",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: pressed ? 0.6 : 0,
            shadowRadius: pressed ? 8 : 0,
          })}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Close file explorer"
        >
          <Text className="text-[18px] font-semibold" style={{ color: theme.colors.textPrimary }}>✕</Text>
        </Pressable>
      </Box>
    </Box>
  );
}
