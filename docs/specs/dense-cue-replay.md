# Spec — Dense Cue Replay (i+1 Replay)

Backlog #10 · `dense-cue-replay` · Intent: `docs/intent/dense-cue-replay.md`
Status: r1 — stakeholder review applied (B1 bounced-targets set, M1 reset
semantics, M2 band whitelist, M3 live-band AC, minors)

## Summary

New optional step-level `skip` policy on `StudyStep` + new preset `i1-replay`.
At cue entry, a step with `skip: 'non-i1'` consults the `CueBandProbe` (built
by `unknownCueMap`, shipped in adaptive-subtitles): if the entered cue's band
is `easy` or `dense`, the state machine emits one `seek` to the first `i1`
cue after it instead of playing. `i1` cues play normally — the preset gives
them `repeat: 3` so a 1–2-unknown cue is heard three times with target-only
subs.

The drill is opt-in: it is a preset study mode plus an optional custom-step
field, so all other modes and the default pipeline are untouched.

## Behavior matrix

| Entered cue band | skip:'non-i1' step | Any other step |
|---|---|---|
| `i1` | play (step runs normally) | unchanged |
| `easy` / `dense` | seek to first reachable `i1` cue after index; none found → play | unchanged |
| band `null` / probe `null` | play (safe fallback — whitelist, never skip the unknown) | unchanged |

"Play" = the full normal `enterCue` path (`repeatRemaining`, `applyStepEntry`,
`pauseOnUnknown START` check) — skip evaluation happens before all of it, so a
skipped cue never pauses, never consumes repeat, never emits subtitle/speed
actions.

## Skip mechanics (state machine)

`resolveStepSkip(step, cueIndex, cues, bandProbe, bounced): number` — pure,
exported from `studyModePlaybackController` (mirrors `resolveStepSubtitle`):

```ts
if (step.skip !== 'non-i1' || !bandProbe) return -1;
const band = bandProbe(cueIndex);
if (band !== 'easy' && band !== 'dense') return -1;  // i1 plays; null plays
for (let j = cueIndex + 1; j < cues.length; j++) {
  if (bounced.has(j)) continue;
  if (bandProbe(j) === 'i1') return j;
}
return -1;
```

Eager-target (single seek to the first reachable i+1, not per-cue hops):
avoids N flickering seeks through a run of skippable cues and keeps the
machine idle between. `bandProbe` is a `Map` lookup — O(1) per probe,
worst-case linear scan per skipped cue.

`enterCue` integration — `pendingSkipTo` is consumed FIRST (before the `!step`
early-return), then the skip branch sits before `repeatRemaining`/
`applyStepEntry`:

```ts
enterCue(cue, index) {
  this.activeCueIndex = index;
  this.activeCueEnd = cue.end - this.offsetMs;
  this.stepIndex = 0;
  this.loopCount = 0;
  this.silenceHandledIndex = -1;

  if (this.pendingSkipTo >= 0) {
    if (index < this.pendingSkipTo) this.bouncedSkipTargets.add(this.pendingSkipTo);
    this.pendingSkipTo = -1;
  }

  const step = this.currentStep();
  if (!step) return [];
  const skipTo = resolveStepSkip(step, index, this.cues, this.bandProbe, this.bouncedSkipTargets);
  if (skipTo >= 0) {
    this.pendingSkipTo = skipTo;
    this.activeCueIndex = -1;
    this.state = { type: 'idle' };
    return [{ type: 'seek', timeMs: this.cues[skipTo].start }];
  }

  this.repeatRemaining = step.repeat;
  // …existing applyStepEntry + pauseOnUnknown block unchanged
}
```

New private fields: `pendingSkipTo = -1`,
`bouncedSkipTargets = new Set<number>()`.

### Bounce guard (B1)

A skip seek can land inside an *earlier* cue when cues overlap (the engine's
`findCurrentLine` picks a deterministic match among overlapping cues — the
target start may lie inside another cue's range). Classification, consumed at
the top of the next `enterCue`:

- `index >= pendingSkipTo` → success (at or past target).
- `index < pendingSkipTo` → bounce: the *attempted target* is recorded in
  `bouncedSkipTargets`, so the landed cue's own skip evaluation re-scans and
  targets the next `i1` instead of the unreachable one.

Why a Set of targets (not a single disabled landing index): with ≥2
overlapping non-i1 cues, a landing-index guard loops forever (skip→land
earlier overlap→play→next overlap→skip same target→land same overlap→…).
Excluding proven-unreachable targets makes every bounce strictly advance the
scan; the Set is bounded by cue count so termination is guaranteed regardless
of geometry. Bonus: an "unreachable-by-seek" i1 cue still plays when normal
playback reaches it — `enterCue` only skips `easy`/`dense`, so the i1 band
plays whenever the engine enters it.

Deliberate user seek-back into a cue that then targets a bounced index →
retargets to the next i1 (same code path) — consistent behavior, documented.

### Reset semantics (M1)

- `abort()` (user seek, coordinator destroy path): resets `activeCueIndex`,
  `silenceHandledIndex`, `state` — **plus `pendingSkipTo`** (an interrupted
  in-flight skip must not misclassify the user's landing). Does NOT clear
  `bouncedSkipTargets` — bounce memory is a geometry fact; clearing it on
  every user seek would re-arm proven loops.
- `setCues` with `boundariesChanged` → calls `abort()` AND clears
  `bouncedSkipTargets` (new geometry → old bounces meaningless).
- `setMode` (currently unused — the coordinator always rebuilds via
  `applyStudyMode`, which constructs a fresh controller): resets both anyway
  for correctness.
- `applyStudyMode` → new `StudyModePlaybackController` → all skip state
  fresh per mode session.

### Idle guard

`handleSilence` returns `[]` while `pendingSkipTo >= 0` — prevents
`skipNoDialogue:'JUMP'` from issuing a competing seek toward an intermediate
cue while a skip is in transit.

### Landing + re-entry

`seek` actions flow through the coordinator's `trackInternalSeek` (±300ms
tolerance) so `onSeeking` ignores them, and the applier `seekToCue` already
adds `SEEK_LANDING_EPS_MS` (lands inside the target cue under frame
quantization). After the skip the machine is `idle`/`activeCueIndex=-1`, so
the coordinator's `!hasActiveCue` gate accepts the next `enterCue` as soon as
the engine index flips — same path a normal cue transition takes. While
`pendingSkipTo` is armed and the seek lands in a gap (`targetIndex=-1`) or
the same cue (forward overlap), the guard simply stays armed until some
`enterCue` consumes it — `handleSilence` suppression keeps the transit quiet.

### Repeat + multi-step

`repeat: 3` loops inside `processCurrentStepAtEnd` — seeks back to
`cueStartMs()` + `reapplyStep`, no `enterCue`, so skip is not re-evaluated
mid-loop (band changes during a drill loop only re-resolve the adaptive
subtitle, consistent with adaptive-subtitles semantics).

Skip is evaluated once per `enterCue` (always `stepIndex=0`). `skip` on
non-first steps is dead config — StepEditor only shows the group on step 1,
migration accepts the field on any step (harmless).

## Types + preset

`entities/studyMode/types.ts`:

```ts
/** Cue-entry skip policy resolved against the band probe. Evaluated only
 *  at cue entry (first step); 'non-i1' seeks to the first reachable i1 cue
 *  ahead. Distinct from `seek` (seek-back on step transitions). */
export type StepSkipRule = 'non-i1';
// StudyStep +=  skip?: StepSkipRule;
```

`entities/studyMode/constants.ts` — preset inserted after `adaptive`:

```ts
{
  id: 'i1-replay',
  type: 'preset',
  icon: 'repeat',
  title: 'i+1 Replay',
  description: 'Play only i+1 cues — each loops 3×; easier and denser cues are skipped.',
  steps: [{ subtitle: 'adaptive', pause: 'none', repeat: 3, speed: 1, after: 'continue', skip: 'non-i1' }],
}
```

Preset id is `i1-replay` (not the backlog slug): the mode replays i+1 and
skips dense — `dense-cue-replay` would misdescribe the behavior. No
`StudyModePresetId` union exists to update; the only id-scoped branch is
`'normal'` pass-through in `applyStudyMode` — unaffected.

## Resolver wiring

`features/studyModes/lib/modeUsesBandProbe.ts` (new, one-fn file matching
`findActiveMode.ts` convention). Cross-feature consumers deep-import
(`@/features/studyModes/lib/modeUsesBandProbe`) — the feature barrel only
exports the store API, matching `deep-imports.json` baseline convention:

```ts
export const modeUsesBandProbe = (mode: StudyMode | null | undefined): boolean =>
  (mode?.steps.some((s) => s.subtitle === 'adaptive') ?? false) ||
  mode?.steps[0]?.skip !== undefined;
```

(`skip` is only evaluated on step 0 — a dead-config `skip` on a later step
must not spin up the resolver.)

Consumers:

- `contentScriptController.syncUnknownResolver` `wantsResolver` — replace the
  inline `steps.some(s => s.subtitle === 'adaptive')` with
  `modeUsesBandProbe(currentMode)`.
- `StudyModesTab` — `modeUsesAdaptive` prop renamed `modeUsesBandProbe` (same
  semantics, now also true for skip modes) so the frequency-level chips stay
  visible; label logic unchanged.

No resolver changes: `bandProbe` already exists on `UnknownCueResolver`.

## Persistence + UI

- `migrateStudyModeState.ts`: `STEP_SKIP_VALUES = new Set(['non-i1'])`
  (`SKIP_VALUES` is taken — it validates `skipNoDialogue`);
  `isValidStep` += `(step.skip === undefined || STEP_SKIP_VALUES.has(step.skip as string))`.
  Absent = never skip; unknown values invalidate the step → mode dropped
  (consistent with every other step field).
- `StepEditor.tsx`: `SKIP_OPTIONS = ['never', 'non-i1']`; chip group rendered
  only when `index === 0`; `'never'` maps to `skip: undefined` (OptionGroup
  writes literal values, so skip gets a small custom group);
  `data-cell-id` convention `step-0-skip-*`.
- `formatStepSummary.ts`: append `, skip non-i1` when `step.skip` set.

## Out of scope

- Local player (no study-mode stack).
- Skipping mid-cue / rolling windows — cue-boundary decisions only.
- Band-probe-driven `repeat` (dynamic counts) — static `repeat: 3` covers the
  preset; `skip` does not imply dynamic repeat.
- Any UI beyond the preset entry + step chip (no toasts, no progress marks).

## Acceptance criteria

1. `resolveStepSkip` matrix: `step.skip` absent/other → -1; null probe → -1;
   band `i1` → -1; band `null` → -1; `easy`/`dense` → first `i1` index ahead;
   none ahead → -1; `bounced` indices skipped by the scan.
2. `enterCue` on a skippable cue emits exactly `[{seek: cues[j].start}]`,
   sets `activeCueIndex=-1`/`idle`, consumes no repeat, emits no
   setSubtitle/setSpeed/pause.
3. One `enterCue` → at most one `seek` action, aimed at the first `i1` —
   no intermediate `enterCue` for in-between cues (eager, not per-cue).
4. Probe-unavailable + `skip:'non-i1'` → mode plays every cue (degrade, not
   skip-all).
5. Bounce: landing index < pendingSkipTo → attempted target added to
   `bouncedSkipTargets`; the landed cue's skip eval retargets to the next
   i1; with two overlapping non-i1 cues spanning the target, playback
   converges (no repeated seek to the same cue).
6. `pendingSkipTo` suppresses `handleSilence` until consumed; cleared by
   `abort()` so a user seek mid-transit isn't misclassified.
7. i1 cue + `repeat:3` preset → seek-to-start + reapplyStep twice, then
   continue (existing repeat machinery, no skip re-eval mid-loop).
8. Mode switch mid-drill → abort + baseline restore (existing paths);
   `bouncedSkipTargets` persists across `abort()` but clears on
   `setCues`-boundariesChanged and on controller rebuild.
9. User seek into a non-i1 cue → enters → skips forward (drill contract);
   user seek into an i1 cue → plays fully.
10. Custom mode `{skip:'non-i1'}` survives migrate round-trip; garbage
    `skip:'always'` → mode dropped.
11. Live band update: `applyStatus` flips a cue `i1→easy` → re-entering it
    skips instead of drilling (resolver already rebuilds `bandMap`).
12. Resolver created for a skip-only mode with `pauseOnUnknown:'OFF'`
    (`wantsResolver` via `modeUsesBandProbe`); bandProbe wired on
    create/reuse/cleanup (all three sites, same as adaptive).
13. `StudyModesTab` frequency-level chips visible when the active mode is
    `i1-replay` (band knob tunable while pauseOnUnknown OFF).
14. `formatStepSummary` renders `skip non-i1`; StepEditor shows the group
    only on step index 0; `'never'` selection writes `skip: undefined`.
15. `PRESETS` order: `i1-replay` sits after `adaptive`; picker shows it with
    `repeat` icon.
16. Real Chrome: mock stream → enable `i1-replay` → an all-known cue is
    skipped (seek past), a 1–2-unknown cue plays + replays, a dense cue is
    skipped, switching to `normal` restores baseline, preset persists.

## Risks / decisions

- **"Skip" read literally** (seek past) vs "don't loop": the pain text says
  "skip cue 0 lạ hoặc quá nhiều lạ" — implemented as seek-past (asbplayer
  condensed-playback lineage). Opt-in preset makes the aggressive reading
  safe; users who don't want it never enable it.
- **Eager vs per-cue skip**: eager chosen (one seek, no flicker, machine
  idle in transit).
- **Overshoot tolerance**: `index >= pendingSkipTo` counts as success — a
  landing past the target (engine index jump, contiguous cues) proceeds
  normally. Edge: an i1 cue shorter than `SEEK_LANDING_EPS_MS` (80ms) could
  be skipped over silently — accepted, sub-frame cues are pathological.
- **Bounce → immediate retarget**: a bounced landing cue re-evaluates and
  seeks the next i1 rather than playing itself — more faithful to "skip
  non-i1"; the overlapping dense cue may still play partially while the
  engine index catches up — bounded deviation.
- **Repeat=3**: original play + 2 replays. Static — bands only re-resolve
  the subtitle inside `reapplyStep`.
- **Skip only at step 0**: matches `pause:'start'` semantics (entry-time
  fields); editor hides the group on later steps.
