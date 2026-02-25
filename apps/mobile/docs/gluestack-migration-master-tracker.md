# Gluestack Migration Master Tracker

## Phase Status
| Phase | Status | Evidence |
|---|---|---|
| 1. Inventory + Priority Matrix | complete | `gluestack-migration-phase1-inventory.csv`, `gluestack-migration-phase1-priority-matrix.md` |
| 2. Foundation Hardening | complete | `gluestack-migration-phase2-foundation-hardening.md`, `scripts/verify-foundation.mjs`, primitive policy baseline scripts |
| 3. Low-Risk Bulk Migration (Trivial Components) | pending | execute by feature area PRs (chat/settings/file/preview) |
| 4. Medium Complexity Patterns | pending | shared form/action patterns migration |
| 5. Complex/High-Risk Components | pending | modal/sheet/state choreography migration + targeted tests |
| 6. Cleanup + Enforcement | pending | wrapper removals, codemods, CI hard-forbid without baseline |
| 7. Validation + Rollout | pending | visual/a11y/device validation + staged rollout report |

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
