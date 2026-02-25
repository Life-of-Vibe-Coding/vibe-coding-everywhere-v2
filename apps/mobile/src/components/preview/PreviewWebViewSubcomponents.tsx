import React from "react";
import { Platform, StyleSheet, useWindowDimensions, Keyboard } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { ScrollView } from "@/components/ui/scroll-view";
import { Spinner } from "@/components/ui/spinner";
import { Input, InputField } from "@/components/ui/input";
import type { DesignTheme } from "@/theme/index";
import Svg, { Path, Rect, Circle, Line, Polyline, Polygon } from "react-native-svg";

const Icons = {
  Lock: ({ color, size }: { color: string; size: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="11" width="18" height="11" rx="2" ry="2"></Rect>
      <Path d="M7 11V7a5 5 0 0110 0v4"></Path>
    </Svg>
  ),
  Refresh: ({ color, size }: { color: string; size: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 2v6h-6"></Path>
      <Path d="M3 12a9 9 0 0115-6.7L21 8"></Path>
      <Path d="M3 22v-6h6"></Path>
      <Path d="M21 12a9 9 0 01-15 6.7L3 16"></Path>
    </Svg>
  ),
  Globe: ({ color, size }: { color: string; size: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="10"></Circle>
      <Line x1="2" y1="12" x2="22" y2="12"></Line>
      <Path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"></Path>
    </Svg>
  ),
  Search: ({ color, size }: { color: string; size: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="11" cy="11" r="8"></Circle>
      <Line x1="21" y1="21" x2="16.65" y2="16.65"></Line>
    </Svg>
  ),
  Bookmark: ({ color, size }: { color: string; size: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"></Path>
    </Svg>
  ),
  History: ({ color, size }: { color: string; size: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="10"></Circle>
      <Path d="M12 6v6l4 2"></Path>
    </Svg>
  ),
  Download: ({ color, size }: { color: string; size: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"></Path>
      <Polyline points="7 10 12 15 17 10"></Polyline>
      <Line x1="12" y1="15" x2="12" y2="3"></Line>
    </Svg>
  ),
  ChevronLeft: ({ color, size }: { color: string; size: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 18l-6-6 6-6"></Path>
    </Svg>
  ),
  ChevronRight: ({ color, size }: { color: string; size: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 18l6-6-6-6"></Path>
    </Svg>
  ),
  Home: ({ color, size }: { color: string; size: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"></Path>
      <Polyline points="9 22 9 12 15 12 15 22"></Polyline>
    </Svg>
  ),
  Layers: ({ color, size }: { color: string; size: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Polygon points="12 2 2 7 12 12 22 7 12 2"></Polygon>
      <Polyline points="2 17 12 22 22 17"></Polyline>
      <Polyline points="2 12 12 17 22 12"></Polyline>
    </Svg>
  ),
  MoreVertical: ({ color, size }: { color: string; size: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="1"></Circle>
      <Circle cx="12" cy="5" r="1"></Circle>
      <Circle cx="12" cy="19" r="1"></Circle>
    </Svg>
  ),
  Plus: ({ color, size }: { color: string; size: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Line x1="12" y1="5" x2="12" y2="19"></Line>
      <Line x1="5" y1="12" x2="19" y2="12"></Line>
    </Svg>
  ),
  X: ({ color, size }: { color: string; size: number }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Line x1="18" y1="6" x2="6" y2="18"></Line>
      <Line x1="6" y1="6" x2="18" y2="18"></Line>
    </Svg>
  ),
};

// Removed custom wrappers as we now import them directly

type PreviewWebViewAddressBarProps = {
  value: string;
  onChangeText: (next: string) => void;
  onSubmit: () => void;
  onReload: () => void;
  onFullscreen: () => void;
  resolvedUrl: string;
  loading: boolean;
  theme: DesignTheme;
  insetsTop: number;
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
  insetsTop,
}: PreviewWebViewAddressBarProps) {
  const inputStyle =
    Platform.OS === "web"
      ? {
        whiteSpace: "nowrap" as const,
        overflowX: "auto" as const,
      }
      : {};

  const focusInput = () => {
    // Optional focus trigger
  };

  return (
    <Box
      className="bg-surface border-b border-outline-200 px-4 pb-3"
      style={{ paddingTop: insetsTop > 0 ? insetsTop : 16 }}
    >
      <Box className="flex-row items-center bg-surface-alt rounded-xl h-12 px-3">
        <Box className="mr-2">
          <Icons.Lock color={theme.colors.textSecondary} size={16} />
        </Box>
        <Input variant="outline" size="md" className="flex-1 min-w-0 border-0 bg-transparent h-full px-0">
          <InputField
            value={value}
            onChangeText={onChangeText}
            placeholder="Search or enter website name"
            placeholderTextColor={theme.colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
            selectTextOnFocus
            className="text-[15px] font-medium text-text-primary text-center p-0"
            style={{
              fontSize: 15,
              color: theme.colors.textPrimary,
              paddingVertical: 0,
              paddingHorizontal: 0,
              ...inputStyle,
            }}
          />
        </Input>
        <Pressable
          className="ml-2 h-8 w-8 items-center justify-center rounded-full active:bg-outline-200"
          onPress={onReload}
          disabled={loading && !!resolvedUrl}
          accessibilityLabel="Reload"
          accessibilityRole="button"
        >
          {loading && !!resolvedUrl ? (
            <Spinner size="small" color={theme.colors.textSecondary} />
          ) : (
            <Icons.Refresh color={theme.colors.textSecondary} size={18} />
          )}
        </Pressable>
      </Box>
    </Box>
  );
}

export function PreviewWebViewPlaceholder({ onStartBrowsing, theme }: { onStartBrowsing: () => void; theme: DesignTheme }) {
  return (
    <Box className="flex-1 items-center justify-start pt-16 px-6 bg-surface">
      <Box className="w-64 h-64 rounded-full bg-[#EAF2FF] items-center justify-center mb-8">
        <Box className="w-16 h-16 rounded-full bg-[#1A65FF] items-center justify-center">
          <Icons.Globe color="#fff" size={32} />
        </Box>
      </Box>
      <Text className="text-[26px] font-bold text-[#0D1526] mb-4 text-center">Vibe Coding Everywhere</Text>
      <Text className="text-[17px] text-[#556275] text-center mb-8 px-2 leading-6">
        Browse the web securely with a modern, lightweight interface designed for speed.
      </Text>

      <Pressable
        className="w-full h-14 bg-[#1A65FF] rounded-xl flex-row items-center justify-center mb-10"
        onPress={onStartBrowsing}
      >
        <Icons.Search color="#fff" size={20} />
        <Text className="text-white font-semibold text-[17px] ml-2">Start Browsing</Text>
      </Pressable>

      <Box className="flex-row items-center justify-between w-full px-4">
        <Box className="items-center">
          <Box className="w-14 h-14 rounded-full bg-[#F3F6FA] items-center justify-center mb-2">
            <Icons.Bookmark color="#1A65FF" size={24} />
          </Box>
          <Text className="text-[13px] text-[#556275]">Bookmarks</Text>
        </Box>
        <Box className="items-center">
          <Box className="w-14 h-14 rounded-full bg-[#F3F6FA] items-center justify-center mb-2">
            <Icons.History color="#1A65FF" size={24} />
          </Box>
          <Text className="text-[13px] text-[#556275]">History</Text>
        </Box>
        <Box className="items-center">
          <Box className="w-14 h-14 rounded-full bg-[#F3F6FA] items-center justify-center mb-2">
            <Icons.Download color="#1A65FF" size={24} />
          </Box>
          <Text className="text-[13px] text-[#556275]">Downloads</Text>
        </Box>
      </Box>
    </Box>
  );
}

export function PreviewWebViewBottomBar({
  onBack,
  onForward,
  onHome,
  tabCount,
  onShowTabs,
  onMenu,
  theme,
  canGoBack,
  canGoForward
}: {
  onBack: () => void;
  onForward: () => void;
  onHome: () => void;
  tabCount: number;
  onShowTabs: () => void;
  onMenu: () => void;
  theme: DesignTheme;
  canGoBack: boolean;
  canGoForward: boolean;
}) {
  const bottomBarStyles = StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 24,
      minHeight: 64,
      backgroundColor: theme.colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    iconButton: {
      padding: 8,
    },
    centerButtonShell: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      marginTop: -20,
      backgroundColor: "#1A65FF",
      shadowColor: "#1A65FF",
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    tabsButton: {
      padding: 8,
      position: "relative",
    },
    tabsBadge: {
      position: "absolute",
      top: 0,
      right: 0,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: "#1A65FF",
      alignItems: "center",
      justifyContent: "center",
    },
  });

  return (
    <Box style={bottomBarStyles.container}>
      <Pressable style={bottomBarStyles.iconButton} onPress={onBack} disabled={!canGoBack}>
        <Icons.ChevronLeft color={canGoBack ? theme.colors.textSecondary : theme.colors.border} size={24} />
      </Pressable>
      <Pressable style={bottomBarStyles.iconButton} onPress={onForward} disabled={!canGoForward}>
        <Icons.ChevronRight color={canGoForward ? theme.colors.textSecondary : theme.colors.border} size={24} />
      </Pressable>
      <Box style={bottomBarStyles.centerButtonShell}>
        <Pressable onPress={onHome} className="w-full h-full items-center justify-center rounded-full">
          <Icons.Home color="#fff" size={24} />
        </Pressable>
      </Box>
      <Pressable style={bottomBarStyles.tabsButton} onPress={onShowTabs}>
        <Icons.Layers color={theme.colors.textSecondary} size={24} />
        <Box style={bottomBarStyles.tabsBadge}>
          <Text className="text-[10px] text-white font-bold">{tabCount}</Text>
        </Box>
      </Pressable>
      <Pressable style={bottomBarStyles.iconButton} onPress={onMenu}>
        <Icons.MoreVertical color={theme.colors.textSecondary} size={24} />
      </Pressable>
    </Box>
  );
}

export function PreviewWebViewTabsPage({
  tabs,
  activeIndex,
  onSelectTab,
  onCloseTab,
  onAddTab,
  onDone,
  insetsTop,
  theme
}: {
  tabs: { id: string, url: string }[];
  activeIndex: number;
  onSelectTab: (index: number) => void;
  onCloseTab: (index: number) => void;
  onAddTab: () => void;
  onDone: () => void;
  insetsTop: number;
  theme: DesignTheme;
}) {
  return (
    <Box className="flex-1 bg-[#F5F7FA]">
      {/* Header */}
      <Box
        className="flex-row items-center justify-between px-4 pb-3 bg-surface border-b border-outline-200"
        style={{ paddingTop: insetsTop > 0 ? insetsTop : 16 }}
      >
        <Pressable onPress={onDone} className="p-2 -ml-2">
          <Text className="text-[17px] text-[#1A65FF] font-semibold">Tabs</Text>
        </Pressable>
        <Text className="text-[17px] text-text-primary font-bold">Vibe Coding Everywhere</Text>
        <Pressable onPress={onDone} className="p-2 -mr-2">
          <Text className="text-[17px] text-[#1A65FF] font-semibold">Done</Text>
        </Pressable>
      </Box>

      {/* Grid */}
      <ScrollView className="flex-1 px-4 pt-4">
        <Box className="flex-row flex-wrap justify-between">
          {tabs.map((tab, i) => {
            const domain = tab.url ? tab.url.replace(/^https?:\/\//, '').split('/')[0] : 'New Tab';
            const isActive = i === activeIndex;
            return (
              <Box
                key={tab.id}
                className={`w-[48%] bg-surface rounded-2xl overflow-hidden mb-4 border ${isActive ? 'border-[#1A65FF] border-2' : 'border-outline-200'}`}
              >
                <Pressable onPress={() => onSelectTab(i)} className="flex-1">
                  <Box className="h-32 bg-background-200 w-full relative">
                    {/* Placeholder image for tab content based on URL */}
                    <Box className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 items-center justify-center z-10">
                      <Pressable onPress={(e) => { e.stopPropagation(); onCloseTab(i); }}>
                        <Icons.X color="#fff" size={14} />
                      </Pressable>
                    </Box>
                  </Box>
                  <Box className="h-12 flex-row items-center px-3 bg-surface">
                    <Box className="w-5 h-5 rounded-full bg-[#F3F6FA] mr-2 items-center justify-center">
                      <Icons.Globe color="#556275" size={12} />
                    </Box>
                    <Text className="text-[14px] font-medium text-text-primary flex-1" numberOfLines={1}>{domain}</Text>
                  </Box>
                </Pressable>
              </Box>
            );
          })}
        </Box>
        <Box className="h-24" /> {/* Bottom padding */}
      </ScrollView>

      {/* Floating Action Button */}
      <Pressable
        className="absolute bottom-20 right-6 w-14 h-14 rounded-full bg-[#1A65FF] items-center justify-center shadow-md"
        style={{ shadowColor: '#1A65FF', shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 }}
        onPress={onAddTab}
      >
        <Icons.Plus color="#fff" size={28} />
      </Pressable>

      {/* Tab Nav */}
      <Box className="flex-row items-center justify-around px-2 h-16 bg-surface border-t border-outline-200">
        <Pressable className="p-3 items-center" onPress={() => onSelectTab(activeIndex)}>
          <Icons.Home color={theme.colors.textSecondary} size={22} />
        </Pressable>
        <Pressable className="p-3 items-center">
          <Icons.Search color={theme.colors.textSecondary} size={22} />
        </Pressable>
        <Pressable className="p-3 items-center">
          <Icons.History color={theme.colors.textSecondary} size={22} />
        </Pressable>
        <Pressable className="p-3 items-center">
          <Icons.Bookmark color={theme.colors.textSecondary} size={22} />
        </Pressable>
        <Pressable className="p-3 items-center">
          <Icons.Layers color="#1A65FF" size={22} />
        </Pressable>
      </Box>
    </Box>
  );
}
