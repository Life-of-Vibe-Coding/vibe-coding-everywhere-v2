import React from "react";
import { getTheme, type Provider as BrandProvider } from "@/theme/index";
import { triggerHaptic } from "@/design-system";
import { ClaudeIcon, GeminiIcon, CodexIcon } from "@/components/icons/ProviderIcons";
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
  const isDark = themeMode === "dark";
  const contentSurface = isDark ? "rgba(6, 10, 20, 0.95)" : surfaceColor;
  const sectionSurface = isDark ? "rgba(13, 20, 36, 0.82)" : "rgba(248, 250, 252, 0.95)";
  const sectionBorder = isDark ? "rgba(162, 210, 255, 0.25)" : "rgba(15, 23, 42, 0.1)";
  const headingColor = isDark ? "#E6F3FF" : "#0F172A";
  const mutedHeadingColor = isDark ? "rgba(216, 235, 255, 0.78)" : "#334155";

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[75]}>
      <ActionsheetBackdrop className="bg-background-dark/75" />
      <ActionsheetContent
        style={{
          backgroundColor: contentSurface,
          opacity: 1,
          borderColor: sectionBorder,
          borderWidth: 1,
        }}
      >
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator style={{ backgroundColor: isDark ? "rgba(216, 235, 255, 0.48)" : "rgba(51, 65, 85, 0.36)" }} />
        </ActionsheetDragIndicatorWrapper>
        <Box className="w-full px-1 pb-2">
          <GluestackText size="sm" bold style={{ color: headingColor }}>
            Select Model
          </GluestackText>
          <GluestackText size="xs" style={{ color: mutedHeadingColor }}>
            Choose provider and model for this chat session
          </GluestackText>
        </Box>
        <ActionsheetScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {providers.map((p) => {
            const opts = providerModelOptions[p];
            if (opts.length === 0) return null;

            const ProviderIcon = p === "claude" ? ClaudeIcon : p === "gemini" ? GeminiIcon : CodexIcon;
            const accent = getTheme(p, themeMode).colors.accent;
            const isActiveProvider = (entryModel: string) => currentProvider === p && model === entryModel;

            return (
              <Box
                key={p}
                className="mb-4 rounded-2xl p-2.5"
                style={{
                  backgroundColor: sectionSurface,
                  borderWidth: 1,
                  borderColor: sectionBorder,
                }}
              >
                <Box className="flex-row items-center gap-2 mb-2 px-1">
                  <ProviderIcon size={18} color={accent} />
                  <GluestackText size="xs" bold style={{ color: headingColor }}>
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
                      itemClassName="rounded-xl"
                      itemStyle={({ pressed }) => ({
                        borderWidth: 1,
                        borderColor: selected
                          ? isDark
                            ? "rgba(179, 223, 255, 0.42)"
                            : "rgba(15, 23, 42, 0.2)"
                          : "transparent",
                        backgroundColor: selected
                          ? isDark
                            ? "rgba(139, 117, 255, 0.2)"
                            : "rgba(15, 23, 42, 0.08)"
                          : pressed
                            ? isDark
                              ? "rgba(173, 222, 255, 0.12)"
                              : "rgba(15, 23, 42, 0.06)"
                            : "transparent",
                      })}
                      labelStyle={{
                        color: selected ? headingColor : mutedHeadingColor,
                        fontWeight: selected ? "700" : "500",
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
