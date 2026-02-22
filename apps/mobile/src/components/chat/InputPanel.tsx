import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Text,
  Platform,
  Modal,
  ScrollView,
  Keyboard,
} from "react-native";
import { GeminiIcon, ClaudeIcon, CodexIcon, CodexSendIcon } from "../icons/ProviderIcons";
import {
  AttachPlusIcon,
  ChevronDownIcon,
  CloseIcon,
  DockerIcon,
  GlobeIcon,
  SkillIcon,
  StopCircleIcon,
  TerminalIcon,
} from "../icons/ChatActionIcons";
import { useTheme } from "../../theme/index";
import { getFileName } from "../../utils/path";

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
  /** When agent is running, show a control to terminate the response. */
  onTerminateAgent?: () => void;
  /** Open web preview modal. */
  onOpenWebPreview?: () => void;
  /** Open processes/terminal dashboard. */
  onOpenProcesses?: () => void;
  /** Current AI provider (for model selector in input bar). */
  provider?: "claude" | "gemini" | "codex" | "pi";
  /** Current model value (e.g. "sonnet", "gemini-2.5-flash"). */
  model?: string;
  /** Model options for current provider: { value, label }[]. */
  modelOptions?: { value: string; label: string }[];
  /** Model options per provider for the picker modal. Keys: claude, gemini, codex (pi uses codex). */
  providerModelOptions?: Record<"claude" | "gemini" | "codex", { value: string; label: string }[]>;
  /** Called when user switches provider (resets model to default). */
  onProviderChange?: (provider: "claude" | "gemini" | "codex" | "pi") => void;
  /** Called when user selects a model. */
  onModelChange?: (model: string) => void;
  /** Open skill configuration modal. */
  onOpenSkillsConfig?: () => void;
  /** Open Docker manager modal. */
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

  const currentModelLabel = modelOptions.find((m) => m.value === model)?.label ?? model;

  const disabled = !waitingForUserInput && agentRunning;
  const placeholder = waitingForUserInput ? INPUT_PLACEHOLDER : DEFAULT_PLACEHOLDER;

  const handleSubmit = useCallback(() => {
    const trimmed = prompt.trim();
    if (!trimmed && !pendingCodeRefs.length) return;
    Keyboard.dismiss();
    if (waitingForUserInput && agentRunning) {
      onSubmit(trimmed, permissionMode ?? undefined);
      setPrompt("");
      return;
    }
    if (agentRunning) return;
    onSubmit(trimmed || "See code references below.", permissionMode ?? undefined);
    setPrompt("");
  }, [prompt, pendingCodeRefs.length, waitingForUserInput, agentRunning, permissionMode, onSubmit]);

  const styles = useMemo(() => createInputPanelStyles(theme), [theme]);

  return (
    <View>
      <View style={styles.container}>
        {pendingCodeRefs.length > 0 && (
          <View style={styles.refPills}>
            {pendingCodeRefs.map((ref, index) => (
              <View key={`${ref.path}-${ref.startLine}-${index}`} style={styles.refPill}>
                <Text style={styles.refPillText} numberOfLines={1}>
                  {getFileName(ref.path)} ({ref.startLine === ref.endLine ? ref.startLine : `${ref.startLine}-${ref.endLine}`})
                </Text>
                {onRemoveCodeRef && (
                  <TouchableOpacity
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => onRemoveCodeRef(index)}
                    style={styles.refPillRemove}
                  >
                    <CloseIcon size={12} color={theme.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
        <View style={styles.topRow}>
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={theme.textMuted}
            value={prompt}
            onChangeText={setPrompt}
            editable={!disabled}
            multiline
            maxLength={8000}
            blurOnSubmit={false}
            onSubmitEditing={handleSubmit}
            returnKeyType="default"
            autoCapitalize="sentences"
            autoCorrect
            autoComplete="off"
            textAlignVertical={Platform.OS === "android" ? "top" : "center"}
            scrollEnabled
          />
          <View style={[styles.statusDot, connected && styles.statusDotConnected]} />
        </View>
        <View style={styles.bottomRow}>
          <View style={styles.leftGroup}>
            {(onOpenSkillsConfig || onOpenDocker) && (
              <View style={styles.addDropdownWrap}>
                <TouchableOpacity
                  style={[styles.btnAttach, styles.btnAttachLight]}
                  activeOpacity={0.7}
                  onPress={() => setAddDropdownVisible((v) => !v)}
                  accessibilityLabel="Add options"
                >
                  <AttachPlusIcon size={20} color={theme.accent} strokeWidth={2.1} />
                </TouchableOpacity>
                {addDropdownVisible && (
                  <View style={styles.addDropdownCard} onStartShouldSetResponder={() => true}>
                    {onOpenSkillsConfig && (
                      <TouchableOpacity
                        style={styles.addDropdownOption}
                        onPress={() => {
                          onOpenSkillsConfig();
                          setAddDropdownVisible(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <SkillIcon size={18} color={theme.textPrimary} />
                        <Text style={styles.addDropdownOptionText}>Skill</Text>
                      </TouchableOpacity>
                    )}
                    {onOpenDocker && (
                      <TouchableOpacity
                        style={styles.addDropdownOption}
                        onPress={() => {
                          onOpenDocker();
                          setAddDropdownVisible(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <DockerIcon size={18} color={theme.textPrimary} />
                        <Text style={styles.addDropdownOptionText}>Docker</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}
            <TouchableOpacity
              style={styles.modelSelector}
              onPress={() => (onModelChange ? setModelPickerVisible(true) : null)}
              activeOpacity={0.7}
              disabled={!onModelChange}
              accessibilityLabel="Select model"
            >
              <Text style={styles.modelName} numberOfLines={1} ellipsizeMode="tail">
                {currentModelLabel}
              </Text>
              <ChevronDownIcon size={14} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={styles.rightGroup}>
            {onOpenProcesses && (
              <TouchableOpacity
                style={styles.btnUtility}
                onPress={onOpenProcesses}
                activeOpacity={0.7}
                accessibilityLabel="Open processes dashboard"
              >
                <TerminalIcon size={20} color={theme.textPrimary} />
              </TouchableOpacity>
            )}
            {onOpenWebPreview && (
              <TouchableOpacity
                style={styles.btnUtility}
                onPress={onOpenWebPreview}
                activeOpacity={0.7}
                accessibilityLabel="Open web preview"
              >
                <GlobeIcon size={20} color={theme.textPrimary} />
              </TouchableOpacity>
            )}
            {onTerminateAgent && agentRunning && (
              <TouchableOpacity
                style={styles.btnTerminateAgent}
                onPress={onTerminateAgent}
                activeOpacity={0.7}
                accessibilityLabel="Terminate agent response"
              >
                <StopCircleIcon size={16} color={theme.mode === "dark" ? "#f87171" : "#c0392b"} />
              </TouchableOpacity>
            )}
            {!(agentRunning && !waitingForUserInput) && (
              <TouchableOpacity
                style={[
                  styles.btnSend,
                  styles.btnSendLight,
                  disabled && styles.btnSendDisabled,
                ]}
                onPress={handleSubmit}
                disabled={disabled}
                activeOpacity={0.7}
              >
                <CodexSendIcon size={22} color={theme.accent} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <Modal
        visible={modelPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModelPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modelPickerBackdrop}
          activeOpacity={1}
          onPress={() => setModelPickerVisible(false)}
        >
          <View style={styles.modelPickerCard} onStartShouldSetResponder={() => true}>
            {providerModelOptions && onProviderChange ? (
              <>
                <View style={styles.modelPickerProviderRow}>
                  {(["claude", "gemini", "codex"] as const).map((p) => {
                    const isActive = (provider === "pi" ? "codex" : provider) === p;
                    const Icon = p === "claude" ? ClaudeIcon : p === "gemini" ? GeminiIcon : CodexIcon;
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[styles.modelPickerProviderBtn, isActive && styles.modelPickerProviderBtnActive]}
                        onPress={() => onProviderChange(p)}
                        activeOpacity={0.8}
                      >
                        <Icon size={20} color={isActive ? (theme.accent ?? "#1a73e8") : theme.textMuted} />
                        <Text style={[styles.modelPickerProviderText, isActive && styles.modelPickerProviderTextActive]}>
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <ScrollView
                  style={styles.modelPickerList}
                  keyboardShouldPersistTaps="handled"
                  snapToInterval={54}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  contentContainerStyle={styles.modelPickerListContent}
                >
                  {(providerModelOptions[provider === "pi" ? "codex" : provider] ?? []).map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.modelPickerOption, model === opt.value && styles.modelPickerOptionActive]}
                      onPress={() => {
                        onModelChange?.(opt.value);
                        setModelPickerVisible(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.modelPickerOptionText, model === opt.value && styles.modelPickerOptionTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : (
              <>
                <Text style={styles.modelPickerTitle}>Model</Text>
                <ScrollView
                  style={styles.modelPickerList}
                  keyboardShouldPersistTaps="handled"
                  snapToInterval={54}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  contentContainerStyle={styles.modelPickerListContent}
                >
                  {modelOptions.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.modelPickerOption, model === opt.value && styles.modelPickerOptionActive]}
                      onPress={() => {
                        onModelChange?.(opt.value);
                        setModelPickerVisible(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.modelPickerOptionText, model === opt.value && styles.modelPickerOptionTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// Minimum touch target per Apple HIG / WCAG (44x44pt)
const MIN_TOUCH = 44;

function createInputPanelStyles(theme: ReturnType<typeof useTheme>) {
  const utilityButtonBg = theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  return StyleSheet.create({
  container: {
    flexDirection: "column",
    gap: 10,
    borderWidth: 1,
    borderColor: theme.borderColor,
    borderRadius: theme.radii?.xl ?? 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: theme.surfaceBg,
  },
  refPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  refPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 4,
    borderRadius: 12,
    backgroundColor: theme.accentLight ?? "#e8f0fe",
    maxWidth: "100%",
  },
  refPillText: {
    fontSize: 13,
    color: theme.textPrimary,
    fontWeight: "500",
  },
  refPillRemove: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: MIN_TOUCH,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: theme.textPrimary,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 0,
    paddingRight: 0,
    maxHeight: 120,
    minHeight: 24,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#c5c5c5",
    alignSelf: "center",
  },
  statusDotConnected: {
    backgroundColor: theme.success,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    flexWrap: "nowrap",
  },
  leftGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  rightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  btnAttach: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: theme.radii?.md ?? 12,
    backgroundColor: theme.mode === "dark" ? "#262b36" : "#171c24",
    alignItems: "center",
    justifyContent: "center",
  },
  btnAttachLight: {
    backgroundColor: theme.accentLight ?? "#e8f0fe",
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  modelSelector: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: theme.radii?.md ?? 12,
    backgroundColor: utilityButtonBg,
    borderWidth: 1,
    borderColor: theme.borderColor,
    minHeight: MIN_TOUCH,
    minWidth: 0,
    justifyContent: "center",
  },
  modelName: {
    flexShrink: 1,
    fontSize: 14,
    color: theme.textMuted,
    fontWeight: "500",
  },
  modelPickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  addDropdownWrap: {
    position: "relative",
  },
  addDropdownCard: {
    position: "absolute",
    bottom: MIN_TOUCH + 8,
    left: 0,
    backgroundColor: theme.surfaceBg,
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: theme.borderColor,
    minWidth: 140,
  },
  addDropdownOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addDropdownOptionText: {
    fontSize: 15,
    color: theme.textPrimary,
    fontWeight: "500",
  },
  modelPickerCard: {
    width: "100%",
    maxWidth: 320,
    maxHeight: "80%",
    backgroundColor: theme.surfaceBg,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  modelPickerTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.textMuted,
    marginBottom: 8,
  },
  modelPickerProviderRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  modelPickerProviderBtn: {
    flex: 1,
    minWidth: 85,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: theme.cardBg,
  },
  modelPickerProviderBtnActive: {
    backgroundColor: theme.accentLight ?? "#e8f0fe",
  },
  modelPickerProviderText: {
    fontSize: 15,
    color: theme.textMuted,
    flexShrink: 0,
  },
  modelPickerProviderTextActive: {
    color: theme.accent ?? "#1a73e8",
    fontWeight: "600",
  },
  providerIconMuted: {
    opacity: 0.56,
  },
  modelPickerList: {
    maxHeight: 220,
  },
  modelPickerListContent: {
    paddingBottom: 8,
  },
  modelPickerOption: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: theme.cardBg,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  modelPickerOptionActive: {
    backgroundColor: theme.accentLight ?? "#e8f0fe",
    borderColor: theme.accent ?? "#1a73e8",
  },
  modelPickerOptionText: {
    fontSize: 15,
    color: theme.textPrimary,
    textAlign: "center",
  },
  modelPickerOptionTextActive: {
    color: theme.accent ?? "#1a73e8",
    fontWeight: "600",
  },
  btnUtility: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: theme.radii?.md ?? 12,
    backgroundColor: utilityButtonBg,
    borderWidth: 1,
    borderColor: theme.borderColor,
    alignItems: "center",
    justifyContent: "center",
  },
  btnTerminateAgent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: MIN_TOUCH,
    borderRadius: theme.radii?.md ?? 12,
    backgroundColor: theme.mode === "dark" ? "rgba(248,113,113,0.14)" : "rgba(220,38,38,0.12)",
    borderWidth: 1,
    borderColor: theme.mode === "dark" ? "rgba(248,113,113,0.45)" : "rgba(192,57,43,0.4)",
    justifyContent: "center",
  },
  btnSend: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: theme.radii?.md ?? 12,
    alignItems: "center",
    justifyContent: "center",
    ...(theme.mode === "light" && {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 2,
    }),
  },
  btnSendLight: {
    backgroundColor: theme.accentLight ?? "#e8f0fe",
    borderWidth: 1,
    borderColor: theme.borderColor,
  },
  btnSendDark: {
    backgroundColor: theme.mode === "dark" ? "#171c24" : "#12131a",
  },
  btnSendDisabled: {
    opacity: 0.4,
  },
  sendButtonIcon: {
    width: 36,
    height: 36,
  },
  waveformIcon: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 3,
    height: 16,
  },
  waveformBar: {
    width: 3,
    backgroundColor: theme.textMuted,
    borderRadius: 2,
  },
  waveformBarShort: {
    height: 8,
  },
  waveformBarMid: {
    height: 12,
  },
  waveformBarTall: {
    height: 14,
  },
  btnSendText: {
    color: theme.textMuted,
    fontSize: 14,
  },
});
}
