import React, { useState, useCallback, useEffect } from "react";
import { Platform, Keyboard, AccessibilityInfo } from "react-native";
import { CodexSendIcon } from "../icons/ProviderIcons";
import {
  AttachPlusIcon,
  ChevronDownIcon,
  CloseIcon,
  GlobeIcon,
  StopCircleIcon,
  TerminalIcon,
} from "../icons/ChatActionIcons";
import { EntranceAnimation, triggerHaptic } from "../../design-system";
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
} from "../../../components/ui/actionsheet";
import { Badge, BadgeText } from "../../../components/ui/badge";
import { Box } from "../../../components/ui/box";
import { Button, ButtonIcon } from "../../../components/ui/button";
import { Pressable } from "../../../components/ui/pressable";
import { Text } from "../../../components/ui/text";
import { Textarea, TextareaInput } from "../../../components/ui/textarea";
import { VStack } from "../../../components/ui/vstack";
import { HStack } from "../../../components/ui/hstack";
import { useTheme } from "../../theme/index";
import { getFileName } from "../../utils/path";
import { cn } from "../../utils/cn";

const DEFAULT_PLACEHOLDER = "How can I help you today?";
const INPUT_PLACEHOLDER = "Type response for Claude…";

export type PendingCodeRef = {
  path: string;
  startLine: number;
  endLine: number;
  snippet: string;
};

export interface InputPanelProps {
  connected: boolean;
  agentRunning: boolean;
  waitingForUserInput: boolean;
  permissionMode: string | null;
  onPermissionModeChange: (mode: string) => void;
  onSubmit: (prompt: string, permissionMode?: string) => void;
  pendingCodeRefs?: PendingCodeRef[];
  onRemoveCodeRef?: (index: number) => void;
  onTerminateAgent?: () => void;
  onOpenWebPreview?: () => void;
  onOpenProcesses?: () => void;
  provider?: "claude" | "gemini" | "codex" | "pi";
  model?: string;
  modelOptions?: { value: string; label: string }[];
  providerModelOptions?: Record<"claude" | "gemini" | "codex", { value: string; label: string }[]>;
  onProviderChange?: (provider: "claude" | "gemini" | "codex" | "pi") => void;
  onModelChange?: (model: string) => void;
  onOpenSkillsConfig?: () => void;
  onOpenDocker?: () => void;
}

export function InputPanel({
  connected,
  agentRunning,
  waitingForUserInput,
  permissionMode,
  onPermissionModeChange,
  onSubmit,
  pendingCodeRefs = [],
  onRemoveCodeRef,
  onTerminateAgent,
  onOpenWebPreview,
  onOpenProcesses,
  provider = "pi",
  model = "gemini-2.5-flash",
  modelOptions = [],
  providerModelOptions,
  onProviderChange,
  onModelChange,
  onOpenSkillsConfig,
  onOpenDocker,
}: InputPanelProps) {
  const theme = useTheme();
  const [prompt, setPrompt] = useState("");
  const [modelPickerVisible, setModelPickerVisible] = useState(false);
  const [addDropdownVisible, setAddDropdownVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);

  const currentModelLabel =
    modelOptions.find((m) => m.value === model)?.label ??
    (model?.startsWith("claude-") ? model.slice(7) : model ?? "");

  const disabled = !waitingForUserInput && agentRunning;
  const placeholder = waitingForUserInput ? INPUT_PLACEHOLDER : DEFAULT_PLACEHOLDER;

  const handleSubmit = useCallback(() => {
    const trimmed = prompt.trim();
    if (!trimmed && !pendingCodeRefs.length) return;
    Keyboard.dismiss();
    triggerHaptic("medium");
    if (waitingForUserInput && agentRunning) {
      onSubmit(trimmed, permissionMode ?? undefined);
      setPrompt("");
      return;
    }
    if (agentRunning) return;
    onSubmit(trimmed || "See code references below.", permissionMode ?? undefined);
    setPrompt("");
  }, [prompt, pendingCodeRefs.length, waitingForUserInput, agentRunning, permissionMode, onSubmit]);

  return (
    <Box>
      <VStack
        space="md"
        className={cn(
          "flex-col gap-3 border border-outline-400 rounded-2xl py-3 px-4 bg-surface",
          "shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
        )}
      >
        {pendingCodeRefs.length > 0 && (
          <HStack space="sm" className="flex-row flex-wrap gap-2 mb-0.5">
            {pendingCodeRefs.map((ref, index) => {
              const key = `${ref.path}-${ref.startLine}-${index}`;
              const range =
                ref.startLine === ref.endLine ? String(ref.startLine) : `${ref.startLine}-${ref.endLine}`;
              const label = `${getFileName(ref.path)} (${range})`;
              const badge = (
                <Badge action="info" variant="solid" size="md" className="pr-1">
                  <BadgeText>{label}</BadgeText>
                  {onRemoveCodeRef && (
                    <Pressable
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => {
                        triggerHaptic("selection");
                        onRemoveCodeRef(index);
                      }}
                      className="min-w-11 min-h-11 items-center justify-center ml-1"
                      accessibilityLabel="Remove code reference"
                    >
                      <Box
                        className="w-6 h-6 rounded-full items-center justify-center bg-primary-500/20"
                      >
                        <CloseIcon size={12} color={theme.colors.textPrimary} />
                      </Box>
                    </Pressable>
                  )}
                </Badge>
              );
              return reduceMotion ? (
                <Box key={key}>{badge}</Box>
              ) : (
                <EntranceAnimation key={key} variant="scale" delay={index * 50}>
                  {badge}
                </EntranceAnimation>
              );
            })}
          </HStack>
        )}
        <HStack space="md" className="flex-row items-center gap-3 min-h-11">
          <Textarea
            size="md"
            isDisabled={disabled}
            className="flex-1 min-h-10 h-auto max-h-37.5 rounded-lg border border-background-300"
          >
            <TextareaInput
              placeholder={placeholder}
              value={prompt}
              onChangeText={setPrompt}
              editable={!disabled}
              maxLength={8000}
              blurOnSubmit={false}
              onSubmitEditing={handleSubmit}
              returnKeyType="default"
              autoCapitalize="sentences"
              autoCorrect
              autoComplete="off"
              textAlignVertical={Platform.OS === "android" ? "top" : "center"}
              className={cn(
                "flex-1 text-base py-2 min-h-6",
                Platform.OS === "android" && "text-start"
              )}
              placeholderTextColor={theme.colors.textMuted}
            />
          </Textarea>
          <Box
            className={cn(
              "w-2 h-2 rounded-full self-center",
              connected ? "bg-success-500 opacity-100" : "bg-background-400 opacity-50"
            )}
          />
        </HStack>
        <HStack space="sm" className="flex-row items-center justify-between gap-2 flex-nowrap">
          <HStack space="sm" className="flex-1 flex-row items-center gap-2 min-w-0">
            {(onOpenSkillsConfig || onOpenDocker) && (
              <>
                <Button
                  action="default"
                  variant="outline"
                  size="md"
                  onPress={() => {
                    triggerHaptic("selection");
                    setAddDropdownVisible(true);
                  }}
                  accessibilityLabel="Add options"
                  className="w-11 h-11 rounded-lg bg-background-muted"
                >
                  <ButtonIcon as={AttachPlusIcon} size="md" style={{ color: theme.colors.accent }} />
                </Button>
                <Actionsheet isOpen={addDropdownVisible} onClose={() => setAddDropdownVisible(false)}>
                  <ActionsheetBackdrop />
                  <ActionsheetContent>
                    <ActionsheetDragIndicatorWrapper>
                      <ActionsheetDragIndicator />
                    </ActionsheetDragIndicatorWrapper>
                    {onOpenSkillsConfig && (
                      <ActionsheetItem
                        onPress={() => {
                          triggerHaptic("selection");
                          onOpenSkillsConfig();
                          setAddDropdownVisible(false);
                        }}
                      >
                        <ActionsheetItemText>Skill Configuration</ActionsheetItemText>
                      </ActionsheetItem>
                    )}
                    {onOpenDocker && (
                      <ActionsheetItem
                        onPress={() => {
                          triggerHaptic("selection");
                          onOpenDocker();
                          setAddDropdownVisible(false);
                        }}
                      >
                        <ActionsheetItemText>Docker Manager</ActionsheetItemText>
                      </ActionsheetItem>
                    )}
                  </ActionsheetContent>
                </Actionsheet>
              </>
            )}
            <Pressable
              onPress={() => {
                triggerHaptic("selection");
                onModelChange ? setModelPickerVisible(true) : null;
              }}
              disabled={!onModelChange}
              accessibilityLabel="Select model"
              className={cn(
                "flex-1 flex-row items-center gap-0.5 py-0.5 px-1 rounded-lg border min-h-11 min-w-0 max-w-35 justify-start",
                "bg-surface-alt border-outline-400"
              )}
            >
              <Text
                size="sm"
                bold
                numberOfLines={2}
                ellipsizeMode="tail"
                className="flex-1 min-w-0 text-typography-600"
              >
                {currentModelLabel}
              </Text>
              <Box className="shrink-0 self-center">
                <ChevronDownIcon size={12} color={theme.colors.textMuted} />
              </Box>
            </Pressable>
          </HStack>
          <HStack space="sm" className="flex-row items-center gap-2 shrink-0">
            {onOpenProcesses && (
              <Button
                action="secondary"
                variant="outline"
                size="md"
                onPress={onOpenProcesses}
                accessibilityLabel="Open processes dashboard"
                className="w-11 h-11 rounded-lg"
              >
                <ButtonIcon as={TerminalIcon} size="md" />
              </Button>
            )}
            {onOpenWebPreview && (
              <Button
                action="secondary"
                variant="outline"
                size="md"
                onPress={onOpenWebPreview}
                accessibilityLabel="Open web preview"
                className="w-11 h-11 rounded-lg"
              >
                <ButtonIcon as={GlobeIcon} size="md" />
              </Button>
            )}
            {onTerminateAgent && agentRunning && (
              <Button
                action="negative"
                variant="solid"
                size="md"
                onPress={() => {
                  triggerHaptic("heavy");
                  onTerminateAgent();
                }}
                accessibilityLabel="Terminate agent response"
                className="w-11 h-11 rounded-lg"
              >
                <ButtonIcon as={StopCircleIcon} size="md" />
              </Button>
            )}
            {!(agentRunning && !waitingForUserInput) && (
              <Button
                action="primary"
                variant="solid"
                size="md"
                onPress={handleSubmit}
                isDisabled={disabled}
                accessibilityLabel="Send message"
                className="w-11 h-11 rounded-lg"
              >
                <ButtonIcon as={CodexSendIcon} size="md" />
              </Button>
            )}
          </HStack>
        </HStack>
      </VStack>

      <Actionsheet isOpen={modelPickerVisible} onClose={() => setModelPickerVisible(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          {providerModelOptions && onProviderChange ? (
            (["claude", "gemini", "codex"] as const).map((p) => {
              const opts = providerModelOptions[p] ?? [];
              if (opts.length === 0) return null;
              const currentProvider = provider === "pi" ? "codex" : provider;
              return (
                <Box key={p} className="mb-3">
                  <Box className="flex-row items-center mb-1 px-0.5">
                    <Text size="xs" bold className="text-typography-600">
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </Box>
                  {opts.map((opt) => {
                    const isActive = currentProvider === p && model === opt.value;
                    return (
                      <ActionsheetItem
                        key={opt.value}
                        onPress={() => {
                          triggerHaptic("selection");
                          if (currentProvider !== p) onProviderChange(p);
                          onModelChange?.(opt.value);
                          setModelPickerVisible(false);
                        }}
                      >
                        <ActionsheetItemText bold={isActive}>{opt.label}</ActionsheetItemText>
                      </ActionsheetItem>
                    );
                  })}
                </Box>
              );
            })
          ) : (
            modelOptions.map((opt) => (
              <ActionsheetItem
                key={opt.value}
                onPress={() => {
                  triggerHaptic("selection");
                  onModelChange?.(opt.value);
                  setModelPickerVisible(false);
                }}
              >
                <ActionsheetItemText bold={model === opt.value}>{opt.label}</ActionsheetItemText>
              </ActionsheetItem>
            ))
          )}
        </ActionsheetContent>
      </Actionsheet>
    </Box>
  );
}
