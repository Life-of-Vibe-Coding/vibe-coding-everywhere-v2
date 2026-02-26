# Phase 5: User Settings and Persistence

## Objective
Provide a robust UI for the user to select their preferred viewing experience, and guarantee this preference boots accurately and immediately when the app cold-starts.

## 1. Persistent Storage Implementation
We need to capture the `ColorModePreference` (`"dark" | "light" | "system"`). Use `AsyncStorage` or `MMKV` for ultra-fast synchronous retrieval.

```typescript
// store/themeStore.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_PREF_KEY = '@app_theme_preference';

export const saveThemePreference = async (pref: ColorModePreference) => {
  await AsyncStorage.setItem(THEME_PREF_KEY, pref);
};

export const loadThemePreference = async (): Promise<ColorModePreference> => {
  const stored = await AsyncStorage.getItem(THEME_PREF_KEY);
  return (stored as ColorModePreference) || 'system';
};
```

*(Note: If using MMKV, read operations can be synchronous, completely eliminating any loading flicker.)*

## 2. Appearance Settings UI
Introduce a new section in the App Settings panel allowing users to toggle their preference.

- **Options:** 
  1. 📱 System Default (Follow OS)
  2. 🌙 Dark Mode (Always)
  3. ☀️ Light Mode (Always)
- Ensure the selected state provides immediate visual feedback to the user when tapped.

## 3. Quality Assurance Checklist
Final release checks before calling Light Mode complete:
- [ ] Tapping the toggle from the Settings UI updates the active view immediately without closing the settings or refreshing.
- [ ] No inaccessible text (e.g., White text on White background).
- [ ] Background characters (`background.png` vs `cocoa_light_background.png`) hot-swap successfully when transitioning.
- [ ] Restarting the app loads the user's saved preference accurately.
- [ ] Flipping the OS settings from Control Center correctly cascades into the App if "System Default" is preferred.
