# Phase 6: Cleanup + Enforcement

## Goal
Prevent regressions and reduce long-term migration maintenance.

## Enforcement Added
- Baseline gate (no net-new raw primitive imports):
  - `scripts/enforce-ui-primitives-baseline.mjs`
- Strict allowlist CI gate:
  - `scripts/check-ui-primitives-strict.mjs`
  - allowlist config: `config/ui-primitives-allowlist.json`

## Package Scripts
- `npm run -w mobile lint:ui-primitives`
- `npm run -w mobile lint:ui-primitives:strict`
- `npm run -w mobile phase6:check`

## Policy
- Raw `react-native` primitives in feature UI are forbidden unless explicitly allowlisted.
- Allowlist must shrink as migrations land.
- New feature development defaults to `@/components/ui/*` Reusables.

## Exit Criteria Status
- CI-level policy implemented and executable: **met**
- Deprecated wrappers fully removed: **pending**
