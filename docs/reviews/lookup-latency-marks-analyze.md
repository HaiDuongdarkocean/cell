# Analyze review — lookup-latency-marks

Mode: `all` (autonomous — self-interrogation replaces the interactive gate).

## Audit claims re-verified against code

- "Không đo hover→popup / tab→audio" — **CONFIRMED**: zero `performance.mark`/`performance.measure` anywhere in `src/`; `lookupLogStore` persists phrase traces + `timestamp` only, no duration fields.
- Trigger/dispatch points pinned: primary LOOKUP_REQUEST dispatch at `popupLifecycle.ts` (~:502), response arrival in its `.then` handler, prefetch fan-out in `lookupCache.ts` (must NOT pollute user-facing marks), audio path `fetchAudio`/`setAudioItems` in `useDictionaryToolbar.ts`.
- `isDevMode` precedent (`shared/lib/env/devMode.ts`) already gates dev-only modules with production tree-shake (`saveLookupLog` is caller-gated) — same gate applies.
- Persona <3s claim unverifiable today → this item is the measurement prerequisite for any further latency work.

## Decision

VERDICT: APPROVE

- Pure dev-only observability; no UI surface (`uiSurface=no` → skips design).
- Spec must lock: exact mark names/positions, requestId correlation + buffer cleanup, prefetch-mark separation, isolated-world User Timing visibility verified on real Chromium (fallback: console.debug always visible).

Intent: `docs/intent/lookup-latency-marks.md`
