import React from "react";
import { getTheme, type Provider as BrandProvider } from "@/theme/index";
import { BlurView } from "expo-blur";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { triggerHaptic } from "@/design-system";
import {
  ClaudeIcon,
  GeminiIcon,
  CodexIcon,
} from "@/components/icons/ProviderIcons";
import { Box } from "@/components/ui/box";
import { Text as GluestackText } from "@/components/ui/text";
import { ActionsheetOptionRow } from "@/components/reusable/ActionsheetOptionRow";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from "@/components/ui/actionsheet";

type ModelOption = { value: string; label: string };
type ProviderModelOptions = {
  claude: ModelOption[];
  gemini: ModelOption[];
  codex: ModelOption[];
};

interface ModelPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  provider: BrandProvider;
  model: string;
  themeMode: "light" | "dark";
  surfaceColor: string;
  providerModelOptions: ProviderModelOptions;
  onProviderChange: (provider: BrandProvider) => void;
  onModelChange: (model: string) => void;
}

export function ModelPickerSheet({
  isOpen,
  onClose,
  provider,
  model,
  themeMode,
  surfaceColor,
  providerModelOptions,
  onProviderChange,
  onModelChange,
}: ModelPickerSheetProps) {
  const providers = ["claude", "gemini", "codex"] as const;
  const currentProvider = provider;
  const { bottom } = useSafeAreaInsets();
  const isDark = themeMode === "dark";
  const theme = getTheme(currentProvider, themeMode);
  const contentSurface = isDark ? theme.colors.surface : surfaceColor;
  const sectionSurface = isDark
    ? theme.colors.surfaceAlt
    : theme.colors.surfaceAlt;
  const sectionBorder = isDark
    ? theme.colors.border
    : theme.colors.border;
  const headingColor = isDark ? theme.colors.textPrimary : theme.colors.textPrimary;
  const mutedHeadingColor = isDark ? theme.colors.textMuted : theme.colors.textMuted;

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[75, 100]}>
      <ActionsheetBackdrop className="bg-background-dark/75" />
      <ActionsheetContent
        style={{
          backgroundColor: isDark ? "rgba(15, 23, 42, 0.85)" : "rgba(255, 255, 255, 0.85)",
          opacity: 1,
          borderColor: sectionBorder,
          borderTopWidth: 1,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          overflow: "hidden"
        }}
      >
        <BlurView intensity={isDark ? 40 : 80} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator
            style={{
              backgroundColor: isDark
                ? "rgba(216, 235, 255, 0.48)"
                : "rgba(51, 65, 85, 0.36)",
            }}
          />
        </ActionsheetDragIndicatorWrapper>
        <Box className="w-full px-3 pb-4 pt-1">
          <GluestackText size="md" bold style={{ color: headingColor }}>
            Select Model
          </GluestackText>
          <GluestackText
            size="xs"
            style={{ color: mutedHeadingColor, marginTop: 4 }}
          >
            Choose provider and model for this chat session
          </GluestackText>
        </Box>
        <ActionsheetScrollView
          contentContainerStyle={{ paddingBottom: Math.max(bottom, 24) + 16 }}
          showsVerticalScrollIndicator={false}
        >
          {providers.map((p) => {
            const opts = providerModelOptions[p];
            if (opts.length === 0) return null;

            const ProviderIcon =
              p === "claude"
                ? ClaudeIcon
                : p === "gemini"
                  ? GeminiIcon
                  : CodexIcon;
            const theme = getTheme(p, themeMode);
            const accent = theme.colors.accent;
            const isActiveProvider = (entryModel: string) =>
              currentProvider === p && model === entryModel;

            return (
              <Box
                key={p}
                className="mb-3 rounded-2xl p-2"
                style={{
                  backgroundColor:
                    currentProvider === p
                      ? isDark
                        ? theme.colors.surfaceAlt
                        : sectionSurface
                      : sectionSurface,
                  borderWidth: 1,
                  borderColor: currentProvider === p ? accent : sectionBorder,
                }}
              >
                <Box className="flex-row items-center gap-2 mb-1 px-2">
                  <ProviderIcon size={18} color={accent} />
                  <GluestackText size="sm" bold style={{ color: headingColor }}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </GluestackText>
                </Box>
                {opts.map((opt) => {
                  const selected = isActiveProvider(opt.value);
                  return (
                    <ActionsheetOptionRow
                      key={opt.value}
                      label={opt.label}
                      selected={selected}
                      minHeight={40}
                      itemClassName="rounded-xl"
                      itemStyle={({ pressed }) => ({
                        paddingVertical: 4,
                        borderWidth: 1,
                        borderColor: selected ? accent : "transparent",
                        backgroundColor: selected
                          ? isDark
                            ? theme.colors.skeletonHighlight
                            : `${accent}1A`
                          : pressed
                            ? isDark
                              ? theme.colors.skeleton
                              : "rgba(15, 23, 42, 0.06)"
                            : "transparent",
                      })}
                      labelStyle={{
                        color: selected ? accent : mutedHeadingColor,
                        fontWeight: selected ? "700" : "500",
                        fontSize: 14,
                      }}
                      selectedIndicatorLabel="Selected"
                      selectedIndicatorStyle={{ color: accent }}
                      onPress={() => {
                        triggerHaptic("selection");
                        if (currentProvider !== p) onProviderChange(p);
                        onModelChange(opt.value);
                        onClose();
                      }}
                    />
                  );
                })}
              </Box>
            );
          })}
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}
