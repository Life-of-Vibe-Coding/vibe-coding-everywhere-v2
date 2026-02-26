# Phase 4: Component Refactoring

## Objective

Methodically comb through all existing `.tsx` components and obliterate any remaining hardcoded hex and rgba color values.

## 1. Audit Strategy

Search the codebase for the following anti-patterns:

- `color: "#FFFFFF"` or `color: "#FFF"` or `color: "white"`
- `backgroundColor: "#000000"` or `black`
- `rgba(255,` and `rgba(0,` (especially outside of `ui-primitives-allowlist.json`)
- `<InputWrapper>` usage or any component rendering the raw SVG `<polygon>` backgrounds designed for cyberpunk.

## 2. Refactoring Hotspots

Based on the **"Aesthetic AI Coder Home Variant 1"** Stitch reference design, the light mode embraces a chocolate-themed color palette consisting of various shades of beige, cream, and brown. The design features soft, organic, wavy shapes in the background, reminiscent of latte art or swirling chocolate, along with faint line drawings of cocoa beans and spirals. Components span warm mocha, cream, beige, and tan tones using completely rounded/pill-shaped wrappers, dark brown typography, and "light" frosted glassmorphism (translucent warm overlays rather than solid color blocking).

We identified several critical components that frequently skirt the theme engine. Pay special attention to:

### A. Headbars & Navigation (`AppHeaderBar`, Navigation stacks)

Headers often inherit OS-level defaults or are hardcoded to `#151821`.
_Action:_ Bind explicitly to the React Navigation `theme.colors.card` or our own `theme.colors.surfaceMuted`, ensuring the header embraces the soft beige/cream palette and frames the organic wavy backgrounds perfectly without harsh grid lines.

### B. Chat Bubbles (`MessageBubble`)

The dark mode features a strong cyberpunk aesthetic with neon glowing SVG polygons and cut corners. For the light mode, this sci-fi look conflicts with our natural "Cocoa" theme.
_Action:_
**Design System & Structure:**

- **Shape & Style:** Obliterate all neon strokes and SVG cut-corners. Transition to soft, generously rounded, organic pill-shaped bubbles reminiscent of swirling chocolate.
- **User Messages:** Solid, rich chocolate brown (`theme.colors.primary`) background with warm cream typography for high legibility.
- **Assistant Messages:** Light frosted glassmorphism (translucent warm tan/cream via `theme.colors.surfaceMuted` with subtle background blur) featuring high-contrast dark brown typography.
- **Layout:** Ensure tight, cohesive padding resembling modern chat interfaces, with soft drop shadows creating gentle elevation against the sweeping, latte art-like background canvas.

### C. Modals & Keyboards (`InputPanel`, `ModelPickerSheet`)

The `InputPanel` currently uses an SVG wrapper with sharp cut corners (`<InputWrapper>`) even in the light mode fallback. Furthermore, bottom sheets rely heavily on raw colors for overlay backdrops.
_Action:_
**Design System & Structure:**

- **Main Container:** Redesign the `InputPanel` as a floating, heavily rounded pill-like dock using light frosted glassmorphism (translucent soft cream/white with blur) that harmonizes with the wavy background shapes. Drop the brutalist `<InputWrapper>` entirely in light mode.
- **Input Field:** Clean, transparent background text input with dark chocolate brown placeholder text ("How can I help you code today?").
- **Utility Buttons:** Soft, circular icon buttons (attachment, plus, globe) using muted beige/tan backgrounds and dark brown icons.
- **Model Selector:** A nested pill-shaped dropdown button within the dock, featuring subtle warm cream/tan backgrounds.
- **Send Button:** A prominent, high-contrast dark chocolate brown circular button tightly nestled on the right side.
- **Modals/Sheets:** Replace harsh `rgba(0,0,0,0.5)` backdrops with softer, warm-tinted translucent overlays (`theme.colors.overlay`). Elevate modal cards with perfectly rounded top corners, soft organic shapes, and faint shadows that fit the chocolate-themed palette.

### D. Web Preview & Browser (`PreviewWebViewModal`, `PreviewWebViewSubcomponents`)

The web preview overlay uses hardcoded dark backgrounds (`#161616`, `#0A0A0A`) and `rgba(0,0,0,0.5)` overlays for its loading states and backgrounds. It also applies hardcoded raw colors to icons and text explicitly (e.g., `#000`).
_Action:_
**Design System & Structure:**

- **Navigation/Header Bar:** Construct the browser header using the warm semantic palette (`theme.colors.surface`). Remove jarring `#161616` grays.
- **Typography & Icons:** Apply natural dark brown (`theme.colors.textPrimary`) for URLs, titles, and navigational icons to avoid stark pitch blacks (`#000`).
- **Loading States:** Convert harsh loading screens to soft cream backgrounds with branded brown loading indicators.

### E. Sidebar & Reusable Layouts (`WorkspaceSidebar`, `TabBarPills`, `ModalScaffold`, `DockerResourceCard`)

Across our generic layouts, we frequently see ad-hoc pseudo-theming (e.g., `theme.mode === "dark" ? "rgba(X)" : "rgba(Y)"`) rather than consuming the dedicated design system tokens.
_Action:_
**Design System & Structure:**

- **Sidebars & Scaffolds:** Strip all conditional inline `rgba()` bypasses. Use `theme.colors.surfaceMuted` for active states and `theme.colors.border` for subtle, soft edge separations. Ensure generously padded, rounded corners that echo soft, organic waves.
- **Tab Bars & Pills:** Convert angular or boxy tabs into perfectly organic, pill-shaped toggles. Use deep chocolate brown or mocha accents for active tab indicators and smooth cream backgrounds for inactive states.
- **Cards (`DockerResourceCard`):** Utilize soft rounded beige/cream rectangles with faint shadows instead of harsh borders, maintaining the cohesive chocolate and latte art aesthetic throughout the layout.

### F. Session Management (`SessionManagementModal`)

The Session Management interface currently relies heavily on hardcoded cyberpunk aesthetics with dark slate backgrounds (`rgba(15, 25, 45, 0.5)`), neon cyan typography (`#00f0ff`), and hot pink/magenta accents (`#ff00e5`), ignoring the application design system theme engine completely.
_Action:_
**Design System & Structure:**

- **Backgrounds & Overlays:** Replace hardcoded slate/navy background constants (`APP_SURFACE_BG`, `APP_CARD_BG`) with dynamic theme tokens (`theme.colors.surfaceMuted`, `theme.colors.surface`). In light mode, this adopts the warm frosted cream/beige foundation that blends smoothly with the wavy background.
- **Typography:** Swap the hardcoded cyan text (`APP_TEXT_SECONDARY`, `APP_TEXT_TERTIARY`) for dynamic text tokens (`theme.colors.textSecondary`). This ensures headers and semantic tags use dark chocolate/mocha brown formatting in light mode rather than glaring cyan.
- **Buttons & Accents:** Replace the neon magenta accents (`APP_ACCENT`, `APP_RUNNING`) with the semantic `theme.colors.primary` or `theme.colors.accent`. This transforms active elements like the "Start Session" button and badges into a rich chocolate brown or warm latte color rather than hot pink.
- **Outlines:** Retain the full rounded pill structures but remove any hardcoded glowing borders (`APP_CARD_BORDER`). Utilize `theme.colors.border` to achieve a soft, subdued outline that seamlessly fits the natural aesthetic without harsh contrast.

## 3. Execution Template

Before (Cyberpunk Hardcoded):

```tsx
const styles = StyleSheet.create({
  text: { color: "#f5f7fb" },
  box: { backgroundColor: "rgba(255,255,255,0.05)" },
});
// <InputWrapper>...</InputWrapper>
```

After (Organic/Pill-shape dynamic theming):

```tsx
const { colors, mode } = useTheme();
const isDark = mode === "dark";

// Ensure dark mode preserves cyberpunk while light mode uses pill-shapes
return (
  <View
    style={[
      { backgroundColor: colors.surfaceMuted },
      isDark ? styles.cyberpunkCutCorners : styles.organicPillCorners,
    ]}
  >
    <Text style={{ color: colors.textPrimary }}>Hello</Text>
  </View>
);
```
