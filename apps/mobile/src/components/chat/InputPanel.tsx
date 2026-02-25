import React, { useState, useCallback, useEffect } from "react";
import { Platform, Keyboard, AccessibilityInfo, Modal, TouchableWithoutFeedback } from "react-native";
import { ClaudeSendIcon, GeminiSendIcon, CodexSendIcon, CodexEnterIcon } from "@/components/icons/ProviderIcons";
import {
  AttachPlusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  DockerIcon,
  GlobeIcon,
  SkillIcon,
  StopCircleIcon,
  TerminalIcon,
} from "@/components/icons/ChatActionIcons";
import { EntranceAnimation, triggerHaptic } from "@/design-system";
import { Badge, BadgeText } from "@/components/ui/badge";
import { Box } from "@/components/ui/box";
import { Button, ButtonIcon } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { Textarea, TextareaInput } from "@/components/ui/textarea";
import { VStack } from "@/components/ui/vstack";
import { HStack } from "@/components/ui/hstack";
import { useTheme } from "@/theme/index";
import { getFileName } from "@/utils/path";
import { cn } from "@/utils/cn";

const DEFAULT_PLACEHOLDER = "How can I help you today?";
const INPUT_PLACEHOLDER = "Type response for Claude…";
const LINE_HEIGHT = 24;
const MAX_LINES = 4;
const MAX_INPUT_HEIGHT = LINE_HEIGHT * MAX_LINES;
const DEFAULT_INPUT_HEIGHT = LINE_HEIGHT + 8;
const INPUT_VERTICAL_PADDING = 16;

export type PendingCodeRef = {
  path: string;
  startLine: number;
  endLine: number;
  snippet: string;
};

export interface InputPanelProps {
  connected: boolean;
  sessionRunning: boolean;
  waitingForUserInput: boolean;
  permissionMode: string | null;
  onPermissionModeChange: (mode: string) => void;
  onSubmit: (prompt: string, permissionMode?: string) => void;
  pendingCodeRefs?: PendingCodeRef[];
  onRemoveCodeRef?: (index: number) => void;
  onTerminateAgent?: () => void;
  onOpenWebPreview?: () => void;
  onOpenProcesses?: () => void;
  provider?: "claude" | "gemini" | "codex";
  model?: string;
  modelOptions?: { value: string; label: string }[];
  providerModelOptions?: Record<"claude" | "gemini" | "codex", { value: string; label: string }[]>;
  onProviderChange?: (provider: "claude" | "gemini" | "codex") => void;
  onModelChange?: (model: string) => void;
  onOpenModelPicker?: () => void;
  onOpenSkillsConfig?: () => void;
  onOpenDocker?: () => void;
}

export function InputPanel({
  connected,
  sessionRunning,
  waitingForUserInput,
  permissionMode,
  onPermissionModeChange,
  onSubmit,
  pendingCodeRefs = [],
  onRemoveCodeRef,
  onTerminateAgent,
  onOpenWebPreview,
  onOpenProcesses,
  provider = "codex",
  model = "gpt-5.1-codex-mini",
  modelOptions = [],
  providerModelOptions,
  onProviderChange,
  onModelChange,
  onOpenModelPicker,
  onOpenSkillsConfig,
  onOpenDocker,
}: InputPanelProps) {
  const theme = useTheme();
  const [prompt, setPrompt] = useState("");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [plusMenuVisible, setPlusMenuVisible] = useState(false);
  const [inputHeight, setInputHeight] = useState(DEFAULT_INPUT_HEIGHT);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => sub.remove();
  }, []);

  const currentModelLabel =
    modelOptions.find((m) => m.value === model)?.label ??
    (model?.startsWith("claude-") ? model.slice(7) : model ?? "");

  const disabled = !waitingForUserInput && sessionRunning;
  const placeholder = waitingForUserInput ? INPUT_PLACEHOLDER : DEFAULT_PLACEHOLDER;

  const handleContentSizeChange = useCallback(
    (_evt: { nativeEvent: { contentSize: { height: number } } }) => {
      const h = _evt.nativeEvent.contentSize.height;
      setInputHeight(Math.min(Math.max(h, DEFAULT_INPUT_HEIGHT), MAX_INPUT_HEIGHT));
    },
    []
  );

  const handleSubmit = useCallback(() => {
    const trimmed = prompt.trim();
    if (!trimmed && !pendingCodeRefs.length) return;
    Keyboard.dismiss();
    triggerHaptic("medium");
    if (waitingForUserInput && sessionRunning) {
      onSubmit(trimmed, permissionMode ?? undefined);
      setPrompt("");
      setInputHeight(DEFAULT_INPUT_HEIGHT);
      return;
    }
    if (sessionRunning) return;
    onSubmit(trimmed || "See code references below.", permissionMode ?? undefined);
    setPrompt("");
    setInputHeight(DEFAULT_INPUT_HEIGHT);
  }, [prompt, pendingCodeRefs.length, waitingForUserInput, sessionRunning, permissionMode, onSubmit]);

  const isDark = theme.mode === "dark";

  return (
    <Box>
      <VStack
        space="md"
        className={cn(
          "flex-col gap-3 border rounded-2xl py-3 px-4 mt-6",
          isDark ? "border-outline-500/60" : "border-outline-200"
        )}
        style={[
          { borderLeftWidth: 3, borderLeftColor: theme.colors.accent, backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          Platform.select({
            ios: {
              shadowColor: theme.colors.accent,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isDark ? 0.22 : 0.1,
              shadowRadius: 14,
            },
            android: { elevation: 6 },
            default: {},
          }),
        ]}
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
        <HStack space="md" className="flex-row items-start gap-3 min-h-11">
          <Textarea
            size="md"
            isDisabled={disabled}
            className="flex-1 min-h-10 h-auto rounded-xl border min-w-0 w-full"
            style={{
              borderColor: theme.colors.accentSubtle,
              backgroundColor: isDark ? theme.colors.surfaceAlt : theme.colors.accentSoft,
              minHeight: DEFAULT_INPUT_HEIGHT + INPUT_VERTICAL_PADDING,
              height: inputHeight + INPUT_VERTICAL_PADDING,
              maxHeight: MAX_INPUT_HEIGHT + INPUT_VERTICAL_PADDING,
            }}
          >
            <TextareaInput
              placeholder={placeholder}
              value={prompt}
              onChangeText={setPrompt}
              editable={!disabled}
              multiline
              scrollEnabled={inputHeight >= MAX_INPUT_HEIGHT}
              showsVerticalScrollIndicator={false}
              overScrollMode="never"
              style={{
                color: theme.colors.textPrimary,
                maxHeight: MAX_INPUT_HEIGHT,
                minHeight: DEFAULT_INPUT_HEIGHT,
                width: "100%",
                minWidth: 0,
                overflow: "hidden",
              }}
              onContentSizeChange={handleContentSizeChange}
              maxLength={8000}
              blurOnSubmit={false}
              onSubmitEditing={handleSubmit}
              returnKeyType="default"
              autoCapitalize="sentences"
              autoCorrect
              autoComplete="off"
              textAlignVertical="top"
              className={cn(
                "w-full min-w-0 text-base py-2 min-h-6 flex-none",
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
                <Pressable
                  onPress={() => {
                    triggerHaptic("selection");
                    setPlusMenuVisible(true);
                  }}
                  accessibilityLabel="More options"
                  accessibilityHint="Opens Skills and Docker dropdown"
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  className="flex-row items-center gap-1 py-2 px-2 rounded-xl border min-h-11 active:opacity-90"
                  style={{
                    backgroundColor: theme.colors.accentSoft,
                    borderColor: theme.colors.accentSubtle,
                  }}
                >
                  <AttachPlusIcon size={18} color={theme.colors.accent} />
                  {plusMenuVisible ? (
                    <ChevronUpIcon size={12} color={theme.colors.accent} />
                  ) : (
                    <ChevronDownIcon size={12} color={theme.colors.accent} />
                  )}
                </Pressable>
                <Modal
                  visible={plusMenuVisible}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setPlusMenuVisible(false)}
                  statusBarTranslucent
                >
                  <TouchableWithoutFeedback onPress={() => setPlusMenuVisible(false)}>
                    <Box className="flex-1 justify-end items-start pl-4 pb-24 pr-4">
                      <TouchableWithoutFeedback onPress={() => {}}>
                        <Box
                          className="rounded-xl border overflow-hidden min-w-40"
                          style={{
                            backgroundColor: theme.colors.surface,
                            borderColor: theme.colors.border,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.15,
                            shadowRadius: 12,
                            elevation: 8,
                          }}
                        >
                          {onOpenSkillsConfig && (
                            <Pressable
                              onPress={() => {
                                triggerHaptic("selection");
                                setPlusMenuVisible(false);
                                onOpenSkillsConfig();
                              }}
                              accessibilityLabel="Skill configuration"
                              className="flex-row items-center gap-3 py-3 px-4 active:opacity-80"
                              style={{ borderBottomWidth: onOpenDocker ? 1 : 0, borderBottomColor: theme.colors.border }}
                            >
                              <SkillIcon size={18} color={theme.colors.accent} />
                              <Text size="md" className="text-typography-900">Skills</Text>
                            </Pressable>
                          )}
                          {onOpenDocker && (
                            <Pressable
                              onPress={() => {
                                triggerHaptic("selection");
                                setPlusMenuVisible(false);
                                onOpenDocker();
                              }}
                              accessibilityLabel="Docker manager"
                              className="flex-row items-center gap-3 py-3 px-4 active:opacity-80"
                            >
                              <DockerIcon size={18} color={theme.colors.accent} />
                              <Text size="md" className="text-typography-900">Docker</Text>
                            </Pressable>
                          )}
                        </Box>
                      </TouchableWithoutFeedback>
                    </Box>
                  </TouchableWithoutFeedback>
                </Modal>
              </>
            )}
            <Pressable
              onPress={() => {
                triggerHaptic("selection");
                onOpenModelPicker?.();
              }}
              disabled={!onOpenModelPicker}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Select model"
              className="flex-1 flex-row items-center gap-0.5 py-0.5 px-1 rounded-xl border min-h-11 min-w-0 max-w-35 justify-start active:opacity-90"
              style={{
                backgroundColor: theme.colors.accentSoft,
                borderColor: theme.colors.accentSubtle,
              }}
            >
              <Text
                size="sm"
                bold
                numberOfLines={2}
                ellipsizeMode="tail"
                className="flex-1 min-w-0"
                style={{ color: theme.colors.accent }}
              >
                {currentModelLabel}
              </Text>
              <Box className="shrink-0 self-center">
                <ChevronDownIcon size={12} color={theme.colors.accent} />
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
                className="w-11 h-11 rounded-xl active:opacity-80"
                style={{
                  borderColor: theme.colors.accentSubtle,
                  backgroundColor: theme.colors.accentSoft,
                }}
              >
                <ButtonIcon as={TerminalIcon} size="md" style={{ color: theme.colors.accent }} />
              </Button>
            )}
            {onOpenWebPreview && (
              <Button
                action="secondary"
                variant="outline"
                size="md"
                onPress={onOpenWebPreview}
                accessibilityLabel="Open web preview"
                className="w-11 h-11 rounded-xl active:opacity-80"
                style={{
                  borderColor: theme.colors.accentSubtle,
                  backgroundColor: theme.colors.accentSoft,
                }}
              >
                <ButtonIcon as={GlobeIcon} size="md" style={{ color: theme.colors.accent }} />
              </Button>
            )}
            {onTerminateAgent && sessionRunning && (
              <Button
                action="negative"
                variant="solid"
                size="md"
                onPress={() => {
                  triggerHaptic("heavy");
                  onTerminateAgent();
                }}
                accessibilityLabel="Terminate agent response"
                className="w-11 h-11 rounded-xl active:opacity-80"
              >
                <ButtonIcon as={StopCircleIcon} size="md" />
              </Button>
            )}
            {!(sessionRunning && !waitingForUserInput) && (
              <Button
                action="primary"
                variant="solid"
                size="md"
                onPress={handleSubmit}
                isDisabled={disabled}
                accessibilityLabel="Send message"
                className="w-11 h-11 rounded-xl active:opacity-80"
                style={
                  disabled
                    ? undefined
                    : {
                        backgroundColor: theme.colors.accent,
                        ...Platform.select({
                          ios: {
                            shadowColor: theme.colors.accent,
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.4,
                            shadowRadius: 6,
                          },
                          android: { elevation: 4 },
                          default: {},
                        }),
                      }
                }
              >
                <ButtonIcon
                  as={
                    provider === "claude"
                      ? ClaudeSendIcon
                      : provider === "gemini"
                        ? GeminiSendIcon
                        : provider === "codex"
                          ? (p: { size?: number }) => (
                              <CodexEnterIcon {...p} stroke={theme.colors.textInverse} color={theme.colors.textInverse} />
                            )
                          : CodexSendIcon
                  }
                  size="md"
                  color={theme.colors.textInverse}
                  style={{ color: theme.colors.textInverse }}
                />
              </Button>
            )}
          </HStack>
        </HStack>
      </VStack>
    </Box>
  );
}
