# Gluestack Migration: Phase 1 Inventory + Priority Matrix

This document is generated from `apps/mobile/src/components` static imports and aligns to the requested migration sequence.

## Completion Status
- Phase 1 inventory coverage: complete (`122/122` component modules mapped)
- Required mapping columns present: `old component -> gluestack replacement -> owner -> test coverage`
- Migration order assigned for every mapped module (`P0/P1/P2/P3`)

## Risk Matrix
- Low risk (presentational): `88`
- Medium risk (forms/modals/pickers/lists): `9`
- High risk (chat/file/session critical paths): `25`

## Concrete Execution Order
1. `apps/mobile/src/components/ui/*` primitives (`P0-validate-existing` then `Phase 4` hardening).
2. `apps/mobile/src/components/settings/*` and utility modals (`P1/P2`).
3. `apps/mobile/src/components/file/*` surfaces (`P3`).
4. `apps/mobile/src/components/chat/*` and controllers (`P3`, last).
5. Final cleanup + enforcement (`Phase 8`).

## High-Risk Surfaces (Start Last)
| Surface | Risk | Notes |
|---|---|---|
| `components/chat/*` | high | Composer, message bubble/list, session modal are interaction-critical. |
| `components/file/*` | high | Workspace and file viewer affect session/file workflows. |
| `components/controllers/*` | high | Session/event behavior coupled to UI timing and side effects. |
| `components/pages/*` | high | Orchestrates chat/page composition and modal routing. |

## Spreadsheet Artifact
- [gluestack-migration-phase1-inventory.csv](/Users/yifanxu/machine_learning/LoVC/vibe-coding-everywhere_v3/apps/mobile/docs/gluestack-migration-phase1-inventory.csv)

## Notes
- Existing `components/ui/*` is already gluestack-backed, but still contains NativeWind `cssInterop` usage that should be converted during migration phases 2-4.
- Current direct component unit tests are minimal (`chat/__tests__/extractBashCommandOnly.test.ts` only).
