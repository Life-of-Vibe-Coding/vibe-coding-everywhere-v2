import React from "react";
import { getTheme, type Provider as BrandProvider } from "@/theme/index";
import { triggerHaptic } from "@/design-system";
import { ClaudeIcon, GeminiIcon, CodexIcon } from "@/components/icons/ProviderIcons";
import { Box } from "@/components/ui/box";
import { Text as GluestackText } from "@/components/ui/text";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
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

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[75]}>
      <ActionsheetBackdrop />
      <ActionsheetContent style={{ backgroundColor: surfaceColor, opacity: 1 }}>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <ActionsheetScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {providers.map((p) => {
            const opts = providerModelOptions[p];
            if (opts.length === 0) return null;

            const ProviderIcon = p === "claude" ? ClaudeIcon : p === "gemini" ? GeminiIcon : CodexIcon;
            const accent = getTheme(p, themeMode).colors.accent;
            const isActiveProvider = (entryModel: string) => currentProvider === p && model === entryModel;

            return (
              <Box key={p} className="mb-4">
                <Box className="flex-row items-center gap-2 mb-1.5 px-0.5">
                  <ProviderIcon size={18} color={accent} />
                  <GluestackText size="xs" bold className="text-typography-600">
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </GluestackText>
                </Box>
                {opts.map((opt) => {
                  return (
                    <ActionsheetItem
                      key={opt.value}
                      onPress={() => {
                        triggerHaptic("selection");
                        if (currentProvider !== p) onProviderChange(p);
                        onModelChange(opt.value);
                        onClose();
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ minHeight: 48 }}
                    >
                      <ActionsheetItemText bold={isActiveProvider(opt.value)}>{opt.label}</ActionsheetItemText>
                    </ActionsheetItem>
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
