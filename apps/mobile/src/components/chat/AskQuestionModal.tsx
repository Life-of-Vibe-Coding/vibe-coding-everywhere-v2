import React, { useState, useCallback, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { PendingAskUserQuestion, AskUserQuestionItem } from "../core/types";
import { useTheme } from "../../theme/index";

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

  const canSubmit = questions.every((q, i) => (getSelected(i).length ?? 0) > 0);
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
      <View key={`q-${qIndex}`} style={styles.questionBlock}>
        <Text style={styles.header}>{question.header}</Text>
        {question.question ? (
          <Text style={styles.questionText}>{question.question}</Text>
        ) : null}
        <View style={styles.options}>
          {question.options.map((opt, oIndex) => {
            const sel = getSelected(qIndex);
            const isSelected = sel.includes(opt.label);
            return (
              <TouchableOpacity
                key={`${qIndex}-${oIndex}`}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => toggle(qIndex, opt.label, !!question.multiSelect)}
                activeOpacity={0.8}
              >
                <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                  {opt.label}
                </Text>
                {opt.description ? (
                  <Text style={styles.optionDesc} numberOfLines={2}>
                    {opt.description}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible
      animationType="slide"
      transparent
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.card}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Please choose</Text>
              {isMultiCard && (
                <View style={styles.stepper}>
                  {questions.map((_, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.dot,
                        i === currentIndex && styles.dotActive,
                        (getSelected(i).length ?? 0) > 0 && styles.dotAnswered,
                      ]}
                      onPress={() => setCurrentIndex(i)}
                      activeOpacity={0.8}
                    />
                  ))}
                </View>
              )}
            </View>
            {isMultiCard ? (
              <>
                <View style={styles.flashcard}>
                  {renderQuestion(currentIndex)}
                </View>
                <Text style={styles.progressText}>
                  {currentIndex + 1} of {questions.length}
                </Text>
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
            <View style={styles.actions}>
              {onCancel && (
                <TouchableOpacity
                  style={styles.btnCancel}
                  onPress={onCancel}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
              )}
              {isMultiCard ? (
                <>
                  {currentIndex > 0 ? (
                    <TouchableOpacity
                      style={styles.btnBack}
                      onPress={() => setCurrentIndex((i) => i - 1)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.btnBackText}>← Back</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.btnBackPlaceholder} />
                  )}
                  {isLast ? (
                    <TouchableOpacity
                      style={[styles.btnConfirm, !canSubmit && styles.btnConfirmDisabled]}
                      onPress={handleConfirm}
                      disabled={!canSubmit}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.btnConfirmText, !canSubmit && styles.btnConfirmTextDisabled]}>
                        Confirm
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.btnNext, !canGoNext && styles.btnConfirmDisabled]}
                      onPress={() => setCurrentIndex((i) => i + 1)}
                      disabled={!canGoNext}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.btnConfirmText, !canGoNext && styles.btnConfirmTextDisabled]}>
                        Next →
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.btnConfirm, !canSubmit && styles.btnConfirmDisabled]}
                  onPress={handleConfirm}
                  disabled={!canSubmit}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.btnConfirmText, !canSubmit && styles.btnConfirmTextDisabled]}>
                    Confirm
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </SafeAreaView>
      </View>
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
    backgroundColor: theme.surfaceBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: theme.borderColor,
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
    color: theme.textPrimary,
  },
  stepper: {
    flexDirection: "row",
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.borderColor,
  },
  dotActive: {
    backgroundColor: theme.accent,
    transform: [{ scale: 1.2 }],
  },
  dotAnswered: {
    backgroundColor: theme.success,
  },
  flashcard: {
    minHeight: 180,
  },
  progressText: {
    fontSize: 13,
    color: theme.textMuted,
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
    color: theme.textPrimary,
    marginBottom: 4,
  },
  questionText: {
    fontSize: 14,
    color: theme.textMuted,
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
    borderColor: theme.borderColor,
    backgroundColor: theme.cardBg,
  },
  optionSelected: {
    borderColor: theme.accent,
    backgroundColor: theme.accentLight,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: theme.textPrimary,
  },
  optionLabelSelected: {
    color: theme.accent,
  },
  optionDesc: {
    fontSize: 13,
    color: theme.textMuted,
    marginTop: 2,
  },
  hint: {
    fontSize: 13,
    color: theme.textMuted,
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
    color: theme.textMuted,
    fontWeight: "500",
  },
  btnConfirm: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: theme.accent,
  },
  btnConfirmDisabled: {
    backgroundColor: theme.borderColor,
  },
  btnConfirmText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
  btnConfirmTextDisabled: {
    color: theme.textMuted,
  },
  });
}
