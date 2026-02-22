import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Platform,
  ActivityIndicator,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../theme/index";
import { CloseIcon, ChevronRightIcon } from "../icons/ChatActionIcons";
import { SkillDetailSheet } from "./SkillDetailSheet";
type Skill = { id: string; name: string; description: string };

export interface SkillConfigurationModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called when user taps a skill to view details. */
  onSelectSkill?: (skillId: string) => void;
  /** Currently selected skill ID for detail view (rendered as overlay on top) */
  selectedSkillId?: string | null;
  /** Called when user closes the skill detail overlay */
  onCloseSkillDetail?: () => void;
  /** Base URL for API (e.g. http://localhost:3456) */
  serverBaseUrl: string;
}

export function SkillConfigurationModal({
  visible,
  onClose,
  onSelectSkill,
  selectedSkillId = null,
  onCloseSkillDetail,
  serverBaseUrl,
}: SkillConfigurationModalProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [skills, setSkills] = useState<Skill[]>([]);
  const [enabledSkillIds, setEnabledSkillIds] = useState<Set<string>>(new Set());
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsSaving, setSkillsSaving] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && serverBaseUrl) {
      setSkillsLoading(true);
      setSkillsError(null);
      Promise.all([
        fetch(`${serverBaseUrl}/api/skills`).then(async (r) => {
          if (!r.ok)
            throw new Error(
              r.status === 404
                ? "Skills API not available. Restart the server to enable skills."
                : `Skills API error: ${r.status}`
            );
          return r.json();
        }),
        fetch(`${serverBaseUrl}/api/skills-enabled`).then(async (r) => {
          if (!r.ok) return { enabledIds: [] };
          return r.json();
        }),
      ])
        .then(([skillsData, enabledData]) => {
          setSkills(skillsData?.skills ?? []);
          setEnabledSkillIds(new Set(enabledData?.enabledIds ?? []));
        })
        .catch((err) => {
          setSkills([]);
          setEnabledSkillIds(new Set());
          setSkillsError(err?.message ?? "Failed to load skills");
        })
        .finally(() => setSkillsLoading(false));
    }
  }, [visible, serverBaseUrl]);

  const handleSkillToggle = useCallback(
    (skillId: string, enabled: boolean) => {
      const next = new Set(enabledSkillIds);
      if (enabled) next.add(skillId);
      else next.delete(skillId);
      setEnabledSkillIds(next);
      setSkillsSaving(true);
      fetch(`${serverBaseUrl}/api/skills-enabled`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabledIds: Array.from(next) }),
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed"))))
        .then((data) => setEnabledSkillIds(new Set(data?.enabledIds ?? [])))
        .catch(() => setEnabledSkillIds(enabledSkillIds))
        .finally(() => setSkillsSaving(false));
    },
    [serverBaseUrl, enabledSkillIds]
  );

  const handleSkillRowPress = useCallback(
    (skillId: string) => {
      onSelectSkill?.(skillId);
    },
    [onSelectSkill]
  );

  if (!visible) return null;

  return (
    <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onClose}
      >
        <View style={styles.fullScreen}>
          <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
              <Text style={styles.title}>Skill Configuration</Text>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={12}
                accessibilityLabel="Close skill configuration"
              >
                <CloseIcon size={20} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.intro}>
                Enable skills for the Pi agent. When enabled, skill content is
                included in the prompt. Tap a skill to view its details.
              </Text>
              {skillsLoading ? (
                <ActivityIndicator
                  size="small"
                  color={theme.accent}
                  style={styles.loader}
                />
              ) : skillsError ? (
                <Text style={styles.error}>{skillsError}</Text>
              ) : skills.length === 0 ? (
                <Text style={styles.empty}>
                  No skills found in project skills folder.
                </Text>
              ) : (
                skills.map((skill) => (
                  <View key={skill.id} style={styles.skillCard}>
                    <TouchableOpacity
                      style={styles.skillInfoTouchable}
                      onPress={() => handleSkillRowPress(skill.id)}
                      activeOpacity={0.8}
                      hitSlop={{ top: 12, bottom: 12, left: 0, right: 12 }}
                      accessibilityLabel={`${skill.name}. View details`}
                      accessibilityRole="button"
                    >
                      <View style={styles.skillInfo}>
                        <Text style={styles.skillName}>{skill.name}</Text>
                        {skill.description ? (
                          <Text
                            style={styles.skillDescription}
                            numberOfLines={2}
                          >
                            {skill.description}
                          </Text>
                        ) : null}
                      </View>
                      <ChevronRightIcon size={18} color={theme.textMuted} />
                    </TouchableOpacity>
                    <View style={styles.switchWrapper}>
                      <Switch
                        value={enabledSkillIds.has(skill.id)}
                        onValueChange={(val) => handleSkillToggle(skill.id, val)}
                        disabled={skillsSaving}
                        trackColor={{
                          false: theme.borderColor,
                          true: theme.accentLight,
                        }}
                        thumbColor={
                          enabledSkillIds.has(skill.id)
                            ? theme.accent
                            : theme.cardBg
                        }
                      />
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </SafeAreaView>
          {/* Skill detail overlay - rendered on top of config list (iOS can't stack native Modals) */}
          {selectedSkillId && (
            <View style={styles.detailOverlay}>
              <SkillDetailSheet
                embedded
                visible
                skillId={selectedSkillId}
                serverBaseUrl={serverBaseUrl}
                onClose={onCloseSkillDetail ?? (() => {})}
              />
            </View>
          )}
        </View>
      </Modal>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    fullScreen: {
      flex: 1,
      backgroundColor: theme.beigeBg,
    },
    detailOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 10,
      backgroundColor: theme.beigeBg,
    },
    safe: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.borderColor,
    },
    title: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.textPrimary,
    },
    closeBtn: {
      padding: 8,
      minWidth: 44,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24,
    },
    intro: {
      fontSize: 14,
      color: theme.textMuted,
      marginBottom: 20,
      lineHeight: 20,
    },
    loader: {
      marginTop: theme.spacing?.sm ?? 16,
    },
    error: {
      fontSize: 14,
      color: theme.danger,
      marginTop: theme.spacing?.sm ?? 16,
    },
    empty: {
      fontSize: 14,
      color: theme.textMuted,
      marginTop: theme.spacing?.sm ?? 16,
    },
    skillCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: theme.cardBg,
      borderWidth: 1,
      borderColor: theme.borderColor,
      marginBottom: 10,
    },
    skillInfoTouchable: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      marginRight: 12,
    },
    skillInfo: {
      flex: 1,
      marginRight: 8,
    },
    skillName: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.textPrimary,
    },
    skillDescription: {
      fontSize: 12,
      color: theme.textMuted,
      marginTop: 4,
      lineHeight: 16,
    },
    switchWrapper: {
      flexShrink: 0,
    },
  });
}
