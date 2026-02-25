import { Platform } from "react-native";
import React from "react";

import { Box } from "@/components/ui/box";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import {
  FileIconByType,
  FolderIconByType,
} from "@/components/icons/WorkspaceTreeIcons";
import type { WorkspaceTreeItem } from "@/components/file/workspace-sidebar/FileTreePane";

type FolderRowProps = {
  item: WorkspaceTreeItem;
  depth: number;
  expanded?: boolean;
  isIgnored?: boolean;
  isDark: boolean;
  rootColorPrimary: string;
  rootColorSecondary: string;
  folderIconColor: string;
  onToggleFolder: (path: string) => void;
  onOpenFile: (path: string) => void;
  getFileColor: (name: string) => string;
};

export function FolderRow({
  item,
  depth,
  expanded = false,
  isIgnored = false,
  isDark,
  rootColorPrimary,
  rootColorSecondary,
  folderIconColor,
  onToggleFolder,
  onOpenFile,
  getFileColor,
}: FolderRowProps) {
  const isFolder = item.type === "folder";
  const fileColor = isFolder ? folderIconColor : getFileColor(item.name);
  const pressedBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  const handlePress = () => {
    if (isFolder) {
      onToggleFolder(item.path);
      return;
    }
    onOpenFile(item.path);
  };

  return (
    <Pressable
      className="flex-row items-center min-h-11 px-3 py-1.5 rounded-xl mx-2"
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={isFolder
        ? `${expanded ? "Collapse" : "Expand"} folder ${item.name}`
        : `Open file ${item.name}`
      }
      style={({ pressed }) => [
        { paddingLeft: 12 + depth * 14 },
        pressed && { backgroundColor: pressedBg },
        isIgnored && { opacity: 0.55 },
      ]}
    >
      {isFolder ? (
        <Text
          className="w-[14px] mr-1 text-[10px] text-text-secondary"
        >
          {expanded ? "▼" : "▶"}
        </Text>
      ) : (
        <Box className="w-[14px] mr-1" />
      )}
      <Box className="w-[22px] h-[22px] rounded-[6px] overflow-hidden items-center justify-center mr-1.5">
        {isFolder ? (
          <FolderIconByType
            name={item.name}
            expanded={expanded}
            color={folderIconColor}
          />
        ) : (
          <FileIconByType name={item.name} color={fileColor} />
        )}
      </Box>
      <Text
        className="flex-1 text-sm"
        numberOfLines={1}
        style={{
          color: isIgnored ? rootColorSecondary : rootColorPrimary,
          fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
        }}
      >
        {item.name}
      </Text>
    </Pressable>
  );
}

