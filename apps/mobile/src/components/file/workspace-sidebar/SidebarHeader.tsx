import React from "react";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { Pressable } from "@/components/ui/pressable";
import { TabBarPills } from "@/components/reusable/TabBarPills";
import type { SidebarTab } from "@/components/hooks/useSidebarState";

type SidebarHeaderStyles = {
  tabContainer: any;
  tabSpacer: any;
  tabGroup: any;
  tabSpacerRight: any;
  tabCloseBtn: any;
  tabCloseBtnText: any;
};

type SidebarHeaderProps = {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onClose: () => void;
  styles: SidebarHeaderStyles;
};

export function SidebarHeader({
  activeTab,
  onTabChange,
  onClose,
  styles,
}: SidebarHeaderProps) {
  return (
    <Box style={styles.tabContainer}>
      <Box style={styles.tabSpacer} />
      <Box style={styles.tabGroup}>
        <TabBarPills
          tabs={[
            { key: "files", label: "Files" },
            { key: "changes", label: "Changes" },
            { key: "commits", label: "Commits" },
          ]}
          value={activeTab}
          onChange={(tab) => onTabChange(tab as SidebarTab)}
        />
      </Box>
      <Box style={styles.tabSpacerRight}>
        <Pressable
          style={styles.tabCloseBtn}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Close file explorer"
        >
          <Text style={styles.tabCloseBtnText}>✕</Text>
        </Pressable>
      </Box>
    </Box>
  );
}
