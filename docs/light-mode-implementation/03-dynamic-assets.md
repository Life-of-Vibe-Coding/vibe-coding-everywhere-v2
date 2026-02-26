# Phase 3: Dynamic Assets

## Objective
Assets built into the app (such as the character backgrounds, logos, and specific illustrative icons) must seamlessly rotate when the theme flips.

## 1. Asset Naming Conventions
Establish a strict naming convention in the `assets/` and `assets/theme/` directories:
- Dark variations: `[asset-name].png` or `[asset-name]_dark.png`
- Light variations: `[asset-name]_light.png`
*Note: We highly recommend remapping legacy names like `cocoa_background.png` mapping to robust structural names.*

## 2. Building an Asset Resolver Hook
Create an `useThemeAssets` hook that automatically supplies the required asset paths. This prevents components from duplicating `mode === 'light' ? X : Y` ternary logic everywhere.

```typescript
// hooks/useThemeAssets.ts
import { useColorMode } from '@/theme';

export function useThemeAssets() {
  const mode = useColorMode();
  const isLight = mode === "light";

  return {
    background: isLight 
      ? require("../../assets/theme/light/background.png") 
      : require("../../assets/theme/dark/background.png"),
    logoMatch: isLight 
      ? require("../../assets/logo-dark-text.png") 
      : require("../../assets/logo-light-text.png"),
    // Add other dynamically changing vector/png assets here.
  };
}
```

## 3. Resolution Verification
It is critical that the light and dark assets have:
1. Identical artboard dimensions.
2. Identical resolutions.
3. Perfectly aligned visual padding (e.g., character anchored identically from the bottom).
Failure to align these traits triggers severe UI jumping glitches when hot-swapping modes.
