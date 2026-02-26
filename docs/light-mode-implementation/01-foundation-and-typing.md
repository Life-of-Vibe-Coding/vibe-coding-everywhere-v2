# Phase 1: Foundation & Typing

## Objective
Establish the strongly-typed foundation required for dynamic theming across the application. This phase unlocks the capability to support states beyond just `"dark"`.

## 1. Type Definitions
Migrate from rigid literal types to a flexible union type that supports explicit modes and system-level derivation.

```typescript
// theme/types.ts (or design-system/theme.tsx)

/** Represents the deeply resolved active theme mode applied to the UI. */
export type ColorMode = "dark" | "light";

/** Represents the user's explicit preference. Includes "system" to defer to OS settings. */
export type ColorModePreference = ColorMode | "system";
```

## 2. Global State & App Configuration
The app configuration logic must be decoupled from returning static assignments. 

Update `features/app/appConfig.ts`:
```typescript
import { ColorMode, ColorModePreference } from '@/theme/types';

// The getter should ideally connect to a reactive store, not a static return.
export function getThemeMode(preference: ColorModePreference, systemMode: ColorMode): ColorMode {
  if (preference === "system") {
    return systemMode;
  }
  return preference;
}
```

## 3. Context & Hook Overhaul
The theme providers (`ModernThemeProvider` and potentially legacy `ThemeProvider`) currently ignore reactive incoming states. 

- Subscribing to OS changes: Utilize React Native's `useColorScheme()` to listen for OS-level light/dark mode changes.
- Syncing Context: The root provider needs to compute the resolved `ColorMode` (factoring in the user's explicit preference vs system default) and pipe it into the existing `ThemeColors` builder.

```typescript
// Example pseudo-implementation for the Root Provider
const systemColorScheme = useColorScheme(); 
const [userPreference, setUserPreference] = useState<ColorModePreference>('system');

const activeMode = useMemo(() => {
  return userPreference === 'system' ? (systemColorScheme || 'dark') : userPreference;
}, [userPreference, systemColorScheme]);

// Expose activeMode via context to dynamic UI branches.

## 4. Addressing Foundational Theme Engine Issues
Fixing the core engine is a prerequisite for component migrations. The following dark-only hardcodes must be addressed first:
- **`theme/index.tsx`**: `getNeutrals(_mode)` currently ignores the passed `ColorMode` and returns dark neon values (line 59).
- **`design-system/theme.tsx`**: `buildColors(_mode)` is marked "Dark Only" (line 388).
- **`ThemeSessionState.tsx`**: The theme preference is currently forced to `"light"` via `getThemeMode("light", resolvedSystemMode)` (line 39). This wiring risk must be fixed so the application respects user preference instead of hardcoding the state.
```
