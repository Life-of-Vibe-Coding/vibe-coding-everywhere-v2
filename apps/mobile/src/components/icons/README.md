# Icons (Expo-compatible)

All icons in this folder use **react-native-svg**, which is supported by Expo.

## Verification (Expo app)

- **Expo SDK**: 54 (see `app.json`)
- **react-native-svg**: 15.12.1 (Expo-bundled version; see [Expo docs](https://docs.expo.dev/ui-programming/using-svgs/))
- **Jest**: `transformIgnorePatterns` in `package.json` includes `react-native-svg` so tests can run.
- **Bundle**: `npx expo export --platform ios` completes successfully (icons and `react-native-svg` resolve in Metro).

## Usage

- **HeaderIcons**: `MenuIcon`, `SettingsIcon` (Lucide; used in `App.tsx` header).
- **ChatActionIcons**: `AttachPlusIcon`, `ChevronDownIcon`, `GlobeIcon`, `TerminalIcon`, `StopCircleIcon`, `CloseIcon`, `PlayIcon` (used by chat input and code run actions).
- **WorkspaceTreeIcons**: `FolderIcon`, `FolderOpenIcon`, `FileIconByType` (Lucide; used in `WorkspaceSidebar`). File type is chosen by extension (e.g. `file-code` for `.ts`/`.js`, `file-text` for `.md`, `file-braces` for `.json`).

Provider brand source assets (Gemini/Claude) are stored at `apps/mobile/assets/icons/providers` and downloaded from `lobehub/lobe-icons`.

Source SVGs from Iconify via **better-icons**:  
`better-icons get lucide:menu`, `lucide:folder`, `lucide:file-code`, etc.
