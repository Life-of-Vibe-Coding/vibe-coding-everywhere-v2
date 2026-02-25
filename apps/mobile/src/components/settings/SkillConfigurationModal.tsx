import React, { useState, useCallback, useEffect } from "react";
import {
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/index";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { ScrollView } from "@/components/ui/scroll-view";
import { Pressable } from "@/components/ui/pressable";
import { Switch } from "@/components/ui/switch";
import { Modal } from "@/components/ui/modal";
import { CloseIcon, ChevronRightIcon } from "@/components/icons/ChatActionIcons";
import { SkillDetailSheet } from "@/components/settings/SkillDetailSheet";
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
  const insets = useSafeAreaInsets();

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

  const safeStyle = {
    paddingTop: Math.max(insets.top, 8),
    paddingBottom: Math.max(insets.bottom, 8),
  };

  const showDetailOverlay = Boolean(selectedSkillId);

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
    >
      <Box className="flex-1 bg-background-0 overflow-hidden">
        {showDetailOverlay ? (
          <Box className="flex-1" style={safeStyle}>
            <SkillDetailSheet
              embedded
              visible
              skillId={selectedSkillId!}
              serverBaseUrl={serverBaseUrl}
              onClose={onCloseSkillDetail ?? (() => {})}
            />
          </Box>
        ) : (
          <Box className="flex-1" style={safeStyle}>
            <Box className="flex-row items-center justify-between py-4 px-5 border-b border-outline-500">
              <Text className="text-lg font-semibold text-text-primary">
                Skill Configuration
              </Text>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                accessibilityLabel="Close skill configuration"
                className="p-2 min-w-11 min-h-11 items-center justify-center"
              >
                <CloseIcon size={20} color={theme.colors.textSecondary} />
              </Pressable>
            </Box>
            <ScrollView
              className="flex-1"
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingTop: 16,
                paddingBottom: 24,
              }}
              showsVerticalScrollIndicator={false}
            >
              <Text className="text-sm text-text-muted mb-5 leading-5">
                Enable skills for the Pi agent. When enabled, skill content is
                included in the prompt. Tap a skill to view its details.
              </Text>
              {skillsLoading ? (
                <ActivityIndicator
                  size="small"
                  color={theme.colors.accent}
                  style={{ marginTop: 16 }}
                />
              ) : skillsError ? (
                <Text className="text-sm text-error-500 mt-4">{skillsError}</Text>
              ) : skills.length === 0 ? (
                <Text className="text-sm text-text-muted mt-4">
                  No skills found in project skills folder.
                </Text>
              ) : (
                skills.map((skill) => (
                  <Box
                    key={skill.id}
                    className="flex-row items-center justify-between py-3.5 px-4 rounded-xl bg-secondary-100 border border-outline-500 mb-2.5"
                  >
                    <Pressable
                      onPress={() => handleSkillRowPress(skill.id)}
                      hitSlop={{ top: 12, bottom: 12, left: 0, right: 12 }}
                      accessibilityLabel={`${skill.name}. View details`}
                      accessibilityRole="button"
                      className="flex-1 flex-row items-center mr-3"
                    >
                      <Box className="flex-1 mr-2 min-w-0">
                        <Text className="text-[15px] font-semibold text-text-primary">
                          {skill.name}
                        </Text>
                        {skill.description ? (
                          <Text
                            className="text-xs text-text-muted mt-1 leading-4"
                            numberOfLines={2}
                          >
                            {skill.description}
                          </Text>
                        ) : null}
                      </Box>
                      <ChevronRightIcon size={18} color={theme.colors.textSecondary} />
                    </Pressable>
                    <Box className="shrink-0">
                      <Switch
                        value={enabledSkillIds.has(skill.id)}
                        onValueChange={(val) => handleSkillToggle(skill.id, val)}
                        disabled={skillsSaving}
                        trackColor={{
                          false: theme.colors.border,
                          true: theme.colors.accentSoft,
                        }}
                        thumbColor={
                          enabledSkillIds.has(skill.id)
                            ? theme.colors.accent
                            : theme.colors.surface
                        }
                      />
                    </Box>
                  </Box>
                ))
              )}
            </ScrollView>
          </Box>
        )}
      </Box>
    </Modal>
  );
}
