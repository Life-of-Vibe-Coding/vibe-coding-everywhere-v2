# Light Mode Implementation Architecture: Overview

## Introduction
The Mobile Cocoa application is currently built upon a hardcoded `"dark"` mode theme infrastructure (e.g., `theme/index.tsx`, `features/app/appConfig.ts`, `design-system/theme.tsx`). 

This documentation set outlines a comprehensive, multi-phase architectural migration plan to introduce a robust, dynamic `"light"` mode. The primary objective is to enable seamless theme switching while strictly preserving the app’s signature glassmorphic aesthetics, premium brand identity, and flawless UX.

## Architecture Migration Strategy
The implementation is broken down into 5 decoupled phases, designed for isolated testing and systematic rollout:

1. **[Phase 1: Foundation & Typing](./01-foundation-and-typing.md)** - Redefining core type declarations and updating foundational context hooks.
2. **[Phase 2: Palette Expansion](./02-palette-expansion.md)** - Constructing the Light Mode design system variables, ensuring contrast ratio compliance, and mapping semantic tokens.
3. **[Phase 3: Dynamic Assets](./03-dynamic-assets.md)** - Establishing an intelligent asset resolution pipeline for theme-dependent background imagery and icons.
4. **[Phase 4: Component Refactoring](./04-component-refactoring.md)** - Auditing and refactoring hardcoded UI elements to rigorously consume the dynamic semantic tokens.
5. **[Phase 5: User Settings and Persistence](./05-user-settings-and-persistence.md)** - Implementing the user-facing settings toggle with local persistence and system-default syncing.

## Design Philosophy & Constraints
- **Semantic First:** No raw colors (`#FFFFFF` or `rgba(...)`) should exist in components. Everything must route through `theme.colors.*`.
- **Glassmorphism Consistency:** Maintain frosted glass effects. Light mode requires meticulously calibrated dark-translucent borders and adjusted shadow opacities to preserve depth.
- **Zero-Flicker Boot:** The application must read persisted theme preferences synchronously (or very early async) before the first paint to prevent white/black flashing.
