import React, { useState, useCallback, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/index";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { ScrollView } from "@/components/ui/scroll-view";
import { Pressable } from "@/components/ui/pressable";
import { Switch } from "@/components/ui/switch";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { CloseIcon, ChevronRightIcon } from "@/components/icons/ChatActionIcons";
import { SkillDetailSheet } from "@/components/settings/SkillDetailSheet";
import { getCategoryIcon } from "@/components/icons/SkillCategoryIcons";
import { ScrollView as RNScrollView } from "react-native";

import { CATEGORIES, type Category, CATEGORY_COLORS, CATEGORY_COLORS_LIGHT } from "@/utils/skillColors";

type Skill = { id: string; name: string; description: string; category?: string };

export interface SkillConfigurationViewProps {
  isOpen: boolean;
  onClose: () => void;
  presentation?: "modal" | "inline";
  /** Called when user taps a skill to view details. */
  onSelectSkill?: (skillId: string) => void;
  /** Currently selected skill ID for detail view (rendered as overlay on top) */
  selectedSkillId?: string | null;
  /** Called when user closes the skill detail overlay */
  onCloseSkillDetail?: () => void;
  /** Base URL for API (e.g. http://localhost:3456) */
  serverBaseUrl: string;
}

export function SkillConfigurationView({
  isOpen,
  onClose,
  presentation = "modal",
  onSelectSkill,
  selectedSkillId = null,
  onCloseSkillDetail,
  serverBaseUrl,
}: SkillConfigurationViewProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme.mode === "dark";
  const pageSurface = isDark ? "rgba(7, 11, 21, 0.94)" : "rgba(255, 255, 255, 0.96)";
  const headerSurface = isDark ? "rgba(10, 16, 30, 0.94)" : "rgba(248, 250, 252, 0.98)";
  const panelBorder = isDark ? "rgba(162, 210, 255, 0.28)" : "rgba(15, 23, 42, 0.12)";
  const titleColor = isDark ? "#EAF4FF" : "#0F172A";
  const bodyColor = isDark ? "#D9E8F9" : "#1E293B";
  const mutedColor = isDark ? "rgba(217, 232, 249, 0.82)" : "#475569";
  const cardSurface = isDark ? "rgba(16, 24, 40, 0.9)" : "rgba(248, 250, 252, 0.96)";
  const pressedSurface = isDark ? "rgba(173, 222, 255, 0.14)" : "rgba(15, 23, 42, 0.06)";

  const [skills, setSkills] = useState<Skill[]>([]);
  const [enabledSkillIds, setEnabledSkillIds] = useState<Set<string>>(new Set());
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsSaving, setSkillsSaving] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category>("All");

  useEffect(() => {
    if (isOpen && serverBaseUrl) {
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
  }, [isOpen, serverBaseUrl]);

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

  const filteredSkills =
    selectedCategory === "All"
      ? skills
      : skills.filter((s) => (s.category ?? "Development") === selectedCategory);

  const categoryCounts: Record<Category, number> = {
    All: skills.length,
    Development: skills.filter((s) => (s.category ?? "Development") === "Development").length,
    "UI/UX": skills.filter((s) => s.category === "UI/UX").length,
    DevOps: skills.filter((s) => s.category === "DevOps").length,
    Debug: skills.filter((s) => s.category === "Debug").length,
    Prompt: skills.filter((s) => s.category === "Prompt").length,
  };

  if (!isOpen) return null;

  const safeStyle = {
    paddingTop: Math.max(insets.top, 4),
    paddingBottom: Math.max(insets.bottom, 8),
  };
  const detailOverlayStyle = {
    paddingTop: 0,
    paddingBottom: 0,
  };

  const showDetailOverlay = Boolean(selectedSkillId);
  const colorPalette = isDark ? CATEGORY_COLORS : CATEGORY_COLORS_LIGHT;

  const content = (
    <Box className="flex-1 overflow-hidden" style={{ backgroundColor: pageSurface }}>
      {showDetailOverlay ? (
        <Box className="flex-1" style={detailOverlayStyle}>
          <SkillDetailSheet
            embedded
            isOpen
            skillId={selectedSkillId!}
            serverBaseUrl={serverBaseUrl}
            onClose={onCloseSkillDetail ?? (() => { })}
          />
        </Box>
      ) : (
        <Box className="flex-1" style={safeStyle}>
          <Box
            className="flex-row items-center justify-between py-4 px-5 border-b"
            style={{ borderBottomColor: panelBorder, backgroundColor: headerSurface }}
          >
            <Text className="text-lg font-semibold" style={{ color: titleColor }}>
              Skill Configuration
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityLabel="Close skill configuration"
              className="p-2 min-w-11 min-h-11 items-center justify-center"
            >
              <CloseIcon size={20} color={mutedColor} />
            </Pressable>
          </Box>

          {/* Category Navbar */}
          <Box
            style={{
              borderBottomColor: panelBorder,
              borderBottomWidth: 1,
              backgroundColor: isDark ? "rgba(10, 16, 30, 0.6)" : "rgba(248, 250, 252, 0.7)",
            }}
          >
            <RNScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                gap: 8,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat;
                const colors = colorPalette[cat];
                const count = categoryCounts[cat];

                return (
                  <Pressable
                    key={cat}
                    onPress={() => setSelectedCategory(cat)}
                    accessibilityLabel={`Filter by ${cat}`}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActive }}
                    style={({ pressed }) => [
                      {
                        paddingHorizontal: 14,
                        paddingVertical: 7,
                        borderRadius: 20,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        backgroundColor: isActive
                          ? colors.active
                          : pressed
                            ? (isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)")
                            : (isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)"),
                        borderWidth: 1,
                        borderColor: isActive
                          ? (isDark ? `${colors.text}44` : `${colors.text}33`)
                          : (isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)"),
                      },
                    ]}
                  >
                    {getCategoryIcon(cat, {
                      color: isActive ? colors.text : mutedColor,
                      size: 14,
                      strokeWidth: isActive ? 2.5 : 2
                    })}
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: isActive ? "700" : "500",
                        color: isActive ? colors.text : mutedColor,
                        letterSpacing: -0.2,
                      }}
                    >
                      {cat}
                    </Text>
                    {count > 0 && (
                      <Box
                        style={{
                          backgroundColor: isActive
                            ? `${colors.text}22`
                            : (isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.06)"),
                          borderRadius: 10,
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                          minWidth: 20,
                          alignItems: "center" as const,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "600",
                            color: isActive ? colors.text : mutedColor,
                          }}
                        >
                          {count}
                        </Text>
                      </Box>
                    )}
                  </Pressable>
                );
              })}
            </RNScrollView>
          </Box>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 24,
            }}
            showsVerticalScrollIndicator={false}
          >
            <Text className="text-sm mb-5 leading-5" style={{ color: mutedColor }}>
              Enable skills for Pi agent. When enabled, skill content is
              included in the prompt. Tap a skill to view its details.
            </Text>
            {skillsLoading ? (
              <Spinner
                size="small"
                color={theme.colors.accent}
                style={{ marginTop: 16 }}
              />
            ) : skillsError ? (
              <Text className="text-sm text-error-500 mt-4">{skillsError}</Text>
            ) : filteredSkills.length === 0 ? (
              <Text className="text-sm mt-4" style={{ color: mutedColor }}>
                {skills.length === 0
                  ? "No skills found in project skills folder."
                  : `No skills in "${selectedCategory}" category.`}
              </Text>
            ) : (
              filteredSkills.map((skill) => {
                const catColors = colorPalette[(skill.category as Category) ?? "Development"];
                return (
                  <Box
                    key={skill.id}
                    className="flex-row items-center justify-between py-3.5 px-4 rounded-xl border mb-2.5"
                    style={{ backgroundColor: cardSurface, borderColor: panelBorder }}
                  >
                    <Pressable
                      onPress={() => handleSkillRowPress(skill.id)}
                      hitSlop={{ top: 12, bottom: 12, left: 0, right: 12 }}
                      accessibilityLabel={`${skill.name}. View details`}
                      accessibilityHint="Opens skill details"
                      accessibilityRole="button"
                      className="flex-1 flex-row items-center mr-3"
                      style={({ pressed }) => (pressed ? { backgroundColor: pressedSurface, borderRadius: 10 } : undefined)}
                    >
                      <Box className="flex-1 mr-2 min-w-0">
                        <Box style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text className="text-[15px] font-semibold" style={{ color: bodyColor }}>
                            {skill.name}
                          </Text>
                          {selectedCategory === "All" && skill.category && (
                            <Box
                              style={{
                                backgroundColor: catColors.active,
                                borderRadius: 8,
                                paddingHorizontal: 6,
                                paddingVertical: 1,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontWeight: "600",
                                  color: catColors.text,
                                  letterSpacing: -0.2,
                                }}
                              >
                                {skill.category}
                              </Text>
                            </Box>
                          )}
                        </Box>
                        {skill.description ? (
                          <Text
                            className="text-xs mt-1 leading-4"
                            style={{ color: mutedColor }}
                            numberOfLines={2}
                          >
                            {skill.description}
                          </Text>
                        ) : null}
                      </Box>
                      <ChevronRightIcon size={18} color={mutedColor} />
                    </Pressable>
                    <Box className="shrink-0">
                      <Switch
                        value={enabledSkillIds.has(skill.id)}
                        onValueChange={(val) => handleSkillToggle(skill.id, val)}
                        disabled={skillsSaving}
                        accessibilityLabel={`Enable ${skill.name}`}
                        trackColor={{
                          false: isDark ? "rgba(255, 255, 255, 0.25)" : "rgba(15, 23, 42, 0.2)",
                          true: isDark ? `${catColors.text}66` : `${catColors.text}55`,
                        }}
                        thumbColor={
                          enabledSkillIds.has(skill.id)
                            ? catColors.text
                            : isDark
                              ? "rgba(226, 238, 252, 0.9)"
                              : "#F8FAFC"
                        }
                      />
                    </Box>
                  </Box>
                );
              })
            )}
          </ScrollView>
        </Box>
      )}
    </Box>
  );

  if (presentation === "inline") {
    return content;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {content}
    </Modal>
  );
}
