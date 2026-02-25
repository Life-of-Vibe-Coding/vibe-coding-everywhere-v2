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

type FileTreePaneStyles = {
  workspaceName: any;
  workspaceNameText: any;
  searchBarContainer: any;
  loading: any;
  scroll: any;
  scrollContent: any;
};

type FileTreePaneProps = {
  styles: FileTreePaneStyles;
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
  styles,
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
      <Box style={styles.workspaceName}>
        <Text style={styles.workspaceNameText} numberOfLines={2}>
          {root ?? "Workspace"}
        </Text>
      </Box>
      <Box style={styles.searchBarContainer}>
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
        <Box style={styles.loading}>
          <Spinner size="small" color={theme.colors.accent} />
        </Box>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          {filteredTree.map((item) => renderItem(item, 0))}
        </ScrollView>
      )}
    </>
  );
}
