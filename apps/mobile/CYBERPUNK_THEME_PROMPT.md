# Futuristic Cyberpunk Glassmorphic Theme Prompt

Use this prompt to generate or apply the same theme to other pages, components, or entire apps in the future.

## The Prompt

```text
Design System & UI Theme Request: "Cyberpunk Glassmorphism"

I am building a mobile (React Native / Tailwind) application and want you to apply a highly futuristic, cyberpunk, glassmorphic UI design to the components and pages. The overall aesthetic should look like a cutting-edge neon terminal or a high-tech sci-fi AI UI. 

Please follow these exact design rules:

1. **Background & Base Shell:** 
   - Use a very dark, immersive linear gradient for the primary page background: `['#050014', '#170024', '#000010']`.
   - Never use solid flat dark gray backgrounds. Always use a deep violet/midnight black gradient.

2. **Glassmorphism Panels (Containers & Bubbles):**
   - Base containers should use semi-transparent backgrounds to simulate frosted glass.
   - For an "AI/Assistant" vibe, use light cyan tints: `rgba(0, 229, 255, 0.08)`.
   - For a "User/Human" vibe, use light pink/magenta tints: `rgba(255, 0, 255, 0.08)`.
   - General neutral panels (e.g., input bars) should be dark: `rgba(0, 0, 0, 0.3)`.

3. **Neon Borders & Glow Effects (Android/iOS Shadows):**
   - Apply bright neon borders to interactive panels and bubbles.
     - Cyan border: `1.5px solid #00E5FF`
     - Pink border: `1.5px solid #FF00FF`
     - Vibrant Yellow (for actions): `#FFD600`
   - Use colored drop shadows to create a glowing effect: `shadowColor: "#00E5FF"`, `shadowRadius: 12`, `shadowOpacity: 0.6`, `elevation: 2` (Android).

4. **Typography & Text Effects:**
   - Standard labels should be bright, high-contrast cyan or pink instead of plain white: `#E5FFFF` (cyan tint) or `#FFE5FF` (pink tint).
   - Dimmed/subtle text should be `rgba(0, 229, 255, 0.7)` with increased `letterSpacing`.
   - Add subtle text shadows (`textShadowColor: "rgba(0, 229, 255, 0.5)", textShadowRadius: 4`) to headings or important statuses to make them look like glowing neon signs.
   - Use monospace fonts (e.g. Menlo, monospace) for any code, numbers, or technical terminal output, colored in vivid neon cyan or pink.

5. **Controls, Icons, & Actions:**
   - Buttons should abandon solid dull boxes. Use transparent backgrounds with solid or brightly colored icons, surrounded by a glowing neon border.
   - E.g. A "Submit" button should not be generic blue; it should have a yellow neon icon `#FFD600` with a matching `rgba(255, 214, 0, 0.1)` background layer.
   - Shape them dynamically (e.g., fully rounded pill shapes `borderRadius: 36` or terminal blocks).

When applying this theme, make sure all colors and styling adjust exclusively when the app is in Dark Mode (`theme.mode === "dark"`), falling back to standard clean light-mode spacing otherwise. Let the cyberpunk vibe dominate the screen with its striking contrast.
```
