import React from "react";

import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { ScrollView } from "@/components/ui/scroll-view";
import { Spinner } from "@/components/ui/spinner";
import { Input, InputField } from "@/components/ui/input";
import { useTheme } from "@/theme/index";

export type WorkspaceTreeItem = {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: WorkspaceTreeItem[];
};

type FileTreePaneProps = {
  theme: ReturnType<typeof useTheme>;
  root?: string;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  loading: boolean;
  hasData: boolean;
  filteredTree: WorkspaceTreeItem[];
  renderItem: (item: WorkspaceTreeItem, depth: number) => React.ReactNode;
};

export function FileTreePane({
  theme,
  root,
  searchQuery,
  onSearchQueryChange,
  loading,
  hasData,
  filteredTree,
  renderItem,
}: FileTreePaneProps) {
  return (
    <>
      <Box className="py-1.5 px-3.5 bg-background-0">
        <Text
          className="text-sm leading-5 font-medium text-text-primary"
          numberOfLines={2}
        >
          {root ?? "Workspace"}
        </Text>
      </Box>
      <Box className="px-3 pt-1 pb-2 bg-background-0">
        <Input variant="outline" size="md" className="flex-1">
          <InputField
            placeholder="Search files..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={onSearchQueryChange}
            returnKeyType="search"
          />
        </Input>
      </Box>
      {loading && !hasData ? (
        <Box className="flex-1 items-center justify-center py-6 bg-background-0">
          <Spinner size="small" color={theme.colors.accent} />
        </Box>
      ) : (
        <ScrollView
          className="flex-1 min-h-0 bg-background-0"
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          {filteredTree.map((item) => renderItem(item, 0))}
        </ScrollView>
      )}
    </>
  );
}
