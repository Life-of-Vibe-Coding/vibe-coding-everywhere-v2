export const CATEGORIES = ["All", "Development", "UI/UX", "DevOps", "Debug", "Prompt"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_COLORS: Record<Category, { active: string; text: string }> = {
  All: { active: "rgba(139, 117, 255, 0.35)", text: "#A78BFA" },
  Development: { active: "rgba(59, 130, 246, 0.35)", text: "#60A5FA" },
  "UI/UX": { active: "rgba(236, 72, 153, 0.35)", text: "#F472B6" },
  DevOps: { active: "rgba(16, 185, 129, 0.35)", text: "#34D399" },
  Debug: { active: "rgba(148, 163, 184, 0.35)", text: "#94A3B8" },
  Prompt: { active: "rgba(99, 102, 241, 0.35)", text: "#818CF8" },
};

export const CATEGORY_COLORS_LIGHT: Record<Category, { active: string; text: string }> = {
  All: { active: "rgba(109, 40, 217, 0.15)", text: "#7C3AED" },
  Development: { active: "rgba(37, 99, 235, 0.15)", text: "#2563EB" },
  "UI/UX": { active: "rgba(219, 39, 119, 0.15)", text: "#DB2777" },
  DevOps: { active: "rgba(5, 150, 105, 0.15)", text: "#059669" },
  Debug: { active: "rgba(71, 85, 105, 0.15)", text: "#475569" },
  Prompt: { active: "rgba(79, 70, 229, 0.15)", text: "#4F46E5" },
};
