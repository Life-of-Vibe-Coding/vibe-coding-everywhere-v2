import React, { useState, useCallback, useEffect } from "react";
import { Platform, Keyboard, AccessibilityInfo } from "react-native";
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
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetItem,
  ActionsheetItemText,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from "@/components/ui/actionsheet";
import { ActionIconButton } from "@/components/reusable/ActionIconButton";
import { useTheme } from "@/theme/index";
import { getFileName } from "@/utils/path";
import { cn } from "@/utils/cn";
import { BlurView } from "expo-blur";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Polygon } from "react-native-svg";

function NeonGlassInputWrapper({ width, height, isDark }: { width: number; height: number; isDark: boolean }) {
  const cut = 24;
  const color = isDark ? "#22C55E" : "#059669"; // Cyberpunk green CTA border
  const bg = isDark ? "rgba(15, 23, 42, 0.85)" : "rgba(255,255,255,0.7)"; // Cyan-tinted dark background

  const points = `0,${cut} ${cut},0 ${width},0 ${width},${height - cut} ${width - cut},${height} 0,${height}`;

  return (
    <Box style={{ width, height, position: "absolute", top: 0, left: 0 }}>
      {isDark && (
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      )}
      <Svg width={width} height={height}>
        <Polygon points={points} fill="none" stroke={color} strokeWidth={6} opacity={0.3} />
        <Polygon points={points} fill="none" stroke="#00E5FF" strokeWidth={3} opacity={0.6} />
        <Polygon points={points} fill={bg} stroke={color} strokeWidth={1.5} />
      </Svg>
    </Box>
  );
}

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
  const [panelSize, setPanelSize] = useState({ width: 0, height: 0 });
  const { bottom } = useSafeAreaInsets();

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
  const inputTextColor = theme.colors.textPrimary;
  const placeholderColor = theme.colors.textMuted;

  return (
    <Box>
      <VStack
        space="md"
        className="flex-col gap-3 py-3 px-4 mt-6"
        onLayout={(e) => setPanelSize(e.nativeEvent.layout)}
        style={{ backgroundColor: "transparent" }}
      >
        {panelSize.width > 0 && panelSize.height > 0 && (
          <NeonGlassInputWrapper width={panelSize.width} height={panelSize.height} isDark={isDark} />
        )}
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
            className="flex-1 min-h-10 h-auto min-w-0 w-full"
            style={{
              backgroundColor: "transparent",
              borderWidth: 0,
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
              style={{
                color: inputTextColor,
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
              placeholderTextColor={placeholderColor}
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
                  className="flex-row items-center gap-1 py-2 px-2 rounded-full min-h-11 active:opacity-90"
                  style={{
                    backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.4)",
                    borderColor: isDark ? theme.colors.accent : "transparent",
                    borderWidth: isDark ? 1.5 : 0,
                  }}
                >
                  <AttachPlusIcon size={18} color={theme.colors.accent} />
                  {plusMenuVisible ? (
                    <ChevronUpIcon size={12} color={theme.colors.accent} />
                  ) : (
                    <ChevronDownIcon size={12} color={theme.colors.accent} />
                  )}
                </Pressable>
                <Actionsheet isOpen={plusMenuVisible} onClose={() => setPlusMenuVisible(false)} snapPoints={[25]}>
                  <ActionsheetBackdrop />
                  <ActionsheetContent style={{ backgroundColor: theme.colors.surface, paddingBottom: Math.max(bottom, 24) }}>
                    <ActionsheetDragIndicatorWrapper>
                      <ActionsheetDragIndicator />
                    </ActionsheetDragIndicatorWrapper>
                    {onOpenSkillsConfig && (
                      <ActionsheetItem
                        onPress={() => {
                          triggerHaptic("selection");
                          setPlusMenuVisible(false);
                          onOpenSkillsConfig();
                        }}
                        accessibilityLabel="Skill configuration"
                      >
                        <HStack space="sm" className="items-center">
                          <SkillIcon size={18} color={theme.colors.accent} />
                          <ActionsheetItemText style={{ color: theme.colors.textPrimary }}>Skills</ActionsheetItemText>
                        </HStack>
                      </ActionsheetItem>
                    )}
                    {onOpenDocker && (
                      <ActionsheetItem
                        onPress={() => {
                          triggerHaptic("selection");
                          setPlusMenuVisible(false);
                          onOpenDocker();
                        }}
                        accessibilityLabel="Docker manager"
                      >
                        <HStack space="sm" className="items-center">
                          <DockerIcon size={18} color={theme.colors.accent} />
                          <ActionsheetItemText style={{ color: theme.colors.textPrimary }}>Docker</ActionsheetItemText>
                        </HStack>
                      </ActionsheetItem>
                    )}
                  </ActionsheetContent>
                </Actionsheet>
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
              className="flex-1 flex-row items-center gap-0.5 py-0.5 px-2 rounded-full min-h-11 min-w-0 max-w-36 justify-start active:opacity-90"
              style={{
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.4)",
                borderColor: isDark ? theme.colors.info : "transparent",
                borderWidth: isDark ? 1.5 : 0,
              }}
            >
              <Text
                size="sm"
                bold
                numberOfLines={2}
                ellipsizeMode="tail"
                className="flex-1 min-w-0"
                style={{ color: isDark ? theme.colors.info : theme.colors.accent }}
              >
                {currentModelLabel}
              </Text>
              <Box className="shrink-0 self-center pl-1">
                <ChevronDownIcon size={12} color={isDark ? theme.colors.info : theme.colors.accent} />
              </Box>
            </Pressable>
          </HStack>
          <HStack space="sm" className="flex-row items-center gap-2 shrink-0">
            {onOpenProcesses && (
              <Pressable
                onPress={onOpenProcesses}
                accessibilityLabel="Open process dashboard"
                className="w-11 h-11 items-center justify-center rounded-full active:opacity-80"
                style={isDark ? {
                  backgroundColor: "rgba(255, 0, 255, 0.1)",
                  borderColor: "#FF00FF",
                  borderWidth: 1.5
                } : { backgroundColor: "rgba(255, 255, 255, 0.4)" }}
              >
                <TerminalIcon size={18} color={isDark ? "#FF00FF" : theme.colors.textPrimary} />
              </Pressable>
            )}
            {onOpenWebPreview && (
              <Pressable
                onPress={onOpenWebPreview}
                accessibilityLabel="Open web preview"
                className="w-11 h-11 items-center justify-center rounded-full active:opacity-80"
                style={isDark ? {
                  backgroundColor: "rgba(0, 229, 255, 0.1)",
                  borderColor: "#00E5FF",
                  borderWidth: 1.5
                } : { backgroundColor: "rgba(255, 255, 255, 0.4)" }}
              >
                <GlobeIcon size={18} color={isDark ? "#00E5FF" : theme.colors.textPrimary} />
              </Pressable>
            )}
            {onTerminateAgent && sessionRunning && (
              <ActionIconButton
                icon={StopCircleIcon}
                onPress={() => {
                  triggerHaptic("heavy");
                  onTerminateAgent();
                }}
                accessibilityLabel="Terminate agent response"
                className="w-11 h-11 rounded-xl"
                tone="danger"
              />
            )}
            {!(sessionRunning && !waitingForUserInput) && (
              <Button
                action="primary"
                variant="solid"
                size="md"
                onPress={handleSubmit}
                isDisabled={disabled}
                accessibilityLabel="Send message"
                className="w-12 h-12 rounded-full active:opacity-80"
                style={
                  disabled
                    ? undefined
                    : {
                      backgroundColor: isDark ? theme.colors.accentSoft : theme.colors.accent,
                      borderColor: isDark ? theme.colors.accent : "transparent",
                      borderWidth: isDark ? 1.5 : 0,
                      ...Platform.select({
                        ios: {
                          shadowColor: isDark ? theme.colors.accent : theme.colors.accentSoft,
                          shadowOffset: isDark ? { width: 0, height: 0 } : { width: 0, height: 4 },
                          shadowOpacity: isDark ? 0.5 : 0.3,
                          shadowRadius: isDark ? 8 : 8,
                        },
                        android: { elevation: 8 },
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
                            <CodexEnterIcon {...p} stroke={isDark ? theme.colors.accent : "#FFFFFF"} color={isDark ? theme.colors.accent : "#FFFFFF"} />
                          )
                          : CodexSendIcon
                  }
                  size="md"
                  color={isDark ? theme.colors.accent : "#FFFFFF"}
                  style={{ color: isDark ? theme.colors.accent : "#FFFFFF" }}
                />
              </Button>
            )}
          </HStack>
        </HStack>
      </VStack>
    </Box>
  );
}
