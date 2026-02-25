# Phase 2: Foundation Hardening

## Goal
Stabilize shared UI infrastructure before bulk migration so teams build new screens with Reusables (`@/components/ui/*`) by default.

## Hardening Scope
1. Theme tokens
2. `cn` utility usage
3. Portal/overlay behavior
4. Dark/light parity wiring
5. Import aliases
6. Enforcement against net-new raw trivial primitives in feature UI layer

## Implemented Guardrails
- Added foundation verification script: `apps/mobile/scripts/verify-foundation.mjs`
- Added primitive policy scripts:
  - `apps/mobile/scripts/capture-ui-primitives-baseline.mjs`
  - `apps/mobile/scripts/enforce-ui-primitives-baseline.mjs`
  - `apps/mobile/scripts/ui-primitives-policy.mjs`
- Added baseline file: `apps/mobile/config/ui-primitives-baseline.json`
- Normalized `cn` to single source (`src/utils/cn.ts`) and re-export from `src/lib/utils.ts`
- Added package scripts:
  - `npm run -w mobile verify:foundation`
  - `npm run -w mobile capture:ui-primitives-baseline`
  - `npm run -w mobile lint:ui-primitives`
  - `npm run -w mobile phase2:check`

## Policy
- New/edited feature UI code under `src/components/**` must prefer `@/components/ui/*` primitives.
- `react-native` trivial primitives are baseline-gated: no net-new direct imports allowed in feature UI layer.
- Existing legacy usage is temporarily allowlisted by baseline until migrated in later phases.

## Verification Commands
```bash
npm run -w mobile capture:ui-primitives-baseline
npm run -w mobile phase2:check
```

## Exit Criteria Status
- Shared infrastructure checks are automated: **met**
- Net-new raw primitive regressions blocked by CI script: **met**
- Teams can default to Reusables primitives for new screens: **met (policy + scripts in place)**
