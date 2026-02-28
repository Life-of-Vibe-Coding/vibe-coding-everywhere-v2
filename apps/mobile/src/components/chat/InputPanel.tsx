import React, { useState, useCallback, useEffect, useRef } from "react";
import { Platform, Keyboard, AccessibilityInfo, Animated } from "react-native";
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
import { type Provider } from "@/constants/modelOptions";
import { getFileName } from "@/utils/path";
import { cn } from "@/utils/cn";
import { BlurView } from "expo-blur";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Polygon } from "react-native-svg";

function InputWrapper({ width, height, isDark, theme }: { width: number; height: number; isDark: boolean; theme: any }) {
  const cut = 24;
  const points = `0,${cut} ${cut},0 ${width},0 ${width},${height - cut} ${width - cut},${height} 0,${height}`;

  if (!isDark) {
    return (
      <Box style={{
        width,
        height,
        position: "absolute",
        top: 0,
        left: 0,
        backgroundColor: theme.colors.surfaceAlt,
        borderRadius: 32,
        borderWidth: 1,
        borderColor: theme.colors.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        overflow: "hidden"
      }}>
        <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
      </Box>
    );
  }

  const color = theme.colors.success; // CTA border using theme token
  const accentColor = theme.colors.info; // Accent stroke using theme token
  const bg = "rgba(15, 23, 42, 0.85)"; // Dark background

  return (
    <Box style={{ width, height, position: "absolute", top: 0, left: 0 }}>
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      <Svg width={width} height={height}>
        <Polygon points={points} fill="none" stroke={color} strokeWidth={6} opacity={0.3} />
        <Polygon points={points} fill="none" stroke={accentColor} strokeWidth={3} opacity={0.6} />
        <Polygon points={points} fill={bg} stroke={color} strokeWidth={1.5} />
      </Svg>
    </Box>
  );
}

const DEFAULT_PLACEHOLDER = "How can I help you today?";
const INPUT_PLACEHOLDER = "Type your response…";
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
  provider?: Provider;
  model?: string;
  modelOptions?: { value: string; label: string }[];
  providerModelOptions?: Record<Provider, { value: string; label: string }[]>;
  onProviderChange?: (provider: Provider) => void;
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
  const [terminalMenuVisible, setTerminalMenuVisible] = useState(false);
  const [inputHeight, setInputHeight] = useState(DEFAULT_INPUT_HEIGHT);
  const [panelSize, setPanelSize] = useState({ width: 0, height: 0 });
  const { bottom } = useSafeAreaInsets();

  const sendScale = useRef(new Animated.Value(1)).current;
  const sendStyle = { transform: [{ scale: sendScale }] };

  const handlePressIn = useCallback(() => {
    Animated.spring(sendScale, { toValue: 0.92, useNativeDriver: true }).start();
  }, [sendScale]);
  const handlePressOut = useCallback(() => {
    Animated.spring(sendScale, { toValue: 1, useNativeDriver: true }).start();
  }, [sendScale]);

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
          <InputWrapper width={panelSize.width} height={panelSize.height} isDark={isDark} theme={theme} />
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
            {onOpenSkillsConfig && (
              <Pressable
                onPress={() => {
                  triggerHaptic("selection");
                  onOpenSkillsConfig();
                }}
                accessibilityLabel="Skill configuration"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                className="items-center justify-center p-2 rounded-full w-11 h-11 active:opacity-90"
                style={{
                  backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : theme.colors.surfaceMuted,
                  borderColor: isDark ? theme.colors.accent : theme.colors.border,
                  borderWidth: isDark ? 1.5 : 1,
                }}
              >
                <AttachPlusIcon size={18} color={isDark ? theme.colors.accent : theme.colors.textPrimary} />
              </Pressable>
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
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : theme.colors.surfaceMuted,
                borderColor: isDark ? theme.colors.info : theme.colors.border,
                borderWidth: isDark ? 1.5 : 1,
              }}
            >
              <Text
                size="sm"
                bold
                numberOfLines={2}
                ellipsizeMode="tail"
                className="flex-1 min-w-0"
                style={{ color: isDark ? theme.colors.info : theme.colors.textPrimary }}
              >
                {currentModelLabel}
              </Text>
              <Box className="shrink-0 self-center pl-1">
                <ChevronDownIcon size={12} color={isDark ? theme.colors.info : theme.colors.textPrimary} />
              </Box>
            </Pressable>
          </HStack>
          <HStack space="sm" className="flex-row items-center gap-2 shrink-0">
            {(onOpenProcesses || onOpenDocker) && (
              <>
                <Pressable
                  onPress={() => {
                    triggerHaptic("selection");
                    setTerminalMenuVisible(true);
                  }}
                  accessibilityLabel="System menu"
                  className="flex-row items-center gap-1 py-2 px-2 rounded-full min-h-11 active:opacity-80"
                  style={isDark ? {
                    backgroundColor: "rgba(255, 0, 255, 0.1)",
                    borderColor: "#FF00FF",
                    borderWidth: 1.5
                  } : {
                    backgroundColor: theme.colors.surfaceMuted,
                    borderColor: theme.colors.border,
                    borderWidth: 1
                  }}
                >
                  <TerminalIcon size={18} color={isDark ? "#FF00FF" : theme.colors.textPrimary} />
                  {terminalMenuVisible ? (
                    <ChevronUpIcon size={12} color={isDark ? "#FF00FF" : theme.colors.textPrimary} />
                  ) : (
                    <ChevronDownIcon size={12} color={isDark ? "#FF00FF" : theme.colors.textPrimary} />
                  )}
                </Pressable>
                <Actionsheet isOpen={terminalMenuVisible} onClose={() => setTerminalMenuVisible(false)} snapPoints={[25]}>
                  <ActionsheetBackdrop />
                  <ActionsheetContent style={{ backgroundColor: theme.colors.surface, paddingBottom: Math.max(bottom, 24) }}>
                    <ActionsheetDragIndicatorWrapper>
                      <ActionsheetDragIndicator />
                    </ActionsheetDragIndicatorWrapper>
                    {onOpenProcesses && (
                      <ActionsheetItem
                        onPress={() => {
                          triggerHaptic("selection");
                          setTerminalMenuVisible(false);
                          onOpenProcesses();
                        }}
                        accessibilityLabel="Terminal processes"
                      >
                        <HStack space="sm" className="items-center">
                          <TerminalIcon size={18} color={isDark ? "#FF00FF" : theme.colors.textPrimary} />
                          <ActionsheetItemText style={{ color: theme.colors.textPrimary }}>Terminal processes</ActionsheetItemText>
                        </HStack>
                      </ActionsheetItem>
                    )}
                    {onOpenDocker && (
                      <ActionsheetItem
                        onPress={() => {
                          triggerHaptic("selection");
                          setTerminalMenuVisible(false);
                          onOpenDocker();
                        }}
                        accessibilityLabel="Docker manager"
                      >
                        <HStack space="sm" className="items-center">
                          <DockerIcon size={18} color={theme.colors.accent} />
                          <ActionsheetItemText style={{ color: theme.colors.textPrimary }}>Docker manager</ActionsheetItemText>
                        </HStack>
                      </ActionsheetItem>
                    )}
                  </ActionsheetContent>
                </Actionsheet>
              </>
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
                } : {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.border,
                  borderWidth: 1
                }}
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
              <Animated.View style={sendStyle}>
                <Button
                  action="primary"
                  variant="solid"
                  size="md"
                  onPress={handleSubmit}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  isDisabled={disabled}
                  accessibilityLabel="Send message"
                  className="w-12 h-12 rounded-full active:opacity-80"
                  style={
                    disabled
                      ? undefined
                      : {
                        backgroundColor: isDark ? theme.colors.accentSoft : theme.colors.textPrimary,
                        borderColor: isDark ? theme.colors.accent : "transparent",
                        borderWidth: isDark ? 1.5 : 0,
                        ...Platform.select({
                          ios: {
                            shadowColor: isDark ? theme.colors.accent : theme.colors.textPrimary,
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
                      (p: { size?: number }) => (
                        <CodexEnterIcon {...p} stroke={isDark ? theme.colors.accent : theme.colors.textInverse} color={isDark ? theme.colors.accent : theme.colors.textInverse} />
                      )
                    }
                    size="md"
                    color={isDark ? theme.colors.accent : theme.colors.textInverse}
                    style={{ color: isDark ? theme.colors.accent : theme.colors.textInverse }}
                  />
                </Button>
              </Animated.View>
            )}
          </HStack>
        </HStack>
      </VStack>
    </Box>
  );
}
