# Gluestack Migration: Phase 3 Compatibility Adapters

## Goal
Keep legacy callsites compiling unchanged while routing render internals through gluestack wrappers.

## Implemented Foundation
- Added temporary adapter utility:
  - [legacyAdapter.ts](/Users/yifanxu/machine_learning/LoVC/vibe-coding-everywhere_v3/apps/mobile/src/components/ui/_migration/legacyAdapter.ts)
- Utility provides:
  - `warnLegacyProp(...)` for one-time deprecation warnings (dev-only)
  - `resolveLegacyStyle(...)` for temporary unsupported style passthrough
  - `normalizeLegacyBoolean(...)` for legacy boolean prop mapping

## Adapter Rollout Order
1. `Button`, `Input`, `Text`, `Pressable`, `Modal` wrappers in `components/ui/*`
2. High-usage modal shells (`settings/*`, `preview/*`, `docker/*`)
3. Chat/file/session critical surfaces (`chat/*`, `file/*`, controllers)

## Legacy Prop Policy
- Keep old prop names accepted during transition.
- Map old props to current gluestack/uniwind props in wrapper-level adapters.
- Emit deprecation warning once per prop/component in development.
- Remove mapped legacy props in Phase 8 cleanup.

## Done Criteria Tracking
- Old callsites compile unchanged: **in progress**.
- Render path via gluestack internals: **in progress**.
- Deprecation warnings for legacy-only props: **foundation added**.
