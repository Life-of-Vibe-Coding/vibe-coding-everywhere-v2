import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Box } from "@/components/ui/box";
import { WorkspaceSidebar } from "@/components/file/WorkspaceSidebar";

type WorkspaceSidebarPageProps = {
  visible: boolean;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: "auto" | "none" | "box-none" | "box-only";
  onClose: () => void;
  onFileSelect: (path: string) => void;
  onCommitByAI: (request: string) => void;
  onActiveTabChange: (tab: "files" | "changes" | "commits") => void;
};

export function WorkspaceSidebarPage({
  visible,
  style,
  pointerEvents,
  onClose,
  onFileSelect,
  onCommitByAI,
  onActiveTabChange,
}: WorkspaceSidebarPageProps) {
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
