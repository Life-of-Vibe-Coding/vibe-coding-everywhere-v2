# Phase 4: Medium Complexity Patterns

## Goal
Migrate interactive common patterns to Reusables equivalents.

## Pattern Audit (feature layer)
- `select`: 0 direct feature callsites
- `popover`: 0 direct feature callsites
- `tooltip`: 0 direct feature callsites
- `radio`: 0 direct feature callsites
- `checkbox`: 0 direct feature callsites
- `drawer`: 0 direct feature callsites
- `actionsheet`: 3 callsites
- `bottomsheet`: 0 direct feature callsites
- `form-control`: 0 direct feature callsites

## Migrations Applied
1. Replaced custom plus-menu sheet in `chat/InputPanel.tsx`:
   - from raw `Modal` + `TouchableWithoutFeedback`
   - to `@/components/ui/actionsheet` primitives (`Actionsheet`, `ActionsheetItem`, `ActionsheetBackdrop`, etc.)
2. Replaced custom preview choice overlay in `preview/UrlChoiceModal.tsx`:
   - from raw `Modal` overlay composition
   - to `@/components/ui/modal` primitives (`Modal`, `ModalBackdrop`, `ModalContent`, `ModalBody`)

## Validation
- Existing behavior preserved (same actions + labels).
- Covered by targeted tests:
  - `src/components/chat/__tests__/InputPanel.test.tsx`
  - `src/components/preview/__tests__/UrlChoiceModal.test.tsx`

## Exit Criteria Status
- Shared action/sheet patterns routed through Reusables for active callsites: **met**
