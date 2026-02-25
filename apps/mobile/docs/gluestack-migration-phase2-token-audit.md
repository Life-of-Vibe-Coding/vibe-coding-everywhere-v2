# Gluestack Migration: Phase 2 Token Audit

## Scope
- Audited: `apps/mobile/src/components/ui/**/*.{ts,tsx}` (shared UI primitives)
- Audited: `apps/mobile/src/components/**/*.{ts,tsx}` (feature surfaces)
- Pattern checks: hardcoded hex colors, numeric style literals, `StyleSheet.create` density

## Result
- Shared UI primitives token compliance: **pass**
- Hardcoded theme values in shared UI primitives: **0 matches**
- NativeWind dependency in UI wrappers (`cssInterop`/`nativewind` imports): **98 matches**

This means primitive styling is already token-first, but wrapper internals still need NativeWind-to-Uniwind compatibility work.

## Hotspots Outside Shared Primitives
These are the highest priority files for token normalization in feature surfaces:

| File | Hardcoded/token-bypass matches |
|---|---:|
| `src/components/file/WorkspaceSidebar.tsx` | 56 |
| `src/components/chat/MessageBubble.tsx` | 46 |
| `src/components/file/FileViewerModal.tsx` | 33 |
| `src/components/docker/DockerManagerModal.tsx` | 31 |
| `src/components/processes/ProcessesDashboardSection.tsx` | 29 |
| `src/components/preview/PreviewWebViewModal.tsx` | 28 |
| `src/components/processes/ProcessesDashboardModal.tsx` | 25 |
| `src/components/chat/AskQuestionModal.tsx` | 20 |
| `src/components/settings/SkillDetailSheet.tsx` | 16 |
| `src/components/chat/SessionManagementModal.tsx` | 16 |

## Fallback Policy (Temporary Adapter Only)
1. Prefer gluestack/uniwind token class (`bg-*`, `text-*`, `border-*`, spacing/typography tokens) for all new/edited UI.
2. If a style is unsupported by class mapping, pass through a temporary adapter prop (`legacyStyle`) that maps to inline `style`.
3. Adapter must log a deprecation warning in development with component name + prop key.
4. Adapter usage is allowed only in `components/ui/_migration/*` wrappers, never directly in feature components.
5. Each adapter usage must have a tracking ticket; remove within one migration phase after replacement exists.

## Phase 2 Done Criteria Tracking
- "No hardcoded theme values in shared UI primitives": **met**.
- Remaining work: remove ad-hoc values from feature surfaces and eliminate NativeWind internals from wrappers.
