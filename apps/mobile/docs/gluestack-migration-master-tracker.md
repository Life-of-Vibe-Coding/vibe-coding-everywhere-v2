# Gluestack Migration Master Tracker

## Phase Status
| Phase | Status | Evidence |
|---|---|---|
| 1. Inventory + Priority Matrix | complete | `gluestack-migration-phase1-inventory.csv`, `gluestack-migration-phase1-priority-matrix.md` |
| 2. Foundation Hardening | complete | `gluestack-migration-phase2-foundation-hardening.md`, `scripts/verify-foundation.mjs`, primitive policy baseline scripts |
| 3. Low-Risk Bulk Migration (Trivial Components) | in progress | `gluestack-migration-phase3-low-risk-bulk-migration.md` |
| 4. Medium Complexity Patterns | complete | `gluestack-migration-phase4-medium-patterns.md` |
| 5. Complex/High-Risk Components | complete | `gluestack-migration-phase5-high-risk.md` + targeted tests |
| 6. Cleanup + Enforcement | complete | `gluestack-migration-phase6-cleanup-enforcement.md`, strict allowlist gate scripts |
| 7. Validation + Rollout | in progress | `scripts/generate-rollout-metrics.mjs`, `gluestack-migration-phase7-rollout-report.md` |

## Locked Order
1. Foundation hardening checks and policy (Phase 2)
2. Low-risk trivial component replacement (Phase 3)
3. Medium complexity interaction patterns (Phase 4)
4. High-risk surfaces and orchestration (Phase 5)
5. Cleanup/enforcement and rollout validation (Phases 6-7)

## Enforcement Gates
- New feature UI defaults to `@/components/ui/*` primitives.
- No net-new raw `react-native` trivial primitive imports in feature UI layer.
- Foundation verification must pass (`verify:foundation`).

## Current Run Updates
- Added compatibility adapter coverage to shared primitives:
`Card`, `HStack`, `VStack` (plus previously updated `Button`, `Input`, `Text`, `Pressable`, `Modal`, `Box`).
- Added primitive test coverage:
`src/components/ui/__tests__/card.test.tsx`,
`src/components/ui/__tests__/stacks.test.tsx`,
`src/components/ui/__tests__/modal.test.tsx`.
- Verified targeted primitive test suite:
`7` test files, `16` passing tests.
- Started low-risk surface migration:
`src/components/settings/SkillConfigurationModal.tsx` now uses shared `@/components/ui/modal` wrapper and removed local `StyleSheet` block.
- Continued low-risk surface migration:
`src/components/preview/UrlChoiceModal.tsx` cleaned residual legacy styles and normalized to `@/components/ui/modal` primitives.
`src/components/settings/SkillDetailSheet.tsx` and `src/components/settings/WorkspacePickerModal.tsx` switched from raw RN `Modal` to shared `@/components/ui/modal`.
- Token cleanup follow-up:
`SkillDetailSheet` removed local `StyleSheet` usage and replaced `theme.accent` with `theme.colors.accent` in touched paths.
- Additional low-risk token alignment:
`SkillConfigurationModal` switched remaining `theme.accent` usages to `theme.colors.accent`.
- Regression checks:
`settings/SkillConfigurationModal` and `preview/UrlChoiceModal` tests pass after migration updates.
- Preview surface migration:
`src/components/preview/PreviewWebViewModal.tsx` switched from raw RN `Modal` to shared `@/components/ui/modal` wrappers.
- Token alignment follow-up:
`PreviewWebViewModal` replaced remaining `theme.accent` usages with `theme.colors.accent`.
- File surface migration started:
`src/components/file/FileViewerModal.tsx` and `src/components/file/WorkspaceSidebar.tsx` moved to shared `@/components/ui/modal` wrapper patterns.
- File token alignment follow-up:
`FileViewerModal` and `WorkspaceSidebar` replaced touched `theme.accent` usages with `theme.colors.accent`.
