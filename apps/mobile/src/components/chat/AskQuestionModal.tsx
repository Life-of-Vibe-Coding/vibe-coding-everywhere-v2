import React, { useState, useCallback, useEffect, useMemo } from "react";
import { StyleSheet, Modal, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { PendingAskUserQuestion, AskUserQuestionItem } from "../../core/types";
import { useTheme } from "../../theme/index";
import { Box } from "../ui/box";
import { Button, ButtonText } from "../ui/button";
import { Pressable } from "../ui/pressable";
import { Text } from "../ui/text";
import { EntranceAnimation, AnimatedPressableView, triggerHaptic } from "../../design-system";

export interface AskQuestionModalProps {
  /** When non-null, modal is visible and shows these questions. */
  pending: PendingAskUserQuestion | null;
  onSubmit: (answers: Array<{ header: string; selected: string[] }>) => void;
  onCancel?: () => void;
}

/** Per-question selection: for single-select a single key, for multi-select multiple keys. */
function useSelections(questions: AskUserQuestionItem[]) {
  const [selected, setSelected] = useState<Record<number, string[]>>({});

  useEffect(() => {
    setSelected({});
  }, [questions.length]);

  const toggle = useCallback((questionIndex: number, label: string, multiSelect: boolean) => {
    setSelected((prev) => {
      const current = prev[questionIndex] ?? [];
      const has = current.includes(label);
      if (multiSelect) {
        const next = has ? current.filter((l) => l !== label) : [...current, label];
        return { ...prev, [questionIndex]: next };
      }
      return { ...prev, [questionIndex]: has ? [] : [label] };
    });
  }, []);

  const getSelected = useCallback(
    (questionIndex: number) => selected[questionIndex] ?? [],
    [selected]
  );

  const buildAnswers = useCallback(
    (): Array<{ header: string; selected: string[] }> =>
      questions.map((q, i) => ({
        header: q.header,
        selected: selected[i] ?? [],
      })),
    [questions, selected]
  );

  return { getSelected, toggle, buildAnswers };
}

export function AskQuestionModal({ pending, onSubmit, onCancel }: AskQuestionModalProps) {
  const theme = useTheme();
  const styles = useMemo(() => createAskQuestionStyles(theme), [theme]);
  const questions = pending?.questions ?? [];
  const { getSelected, toggle, buildAnswers } = useSelections(questions);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentIndex(0);
  }, [questions.length]);

  const handleConfirm = useCallback(() => {
    const answers = buildAnswers();
    onSubmit(answers);
  }, [buildAnswers, onSubmit]);

  const canSubmit = questions.every((q: any, i: number) => (getSelected(i).length ?? 0) > 0);
  const isMultiCard = questions.length > 1;
  const q = questions[currentIndex];
  const currentHasSelection = q ? (getSelected(currentIndex).length ?? 0) > 0 : false;
  const canGoNext = currentHasSelection;
  const isLast = currentIndex === questions.length - 1;

  if (!pending || questions.length === 0) return null;

  const renderQuestion = (qIndex: number) => {
    const question = questions[qIndex];
    if (!question) return null;
    return (
      <Box key={`q-${qIndex}`} style={styles.questionBlock} className="mb-5">
        <Text size="md" bold className="text-typography-900 mb-1">{question.header}</Text>
        {question.question ? (
          <Text size="sm" className="text-typography-500 mb-2.5">{question.question}</Text>
        ) : null}
        <Box style={styles.options} className="gap-2">
          {question.options.map((opt: any, oIndex: number) => {
            const sel = getSelected(qIndex);
            const isSelected = sel.includes(opt.label);
            return (
              <AnimatedPressableView
                key={`${qIndex}-${oIndex}`}
                onPress={() => {
                  triggerHaptic("selection");
                  toggle(qIndex, opt.label, !!question.multiSelect);
                }}
                scaleTo={0.98}
                style={[styles.option, isSelected && styles.optionSelected]}
              >
                <Text size="md" bold className={isSelected ? "text-primary-500" : "text-typography-900"}>{opt.label}</Text>
                {opt.description ? (
                  <Text size="xs" numberOfLines={2} className="text-typography-500 mt-0.5">{opt.description}</Text>
                ) : null}
              </AnimatedPressableView>
            );
          })}
        </Box>
      </Box>
    );
  };

  return (
    <Modal
      visible
      animationType="slide"
      transparent
      onRequestClose={onCancel}
    >
      <Box style={styles.overlay} className="flex-1 bg-black/40 justify-end">
        <SafeAreaView style={styles.safe}>
          <EntranceAnimation variant="slideUp" duration={320}>
          <Box style={styles.card} className="rounded-t-2xl pt-4 pb-6 px-5 border border-outline-200 border-b-0 bg-surface shadow-lg">
            <Box style={styles.titleRow} className="flex-row items-center justify-between mb-3">
              <Text size="lg" bold className="text-typography-900">Please choose</Text>
              {isMultiCard && (
                <Box style={styles.stepper} className="flex-row gap-2">
                  {questions.map((_: any, i: number) => (
                    <Pressable
                      key={i}
                      onPress={() => setCurrentIndex(i)}
                      hitSlop={16}
                      className="min-w-11 min-h-11 items-center justify-center rounded-full active:opacity-80"
                    >
                      <Box
                        className={`w-2.5 h-2.5 rounded-full ${i === currentIndex ? "bg-primary-500" : (getSelected(i).length ?? 0) > 0 ? "bg-success-500" : "bg-outline-400"}`}
                        style={i === currentIndex ? { transform: [{ scale: 1.2 }] } : undefined}
                      />
                    </Pressable>
                  ))}
                </Box>
              )}
            </Box>
            {isMultiCard ? (
              <>
                <Box style={styles.flashcard} className="min-h-45">
                  {renderQuestion(currentIndex)}
                </Box>
                <Text size="sm" className="text-typography-500 mt-2">{currentIndex + 1} of {questions.length}</Text>
              </>
            ) : (
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {renderQuestion(0)}
              </ScrollView>
            )}
            <Box style={styles.actions} className="flex-row items-center justify-between gap-3 mt-4">
              {onCancel && (
                <Pressable onPress={onCancel} className="py-3 px-5 rounded-xl min-h-11 justify-center active:opacity-80">
                  <Text size="md" className="text-typography-500">Cancel</Text>
                </Pressable>
              )}
              {isMultiCard ? (
                <>
                  {currentIndex > 0 ? (
                    <Pressable onPress={() => setCurrentIndex((i) => i - 1)} className="py-3 px-4 min-h-11 justify-center active:opacity-80 rounded-xl">
                      <Text size="md" bold className="text-primary-500">← Back</Text>
                    </Pressable>
                  ) : (
                    <Box className="w-15" />
                  )}
                  {isLast ? (
                    <Button action="primary" variant="solid" size="md" onPress={handleConfirm} isDisabled={!canSubmit} className="py-3 px-6 rounded-xl">
                      <ButtonText className={!canSubmit ? "text-typography-500" : "text-typography-0"}>Confirm</ButtonText>
                    </Button>
                  ) : (
                    <Button action="primary" variant="solid" size="md" onPress={() => setCurrentIndex((i) => i + 1)} isDisabled={!canGoNext} className="py-3 px-6 rounded-xl">
                      <ButtonText className={!canGoNext ? "text-typography-500" : "text-typography-0"}>Next →</ButtonText>
                    </Button>
                  )}
                </>
              ) : (
                <Button action="primary" variant="solid" size="md" onPress={handleConfirm} isDisabled={!canSubmit} className="py-3 px-6 rounded-xl">
                  <ButtonText className={!canSubmit ? "text-typography-500" : "text-typography-0"}>Confirm</ButtonText>
                </Button>
              )}
            </Box>
          </Box>
          </EntranceAnimation>
        </SafeAreaView>
      </Box>
    </Modal>
  );
}

function createAskQuestionStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "flex-end",
    },
    safe: {
      maxHeight: "80%",
    },
    card: {
      backgroundColor: theme.colors.surfaceAlt,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 16,
      paddingBottom: 24,
      paddingHorizontal: 20,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: theme.colors.border,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    title: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    stepper: {
      flexDirection: "row",
      gap: 8,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.colors.border,
    },
    dotActive: {
      backgroundColor: theme.accent,
      transform: [{ scale: 1.2 }],
    },
    dotAnswered: {
      backgroundColor: theme.colors.success,
    },
    flashcard: {
      minHeight: 180,
    },
    progressText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 8,
    },
    scroll: {
      maxHeight: 360,
    },
    scrollContent: {
      paddingBottom: 16,
    },
    questionBlock: {
      marginBottom: 20,
    },
    header: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textPrimary,
      marginBottom: 4,
    },
    questionText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 10,
    },
    options: {
      gap: 8,
    },
    option: {
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    optionSelected: {
      borderColor: theme.accent,
      backgroundColor: theme.colors.accentSoft,
    },
    optionLabel: {
      fontSize: 15,
      fontWeight: "500",
      color: theme.colors.textPrimary,
    },
    optionLabelSelected: {
      color: theme.accent,
    },
    optionDesc: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    hint: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 8,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginTop: 16,
    },
    btnBack: {
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    btnBackText: {
      fontSize: 16,
      color: theme.accent,
      fontWeight: "600",
    },
    btnBackPlaceholder: {
      width: 60,
    },
    btnNext: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 12,
      backgroundColor: theme.accent,
    },
    btnCancel: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      backgroundColor: "transparent",
    },
    btnCancelText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      fontWeight: "500",
    },
    btnConfirm: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 12,
      backgroundColor: theme.accent,
    },
    btnConfirmDisabled: {
      backgroundColor: theme.colors.border,
    },
    btnConfirmText: {
      fontSize: 16,
      color: "#fff",
      fontWeight: "600",
    },
    btnConfirmTextDisabled: {
      color: theme.colors.textSecondary,
    },
  });
}
