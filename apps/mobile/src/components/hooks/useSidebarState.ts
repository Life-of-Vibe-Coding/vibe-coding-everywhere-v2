import { useCallback, useState } from "react";

export type SidebarTab = "files" | "changes" | "commits";

export type SidebarState = {
  sidebarVisible: boolean;
  sidebarActiveTab: SidebarTab;
  openSidebar: () => void;
  closeSidebar: () => void;
  setSidebarActiveTab: (tab: SidebarTab) => void;
};

export function useSidebarState(initialTab: SidebarTab = "files"): SidebarState {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [sidebarActiveTab, setSidebarActiveTab] = useState<SidebarTab>(initialTab);

  const openSidebar = useCallback(() => {
    setSidebarVisible(true);
  }, []);

  const closeSidebar = useCallback(() => {
    setSidebarVisible(false);
  }, []);

  return {
    sidebarVisible,
    sidebarActiveTab,
    openSidebar,
    closeSidebar,
    setSidebarActiveTab,
  };
}
