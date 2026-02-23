import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Modal,
  ScrollView,
  Keyboard,
  AccessibilityInfo,
} from "react-native";
import { CodexSendIcon } from "../icons/ProviderIcons";
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
import {
  Typography,
  Card,
  IconButton,
  Badge,
  EntranceAnimation,
  triggerHaptic,
  spacing,
  radii,
  motion
} from "../../design-system";
import { useTheme } from "../../theme/index";
import { getFileName } from "../../utils/path";

const DEFAULT_PLACEHOLDER = "How can I help you today?";
const INPUT_PLACEHOLDER = "Type response for Claude…";

/** Soften a hex color with alpha for delicate UI. */
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

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

  const styles = useMemo(() => createInputPanelStyles(theme), [theme]);

  return (
    <View>
      <View style={styles.container}>
        {pendingCodeRefs.length > 0 && (
          <View style={styles.refPills}>
            {pendingCodeRefs.map((ref, index) => {
              const key = `${ref.path}-${ref.startLine}-${index}`;
              const badge = (
                <Badge
                  variant="accent"
                  size="md"
                  label={`${getFileName(ref.path)} (${ref.startLine === ref.endLine ? ref.startLine : `${ref.startLine}-${ref.endLine}`})`}
                  style={styles.refPill}
                  dot
                >
                  {onRemoveCodeRef && (
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => {
                        triggerHaptic("selection");
                        onRemoveCodeRef(index);
                      }}
                      style={styles.refPillRemove}
                    >
                      <CloseIcon size={12} color={theme.colors.textPrimary} />
                    </TouchableOpacity>
                  )}
                </Badge>
              );
              return reduceMotion ? (
                <View key={key}>{badge}</View>
              ) : (
                <EntranceAnimation key={key} variant="scale" delay={index * 50}>
                  {badge}
                </EntranceAnimation>
              );
            })}
          </View>
        )}
        <View style={styles.topRow}>
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.textMuted}
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
                <IconButton
                  variant="ghost"
                  icon={<AttachPlusIcon size={18} color={theme.colors.accent} strokeWidth={2.4} />}
                  onPress={() => {
                    triggerHaptic("selection");
                    setAddDropdownVisible((v) => !v);
                  }}
                  accessibilityLabel="Add options"
                  style={styles.btnAttach}
                />
                {addDropdownVisible &&
                  (reduceMotion ? (
                    <View style={styles.addDropdownCard}>
                      <Card variant="default" padding="1" style={{ overflow: "hidden" }}>
                        {onOpenSkillsConfig && (
                          <TouchableOpacity
                            style={styles.addDropdownOption}
                            onPress={() => {
                              triggerHaptic("selection");
                              onOpenSkillsConfig();
                              setAddDropdownVisible(false);
                            }}
                            activeOpacity={0.7}
                          >
                            <SkillIcon size={18} color={theme.colors.textPrimary} />
                            <Typography variant="subhead" weight="medium" style={styles.addDropdownOptionText}>Skill</Typography>
                          </TouchableOpacity>
                        )}
                        {onOpenDocker && (
                          <TouchableOpacity
                            style={styles.addDropdownOption}
                            onPress={() => {
                              triggerHaptic("selection");
                              onOpenDocker();
                              setAddDropdownVisible(false);
                            }}
                            activeOpacity={0.7}
                          >
                            <DockerIcon size={18} color={theme.colors.textPrimary} />
                            <Typography variant="subhead" weight="medium" style={styles.addDropdownOptionText}>Docker</Typography>
                          </TouchableOpacity>
                        )}
                      </Card>
                    </View>
                  ) : (
                    <EntranceAnimation variant="scale" duration={150} style={styles.addDropdownCard}>
                      <Card variant="default" padding="1" style={{ overflow: "hidden" }}>
                        {onOpenSkillsConfig && (
                          <TouchableOpacity
                            style={styles.addDropdownOption}
                            onPress={() => {
                              triggerHaptic("selection");
                              onOpenSkillsConfig();
                              setAddDropdownVisible(false);
                            }}
                            activeOpacity={0.7}
                          >
                            <SkillIcon size={18} color={theme.colors.textPrimary} />
                            <Typography variant="subhead" weight="medium" style={styles.addDropdownOptionText}>Skill</Typography>
                          </TouchableOpacity>
                        )}
                        {onOpenDocker && (
                          <TouchableOpacity
                            style={styles.addDropdownOption}
                            onPress={() => {
                              triggerHaptic("selection");
                              onOpenDocker();
                              setAddDropdownVisible(false);
                            }}
                            activeOpacity={0.7}
                          >
                            <DockerIcon size={18} color={theme.colors.textPrimary} />
                            <Typography variant="subhead" weight="medium" style={styles.addDropdownOptionText}>Docker</Typography>
                          </TouchableOpacity>
                        )}
                      </Card>
                    </EntranceAnimation>
                  ))}
              </View>
            )}
            <TouchableOpacity
              style={styles.modelSelector}
              onPress={() => {
                triggerHaptic("selection");
                onModelChange ? setModelPickerVisible(true) : null;
              }}
              activeOpacity={0.7}
              disabled={!onModelChange}
              accessibilityLabel="Select model"
            >
              <Typography variant="label" weight="medium" color={theme.colors.textSecondary} numberOfLines={2} ellipsizeMode="tail" style={styles.modelName}>
                {currentModelLabel}
              </Typography>
              <View style={styles.modelChevron}>
                <ChevronDownIcon size={12} color={theme.colors.textMuted} />
              </View>
            </TouchableOpacity>
          </View>
          <View style={styles.rightGroup}>
            {onOpenProcesses && (
              <IconButton
                variant="ghost"
                icon={<TerminalIcon size={18} color={theme.colors.textPrimary} />}
                onPress={onOpenProcesses}
                accessibilityLabel="Open processes dashboard"
                style={styles.btnUtility}
              />
            )}
            {onOpenWebPreview && (
              <IconButton
                variant="ghost"
                icon={<GlobeIcon size={18} color={theme.colors.textPrimary} />}
                onPress={onOpenWebPreview}
                accessibilityLabel="Open web preview"
                style={styles.btnUtility}
              />
            )}
            {onTerminateAgent && agentRunning && (
              <IconButton
                variant="danger"
                icon={<StopCircleIcon size={16} color={theme.colors.textInverse} />}
                onPress={() => {
                  triggerHaptic("heavy");
                  onTerminateAgent();
                }}
                accessibilityLabel="Terminate agent response"
                style={styles.btnTerminateAgent}
              />
            )}
            {!(agentRunning && !waitingForUserInput) && (
              <IconButton
                variant="primary"
                icon={<CodexSendIcon size={20} color={theme.colors.textInverse} />}
                onPress={handleSubmit}
                disabled={disabled}
                accessibilityLabel="Send message"
                style={styles.btnSend}
              />
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
          <TouchableOpacity
            style={styles.modelPickerCardContainer}
            activeOpacity={1}
            onPress={() => {}}
          >
          {reduceMotion ? (
            <Card variant="default" padding="3" style={styles.modelPickerCard}>
                <View style={styles.modelPickerHeader}>
                  <View style={styles.modelPickerHeaderSpacer} />
                  <TouchableOpacity
                    style={styles.modelPickerCloseBtn}
                    onPress={() => { triggerHaptic("light"); setModelPickerVisible(false); }}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityLabel="Close"
                  >
                    <CloseIcon size={18} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>
                {providerModelOptions && onProviderChange ? (
                  <ScrollView
                    style={styles.modelPickerList}
                    showsVerticalScrollIndicator
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.modelPickerListContent}
                  >
                    {(["claude", "gemini", "codex"] as const).map((p) => {
                      const opts = providerModelOptions[p] ?? [];
                      if (opts.length === 0) return null;
                      const currentProvider = provider === "pi" ? "codex" : provider;
                      return (
                        <View key={p} style={styles.modelPickerSection}>
                          <View style={styles.modelPickerSectionHeader}>
                            <Typography
                              variant="caption"
                              weight="medium"
                              tone="secondary"
                            >
                              {p.charAt(0).toUpperCase() + p.slice(1)}:
                            </Typography>
                          </View>
                          {opts.map((opt) => {
                            const isActive = currentProvider === p && model === opt.value;
                            return (
                              <TouchableOpacity
                                key={opt.value}
                                style={[styles.modelPickerOption, isActive && styles.modelPickerOptionActive]}
                                onPress={() => {
                                  triggerHaptic("selection");
                                  if (currentProvider !== p) onProviderChange(p);
                                  onModelChange?.(opt.value);
                                  setModelPickerVisible(false);
                                }}
                                activeOpacity={0.8}
                              >
                                <Typography
                                  variant="subhead"
                                  weight="medium"
                                  color={isActive ? withAlpha(theme.colors.accent, 0.9) : undefined}
                                  tone={isActive ? undefined : "primary"}
                                >
                                  {opt.label}
                                </Typography>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <>
                    <Typography variant="label" tone="muted" transform="uppercase" style={{ marginBottom: spacing["2"], marginLeft: 4 }}>
                      Models
                    </Typography>
                    <ScrollView
                      style={styles.modelPickerList}
                      showsVerticalScrollIndicator
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={styles.modelPickerListContent}
                    >
                      {modelOptions.map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          style={[styles.modelPickerOption, model === opt.value && styles.modelPickerOptionActive]}
                          onPress={() => {
                            triggerHaptic("selection");
                            onModelChange?.(opt.value);
                            setModelPickerVisible(false);
                          }}
                          activeOpacity={0.8}
                        >
                          <Typography
                            variant="subhead"
                            weight="medium"
                            color={model === opt.value ? withAlpha(theme.colors.accent, 0.9) : undefined}
                            tone={model === opt.value ? undefined : "primary"}
                          >
                            {opt.label}
                          </Typography>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}
              </Card>
          ) : (
            <EntranceAnimation variant="scale" duration={200} style={styles.modelPickerCardInner}>
              <Card variant="default" padding="3" style={styles.modelPickerCard}>
                <View style={styles.modelPickerHeader}>
                  <View style={styles.modelPickerHeaderSpacer} />
                  <TouchableOpacity
                    style={styles.modelPickerCloseBtn}
                    onPress={() => { triggerHaptic("light"); setModelPickerVisible(false); }}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityLabel="Close"
                  >
                    <CloseIcon size={18} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>
                {providerModelOptions && onProviderChange ? (
                  <ScrollView
                    style={styles.modelPickerList}
                    showsVerticalScrollIndicator
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.modelPickerListContent}
                  >
                    {(["claude", "gemini", "codex"] as const).map((p) => {
                      const opts = providerModelOptions[p] ?? [];
                      if (opts.length === 0) return null;
                      const currentProvider = provider === "pi" ? "codex" : provider;
                      return (
                        <View key={p} style={styles.modelPickerSection}>
                          <View style={styles.modelPickerSectionHeader}>
                            <Typography
                              variant="caption"
                              weight="medium"
                              tone="secondary"
                            >
                              {p.charAt(0).toUpperCase() + p.slice(1)}:
                            </Typography>
                          </View>
                          {opts.map((opt) => {
                            const isActive = currentProvider === p && model === opt.value;
                            return (
                              <TouchableOpacity
                                key={opt.value}
                                style={[styles.modelPickerOption, isActive && styles.modelPickerOptionActive]}
                                onPress={() => {
                                  triggerHaptic("selection");
                                  if (currentProvider !== p) onProviderChange(p);
                                  onModelChange?.(opt.value);
                                  setModelPickerVisible(false);
                                }}
                                activeOpacity={0.8}
                              >
                                <Typography
                                  variant="subhead"
                                  weight="medium"
                                  color={isActive ? withAlpha(theme.colors.accent, 0.9) : undefined}
                                  tone={isActive ? undefined : "primary"}
                                >
                                  {opt.label}
                                </Typography>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <>
                    <Typography variant="label" tone="muted" transform="uppercase" style={{ marginBottom: spacing["2"], marginLeft: 4 }}>
                      Models
                    </Typography>
                    <ScrollView
                      style={styles.modelPickerList}
                      showsVerticalScrollIndicator
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={styles.modelPickerListContent}
                    >
                      {modelOptions.map((opt) => (
                        <TouchableOpacity
                          key={opt.value}
                          style={[styles.modelPickerOption, model === opt.value && styles.modelPickerOptionActive]}
                          onPress={() => {
                            triggerHaptic("selection");
                            onModelChange?.(opt.value);
                            setModelPickerVisible(false);
                          }}
                          activeOpacity={0.8}
                        >
                          <Typography
                            variant="subhead"
                            weight="medium"
                            color={model === opt.value ? withAlpha(theme.colors.accent, 0.9) : undefined}
                            tone={model === opt.value ? undefined : "primary"}
                          >
                            {opt.label}
                          </Typography>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}
              </Card>
            </EntranceAnimation>
          )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const MIN_TOUCH = 44;
const COMPACT_BTN_SIZE = 36;

function createInputPanelStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      flexDirection: "column",
      gap: spacing["3"],
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: radii.xl,
      paddingVertical: spacing["3"],
      paddingHorizontal: spacing["4"],
      backgroundColor: theme.colors.surface,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    refPills: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing["2"],
      marginBottom: spacing["1"],
    },
    refPill: {
      paddingRight: spacing["1"],
    },
    refPillRemove: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: spacing["1"],
      backgroundColor: theme.colors.accent + "20",
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing["3"],
      minHeight: MIN_TOUCH,
    },
    input: {
      flex: 1,
      fontSize: 17,
      color: theme.colors.textPrimary,
      paddingTop: spacing["2"],
      paddingBottom: spacing["2"],
      paddingLeft: 0,
      paddingRight: 0,
      maxHeight: 150,
      minHeight: 24,
      lineHeight: 24,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.textMuted,
      opacity: 0.5,
      alignSelf: "center",
    },
    statusDotConnected: {
      backgroundColor: "#10B981", // Success emerald
      opacity: 1,
    },
    bottomRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing["2"],
      flexWrap: "nowrap",
    },
    leftGroup: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing["2"],
      minWidth: 0,
    },
    rightGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing["2"],
      flexShrink: 0,
    },
    btnAttach: {
      width: COMPACT_BTN_SIZE,
      height: COMPACT_BTN_SIZE,
      borderRadius: radii.lg,
      backgroundColor: theme.colors.accentSoft,
    },
    modelSelector: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing["0.5"],
      paddingVertical: spacing["0.5"],
      paddingHorizontal: spacing["1"],
      borderRadius: radii.md,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      minHeight: 32,
      minWidth: 0,
      maxWidth: 140,
      justifyContent: "flex-start",
    },
    modelName: {
      flex: 1,
      minWidth: 0,
    },
    modelChevron: {
      flexShrink: 0,
      alignSelf: "center",
    },
    modelPickerBackdrop: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing["4"],
    },
    addDropdownWrap: {
      position: "relative",
    },
    addDropdownCard: {
      position: "absolute",
      bottom: 48,
      left: 0,
      zIndex: 100,
      width: 140,
    },
    addDropdownOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing["3"],
      paddingVertical: spacing["3"],
      paddingHorizontal: spacing["4"],
      backgroundColor: "transparent",
    },
    addDropdownOptionText: {
      flex: 1,
    },
    modelPickerCardContainer: {
      width: "100%",
      maxWidth: 260,
    },
    modelPickerCardInner: {
      width: "100%",
    },
    modelPickerHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      marginBottom: spacing["2"],
      paddingHorizontal: spacing["0.5"],
    },
    modelPickerHeaderSpacer: {
      flex: 1,
    },
    modelPickerCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: radii.sm,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceAlt,
    },
    modelPickerCard: {
      width: "100%",
      maxHeight: "80%",
      borderRadius: radii.lg,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    modelPickerSection: {
      marginBottom: spacing["3"],
    },
    modelPickerSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing["1"],
      paddingHorizontal: spacing["0.5"],
    },
    modelPickerList: {
      maxHeight: 280,
    },
    modelPickerListContent: {
      paddingTop: spacing["0.5"],
      paddingBottom: spacing["2"],
    },
    modelPickerOption: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing["1"],
      paddingHorizontal: spacing["2"],
      borderRadius: radii.sm,
      marginBottom: spacing["1"],
      backgroundColor: "transparent",
      borderWidth: 0,
      minHeight: 36,
    },
    modelPickerOptionActive: {
      backgroundColor: withAlpha(theme.colors.accent, 0.08),
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.accent,
      paddingLeft: spacing["2"] - 3,
    },
    btnUtility: {
      width: COMPACT_BTN_SIZE,
      height: COMPACT_BTN_SIZE,
      borderRadius: radii.lg,
      backgroundColor: theme.colors.surfaceAlt,
    },
    btnTerminateAgent: {
      width: COMPACT_BTN_SIZE,
      height: COMPACT_BTN_SIZE,
      borderRadius: radii.lg,
    },
    btnSend: {
      width: COMPACT_BTN_SIZE,
      height: COMPACT_BTN_SIZE,
      borderRadius: radii.lg,
    },
  });
}
