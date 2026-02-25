# Phase 3: Low-Risk Bulk Migration (Trivial Components)

## Goal
Replace high-volume, low-logic UI usage first with minimal behavior risk.

## Batch Completed
Scope: `chat`, `settings`, `file`, `preview` feature areas.

### Replacements Applied
- Replaced direct `react-native` `ScrollView` imports with `@/components/ui/scroll-view` in:
  - `src/components/chat/AskQuestionModal.tsx`
  - `src/components/chat/MessageBubble.tsx`
  - `src/components/chat/SessionManagementModal.tsx`
  - `src/components/settings/SkillConfigurationModal.tsx`
  - `src/components/settings/SkillDetailSheet.tsx`
  - `src/components/settings/WorkspacePickerModal.tsx`
  - `src/components/file/FileViewerModal.tsx`
  - `src/components/file/WorkspaceSidebar.tsx`
  - `src/components/preview/PreviewWebViewModal.tsx`
- Replaced direct `react-native` `Switch` import with `@/components/ui/switch` in:
  - `src/components/settings/SkillConfigurationModal.tsx`

## Behavior Contract
- No state/control-flow changes.
- No modal choreography changes.
- No API/schema changes.

## Validation
- `npm run -w mobile phase2:check` passes.
- Primitive policy gate passes with no net-new raw primitive imports.

## Screenshot Status
- Before/after screenshots are pending because no simulator snapshot automation is wired in this pass.
- Next PR batch should include screenshot artifacts per feature area.
