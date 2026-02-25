import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Box } from "../ui/box";
import { WorkspaceSidebar } from "../file/WorkspaceSidebar";

type WorkspaceSidebarOverlayProps = {
  visible: boolean;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: "auto" | "none" | "box-none" | "box-only";
  onClose: () => void;
  onFileSelect: (path: string) => void;
  onCommitByAI: (request: string) => void;
  onActiveTabChange: (tab: "files" | "changes" | "commits") => void;
  sidebarActiveTab: "files" | "changes" | "commits";
};

export function WorkspaceSidebarOverlay({
  visible,
  style,
  pointerEvents,
  onClose,
  onFileSelect,
  onCommitByAI,
  onActiveTabChange,
  sidebarActiveTab,
}: WorkspaceSidebarOverlayProps) {
  return (
    <Box style={style} pointerEvents={pointerEvents ?? "none"}>
      <WorkspaceSidebar
        visible={visible}
        embedded
        onClose={onClose}
        onFileSelect={onFileSelect}
        onCommitByAI={onCommitByAI}
        onActiveTabChange={onActiveTabChange}
      />
    </Box>
  );
}
