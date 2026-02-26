import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Box } from "@/components/ui/box";
import { WorkspaceSidebar } from "@/components/file/WorkspaceSidebar";

type WorkspaceSidebarPageProps = {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (path: string) => void;
  onCommitByAI: (request: string) => void;
  onActiveTabChange: (tab: "files" | "changes" | "commits") => void;
};

export function WorkspaceSidebarPage({
  isOpen,
  onClose,
  onFileSelect,
  onCommitByAI,
  onActiveTabChange,
}: WorkspaceSidebarPageProps) {
  if (!isOpen) return null;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom", "left", "right"]}>
      <Box className="flex-1 bg-surface-base">
        <WorkspaceSidebar
          isOpen={isOpen}
          embedded
          onClose={onClose}
          onFileSelect={onFileSelect}
          onCommitByAI={onCommitByAI}
          onActiveTabChange={onActiveTabChange}
        />
      </Box>
    </SafeAreaView>
  );
}
