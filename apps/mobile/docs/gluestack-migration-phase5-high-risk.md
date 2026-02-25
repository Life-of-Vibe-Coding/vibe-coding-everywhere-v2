# Phase 5: Complex/High-Risk Components

## Goal
Migrate components with custom choreography/overlay behavior and add targeted regression tests.

## Refactors Applied
- `chat/InputPanel.tsx` plus-menu overlay migrated to `Actionsheet` primitives.
- `preview/UrlChoiceModal.tsx` migrated to shared `Modal` primitives.

## Targeted Tests Added
1. Keyboard + submit behavior
   - `src/components/chat/__tests__/InputPanel.test.tsx`
   - verifies prompt submit and `Keyboard.dismiss()` behavior.
2. Overlay action routing
   - `src/components/preview/__tests__/UrlChoiceModal.test.tsx`
   - verifies choose-vpn/choose-original/cancel interactions.
3. Async state handling
   - `src/components/settings/__tests__/SkillConfigurationModal.test.tsx`
   - verifies async skills fetch renders loaded skill rows.

## Remaining High-Risk Surfaces
- `chat/SessionManagementModal.tsx`
- `file/FileViewerModal.tsx`
- `file/WorkspaceSidebar.tsx`
- `processes/ProcessesDashboardModal.tsx`
- `processes/ProcessesDashboardSection.tsx`

## Exit Criteria Status
- High-risk wrappers removed or justified: **met (no remaining restricted raw primitive imports in feature layer)**
