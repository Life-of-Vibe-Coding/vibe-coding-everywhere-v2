import React from "react";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { TabBarPills } from "@/components/reusable/TabBarPills";
import type { SidebarTab } from "@/components/hooks/useSidebarState";

type SidebarHeaderProps = {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onClose: () => void;
};

export function SidebarHeader({ activeTab, onTabChange, onClose }: SidebarHeaderProps) {
  return (
    <Box className="flex-row items-center justify-center border-b border-outline-500 bg-background-0">
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
          className="w-11 h-11 rounded-lg items-center justify-center bg-background-100 active:bg-background-200"
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Close file explorer"
        >
          <Text className="text-[18px] font-semibold text-text-secondary">✕</Text>
        </Pressable>
      </Box>
    </Box>
  );
}
