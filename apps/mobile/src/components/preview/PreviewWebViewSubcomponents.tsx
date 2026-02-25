import React from "react";
import { Platform } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { ScrollView } from "@/components/ui/scroll-view";
import { Spinner } from "@/components/ui/spinner";
import { Input, InputField } from "@/components/ui/input";
import { TabBarPills } from "@/components/reusable/TabBarPills";
import type { DesignTheme } from "@/theme/index";

type PreviewWebViewTopBarProps = {
  insetsTop: number;
  tabs: { id: string }[];
  activeIndex: number;
  onClose: () => void;
  onAddTab: () => void;
  onCloseCurrentTab: () => void;
  onSelectTab: (index: number) => void;
};

const toolbarHeight = Platform.OS === "ios" ? 52 : 48;

export function PreviewWebViewTopBar({
  insetsTop,
  tabs,
  activeIndex,
  onClose,
  onAddTab,
  onCloseCurrentTab,
  onSelectTab,
}: PreviewWebViewTopBarProps) {
  return (
    <Box
      className="flex-row items-center border-b border-outline-300 bg-surface-alt px-3 pb-2"
      style={{
        paddingTop: insetsTop,
        minHeight: toolbarHeight,
      }}
    >
      <Pressable
        className="mr-2 h-11 min-w-11 px-3 items-center justify-center rounded-xl bg-background-100 border border-outline-200 active:bg-background-200"
        onPress={onClose}
        accessibilityLabel="Close preview"
        accessibilityRole="button"
      >
        <Text className="text-sm font-semibold text-text-primary">Close</Text>
      </Pressable>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="flex-row items-center gap-2"
        className="max-w-full flex-1"
      >
        <TabBarPills
          tabs={tabs.map((_, i) => ({
            key: String(i),
            label: `Tab ${i + 1}`,
          }))}
          value={String(activeIndex)}
          onChange={(next) => onSelectTab(Number(next))}
          variant="segment"
        />
      </ScrollView>
      <Pressable
        className="ml-2 h-11 w-11 items-center justify-center rounded-xl bg-background-100 border border-outline-200 active:bg-background-200"
        onPress={onAddTab}
        accessibilityLabel="Add tab"
        accessibilityRole="button"
      >
        <Text className="text-xl font-semibold text-text-primary">+</Text>
      </Pressable>
      {tabs.length > 1 ? (
        <Pressable
          className="ml-1.5 h-11 w-11 items-center justify-center rounded-xl bg-background-100 border border-outline-200 active:bg-background-200"
          onPress={onCloseCurrentTab}
          accessibilityLabel="Close current tab"
          accessibilityRole="button"
        >
          <Text className="text-lg text-text-secondary">-</Text>
        </Pressable>
      ) : null}
    </Box>
  );
}

type PreviewWebViewAddressBarProps = {
  value: string;
  onChangeText: (next: string) => void;
  onSubmit: () => void;
  onReload: () => void;
  onFullscreen: () => void;
  resolvedUrl: string;
  loading: boolean;
  theme: DesignTheme;
};

export function PreviewWebViewAddressBar({
  value,
  onChangeText,
  onSubmit,
  onReload,
  onFullscreen,
  resolvedUrl,
  loading,
  theme,
}: PreviewWebViewAddressBarProps) {
  const inputStyle =
    Platform.OS === "web"
      ? {
          whiteSpace: "nowrap" as const,
          overflowX: "auto" as const,
        }
      : {};

  return (
    <Box className="flex-row items-center border-b border-outline-300 bg-surface-alt px-3 py-2">
      <Box className="mr-2 min-h-11 min-w-0 flex-1 justify-center rounded-xl px-4 border border-outline-200" style={{ backgroundColor: theme.colors.surface }}>
        <Input variant="outline" size="md" className="border-0 bg-transparent flex-1 min-w-0">
          <InputField
            value={value}
            onChangeText={onChangeText}
            placeholder="Search or enter URL"
            placeholderTextColor={theme.colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
            selectTextOnFocus
            className="text-[15px] text-text-primary p-0"
            style={{
              fontSize: 15,
              color: theme.colors.textPrimary,
              paddingVertical: 0,
              paddingHorizontal: 0,
              ...inputStyle,
            }}
          />
        </Input>
      </Box>
      <Pressable
        className="h-11 min-w-11 px-3 items-center justify-center rounded-xl bg-background-100 border border-outline-200 active:bg-background-200"
        onPress={onReload}
        disabled={loading && !!resolvedUrl}
        accessibilityLabel="Reload"
        accessibilityRole="button"
      >
        {loading && resolvedUrl ? (
          <Spinner size="small" color={theme.colors.accent} />
        ) : (
          <Text className="text-sm font-semibold text-text-primary">{resolvedUrl ? "Reload" : "Go"}</Text>
        )}
      </Pressable>
      {!!resolvedUrl ? (
        <Pressable
          className="ml-1.5 h-11 min-w-11 px-3 items-center justify-center rounded-xl bg-background-100 border border-outline-200 active:bg-background-200"
          onPress={onFullscreen}
          accessibilityLabel="Full screen"
          accessibilityRole="button"
        >
          <Text className="text-xs font-semibold text-text-primary">Full</Text>
        </Pressable>
      ) : null}
    </Box>
  );
}
