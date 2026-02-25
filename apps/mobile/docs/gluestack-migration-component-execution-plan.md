# Gluestack Migration: Component Execution Plan

## Scope Baseline (2026-02-25)
- Non-`ui` component modules in `src/components`: `41`
- Modules already using `@/components/ui/*`: `23`
- Modules still importing `react-native` directly: `21`
- Inventory regenerated from live tree; stale `health/HealthCheckModal.tsx` entry removed.

## Guardrails (from ui-ux-pro-max and project rules)
- Keep minimum touch target size of `44x44` for actionable elements.
- Preserve visible focus states and minimum text contrast (`4.5:1`).
- Respect reduced motion in new/extracted reusable components.
- No net-new raw RN primitives in feature UI files (except approved APIs: `Platform`, `Keyboard`, `Dimensions`, `Animated`, type-only imports).

## Latest Verification
- Shared UI/type gate fixes applied for migration enforcement:
`ui/pressable`, `ui/button`, `ui/__tests__/modal`, and `services/server/config`.
- Chat composition contract alignment applied:
`ChatPage`, `ChatMessageList`, `ChatPageSections`, `appStyles`, `useFileViewer`, and `WorkspaceFileController`.
- Batch 2 progress update:
`chat/SessionManagementModal` moved to `ModalScaffold + AsyncStateView`;
`file/FileViewerModal` moved to `ModalScaffold + MarkdownContent`.
- Current `pnpm exec tsc --noEmit` status (from `apps/mobile`): passing.
- Phase 7 gate command `pnpm run phase7:check` now passes end-to-end (foundation + strict primitive lint + visual snapshots + a11y + rollout metrics report).
- Pressable deprecation-noise cleanup: `disabled` is treated as canonical and no longer emits migration warnings in test gates.

## PR Batch Plan

### Batch 0: Foundation + Tracker Sync
- [x] Refresh inventory from live tree and remove stale `health/HealthCheckModal.tsx`.
- [x] Add/confirm lint guard for raw RN primitive imports in feature UI layer.
- [x] Keep explicit exception list for non-primitive RN APIs and platform libs.

### Batch 1: Reusable Extraction
- [x] Add `ModalScaffold` reusable (header, body, close, safe-area handling).
- [x] Add `AsyncStateView` reusable (loading/error/empty/content).
- [x] Add `TabBarPills` reusable for segmented tab-like controls.
- [x] Add `ListSectionCard` reusable for repeated list sections.
- [x] Add `MarkdownContent` reusable for markdown/code rendering.
- [x] Add `ActionIconButton` reusable for icon-only/compact actions.

### Batch 2: High-Risk Critical Path Components
- [~] `chat/MessageBubble.tsx` -> token alignment completed; `MarkdownContent` extraction pending.
- [ ] `chat/InputPanel.tsx` -> align action buttons/sheet triggers with `ActionIconButton`.
- [x] `chat/SessionManagementModal.tsx` -> switched to shared modal shell.
- [x] `chat/AskQuestionModal.tsx` -> switched to shared modal shell.
- [x] `file/FileViewerModal.tsx` -> switched to shared modal shell.
- [~] `file/WorkspaceSidebar.tsx` -> modal surface migrated; deeper section extraction pending.
- [x] `preview/PreviewWebViewModal.tsx` -> switched to shared modal shell.
- [~] `processes/ProcessesDashboardModal.tsx` -> switched to shared modal shell; reusable extraction pending.
- [~] `processes/ProcessesDashboardSection.tsx` -> modal shell parity completed; reusable extraction pending.
- [~] `docker/DockerManagerModal.tsx` -> modal shell + token alignment completed; reusable extraction pending.

### Batch 3: Medium-Risk Composition Components
- [~] `components/ChatMessageList.tsx` (ref typing + dock spacing integration aligned; further extraction pending)
- [ ] `components/AppHeaderBar.tsx`
- [ ] `components/ModelPickerSheet.tsx`
- [ ] `pages/ChatPageShell.tsx`
- [~] `pages/ChatPageSections.tsx` (prop/style contract alignment completed)
- [ ] `pages/FileViewerPage.tsx`
- [ ] `pages/WorkspaceSidebarPage.tsx`
- [ ] `settings/WorkspacePickerModal.tsx`
- [ ] `settings/SkillDetailSheet.tsx`
- [ ] `settings/SkillConfigurationModal.tsx`
- [ ] `preview/UrlChoiceModal.tsx`
- [ ] `common/PermissionDenialBanner.tsx`

### Batch 4: Validation + Enforcement
- [ ] Add/expand targeted tests for migrated shared reusables.
- [ ] Add regression coverage for chat modal stack, file viewer, sidebar, docker/processes.
- [ ] Run and gate on `verify:foundation` and strict primitive allowlist scripts.
- [ ] Publish rollout metrics update.

## Component-by-Component Tracker

Legend:
- `Status`: `todo | in_progress | done`
- `Risk`: `high | medium | low | n/a`
- `RN import`: whether file imports `react-native` directly today

| Component | Risk | RN import | Target Pattern | Status |
|---|---|---|---|---|
| `chat/AskQuestionModal.tsx` | high | yes | `ModalScaffold` | done |
| `chat/InputPanel.tsx` | high | yes | `ActionIconButton` + sheet normalization | todo |
| `chat/MessageBubble.tsx` | high | yes | `MarkdownContent` + extracted renderers | in_progress |
| `chat/SessionManagementModal.tsx` | high | yes | `ModalScaffold` + `AsyncStateView` | done |
| `common/PermissionDenialBanner.tsx` | medium | no | shared banner pattern | todo |
| `components/AppHeaderBar.tsx` | medium | yes | shared header layout | todo |
| `components/ChatInputDock.tsx` | n/a | no | composition only, verify no primitive drift | todo |
| `components/ChatMessageList.tsx` | high | yes | list composition cleanup | in_progress |
| `components/ChatModalsSection.tsx` | n/a | no | composition only, verify routing | todo |
| `components/ModelPickerSheet.tsx` | medium | no | actionsheet row normalization | todo |
| `controllers/ChatActionController.tsx` | n/a | no | logic-only, no UI primitive migration | in_progress |
| `controllers/SessionSideEffectManager.tsx` | n/a | no | logic-only, no UI primitive migration | todo |
| `controllers/SseSessionController.tsx` | n/a | yes | keep RN APIs, no primitive migration | in_progress |
| `controllers/ThemeSessionState.tsx` | n/a | no | logic-only, no UI primitive migration | todo |
| `controllers/WorkspaceFileController.tsx` | n/a | no | logic-only, no UI primitive migration | in_progress |
| `docker/DockerManagerModal.tsx` | high | yes | `ModalScaffold` + `TabBarPills` + `AsyncStateView` | in_progress |
| `docker/DockerTabIcons.tsx` | n/a | no | icon set normalization only | todo |
| `file/FileViewerModal.tsx` | high | yes | `ModalScaffold` + `MarkdownContent` | done |
| `file/WorkspaceSidebar.tsx` | high | yes | section extraction + reusable rows/cards | in_progress |
| `hooks/useChatModalsController.ts` | n/a | no | logic-only, no UI primitive migration | in_progress |
| `hooks/useSidebarState.ts` | n/a | no | logic-only, no UI primitive migration | todo |
| `icons/ChatActionIcons.tsx` | n/a | no | keep svg package; normalize props | todo |
| `icons/FileActivityIcons.tsx` | n/a | no | keep svg package; normalize props | todo |
| `icons/HeaderIcons.tsx` | n/a | no | keep svg package; normalize props | todo |
| `icons/ProviderIcons.tsx` | n/a | no | keep svg package; normalize props | todo |
| `icons/WorkspaceTreeIcons.tsx` | n/a | no | keep svg package; normalize props | todo |
| `pages/ChatPage.tsx` | n/a | yes | type-only RN usage; verify stable | in_progress |
| `pages/ChatPageSections.tsx` | medium | yes | layout composition cleanup | in_progress |
| `pages/ChatPageShell.tsx` | medium | yes | shell normalization + safe-area consistency | todo |
| `pages/FileViewerPage.tsx` | medium | yes | container simplification | todo |
| `pages/WorkspaceSidebarPage.tsx` | medium | yes | container simplification | todo |
| `pages/buildChatPageProps.ts` | n/a | no | logic-only, no UI primitive migration | in_progress |
| `preview/PreviewWebViewModal.tsx` | high | yes | `ModalScaffold` + `TabBarPills` | done |
| `preview/UrlChoiceModal.tsx` | medium | no | keep as modal reference implementation | todo |
| `processes/ProcessesDashboardModal.tsx` | high | yes | `ModalScaffold` + `AsyncStateView` | in_progress |
| `processes/ProcessesDashboardSection.tsx` | high | yes | section parity with modal patterns | in_progress |
| `settings/SkillConfigurationModal.tsx` | medium | no | spacing/token normalization | done |
| `settings/SkillDetailSheet.tsx` | medium | yes | `MarkdownContent` + modal scaffold parity | done |
| `settings/WorkspacePickerModal.tsx` | medium | yes | modal/list card normalization | done |
| `styles/appStyles.ts` | medium | yes | shrink/retire as reusable extraction lands | in_progress |
| `types/chatModalTypes.ts` | n/a | no | type-only, ensure compatibility | todo |

## Definition of Done (per migrated component)
- [ ] No new raw RN primitive imports introduced in file.
- [ ] Uses shared reusable where one exists (`ModalScaffold`, `AsyncStateView`, etc.).
- [ ] Keyboard/safe-area behavior unchanged from baseline.
- [ ] Existing tests pass; add targeted test when behavior is interaction-heavy.
- [ ] Visual parity check done for the migrated surface.
