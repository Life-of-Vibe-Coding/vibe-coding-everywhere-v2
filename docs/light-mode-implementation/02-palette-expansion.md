# Phase 2: Palette Expansion

## Objective
Design and implement the light mode color specifications. Neutral color palettes in Mobile Cocoa currently serve a dark UI. Generating an equivalent, premium light UI requires adapting to the warm, natural aesthetics of the reference "Cocoa" theme image, rather than relying on generic grays or glassmorphism.

## 1. Defining Semantic Tokens
Inside `design-system/theme.tsx`, the `buildColors(mode: ColorMode)` function must produce distinctly crafted palettes.

### Light Theme Blueprint
```typescript
const isDark = mode === "dark";

export const buildColors = (mode: ColorMode): ThemeColors => {
  const isDark = mode === "dark";

  return {
    // Base Backgrounds
    background: isDark ? neutralColors.black : "#F9F3EA", // Soft cream from the image background
    surface: isDark ? "#151821" : "#F1E5D1", // Light tan for surfaces/cards
    surfaceMuted: isDark ? "#1E212B" : "#E2CDBA", // Deeper tan for secondary backgrounds
    
    // Typography
    textPrimary: isDark ? "#f5f7fb" : "#4A2E1B", // Deep chocolate brown
    textMuted: isDark ? neutralColors.gray400 : "#87664B", // Medium warm brown
    textInverse: isDark ? neutralColors.black : "#F9F3EA",

    // Accents & Borders
    border: isDark ? "rgba(255, 255, 255, 0.1)" : "#D1BCA3", // Subdued tan border
    primary: brandColors.cocoa, // Deepest rich cocoa brown for actions
    
    // Add more granular tokens mapped correctly...
  };
};
```

## 2. Using the Reference Image Theme
Instead of relying on glassmorphism (which adds visual noise and reduces contrast on light themes), we will fully embrace the flat, warm, and natural aesthetics from the uploaded artwork.

### Embracing Earthy and Warm Color Blocking
The reference image introduces a strong, cohesive identity built around natural cocoa hues. We will structure the UI to map this layered aesthetic:
- **Base Canvas:** Use the soft cream (`#F9F3EA`) as the foundational canvas instead of pure white or cool grays.
- **Elevated Surfaces:** UI elements (cards, input fields) will step through the varying shades of tan to create depth natively, without requiring drop shadows or blur effects.
- **Iconography & Outlines:** Use the medium brown from the illustrated cocoa pod (`#87664B`) for line art, borders, and unselected icons, creating a hand-drawn, organic feel.
- **Active Accents:** The rich, dark chocolate brown flowing through the image serves perfectly for CTA buttons, active tab states, and primary typography.

By moving away from frosted glass to this warm, opaque, color-blocked approach, the light mode feels deliberate, brand-aligned, and extremely premium. Ensure the token framework exposes specific keys for this new palette (e.g., `cocoaCream`, `cocoaTan`, `cocoaBrown`) rather than `glassBackground`.
