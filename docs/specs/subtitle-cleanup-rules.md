# Spec: Subtitle cleanup rules — user-managed text removal + cue lead-in (v2)

> Intent: `docs/intent/subtitle-cleanup-rules.md` · ui_surface: yes · Mode: all · v2 after spec-review REJECT (mechanism re-founded on the real cue topology)

## Objective

Replace the single overlay-only "remove text in brackets" toggle with a persisted, user-manageable rule set (built-ins + custom regex) that cleans the **target** subtitle at the point target-cue arrays are handed toward the cue engine — so every consumer that reads the engine's shared cue objects (overlay render, tokenize binding, playback skip logic, card text) plus every derived surface (panel list, broadcast, practice) sees the same spoken-only text; rendered-empty cues disappear from learning surfaces; and a configurable `cueLeadInMs` shifts every study-driven cue-boundary seek earlier so replays include speech onset.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| Learner | Opens Study Modes → Advanced; toggles/adds/edits/deletes rules; sets lead-in; taps Ctrl in practice | Rule name, description, regex pattern, replacement text; lead-in ms; Ctrl keypress | Rule list state; validation errors; cleaned subtitles on all surfaces; replay with onset audio |
| Subtitle source | Supplies cues at load (auto-load, file import, search-select, OCR) | Raw cue text (may contain annotations) | — |
| Chrome storage | Fires onChanged on settings write | STUDY_MODES value | — |

System-internal: rule resolution, regex application, cue-object cleaning at intake, in-place re-derivation on rule change, empty-cue filtering, seek-target computation, seek-intent suppression. Actors never appear inside system steps.

## Requirements

### Functional

REQ-1: Manage cleanup rules
- Actor: Learner
- Goal: Control which text spans are removed from the target subtitle, with own rules for source-specific conventions
- Preconditions: Study Modes → Advanced section open; `advanced` loaded from storage
- Basic flow:
  1. Actor opens Advanced → system renders a "Subtitle cleanup" group: ordered list of resolved rules (built-ins first, then customs), each with name, description, and an enable toggle.
  2. Actor toggles a rule → system persists the new enabled state and re-derives cleaned text on all surfaces.
  3. Actor submits a new rule (name, description, regex pattern, replacement) → system validates the pattern compiles, appends it enabled after built-ins, persists, re-derives. Empty replacement = delete match; non-empty feeds `String.replace` so `$1`, `$&`, … references work.
  4. Actor edits or deletes a custom rule → system persists the change, re-derives.
- Alt flow: Edit opens the same form prefilled; delete asks confirmation (same pattern as custom-mode delete).
- Exception: pattern fails `new RegExp(pattern, 'gmu')` → inline error, save refused. Empty name or a name colliding with an existing rule → refused. A malformed persisted `cleanupRules` blob (wrong shape, non-array `custom`, non-string fields) → `sanitizeAdvanced` drops it and re-seeds the default (same as any other malformed `advanced` field — never crashes, never trusts storage shape).
- Rules: built-ins toggleable, never editable/deletable; customs fully editable; custom pattern compiled with fixed flags `gmu`; rule order = catalog order then creation order; caps: ≤50 custom rules, ≤500 chars/pattern, ≤80 chars/name, ≤200 chars/replacement.
- Postcondition: `advanced.cleanupRules` persisted; every surface re-derives within the next render/store tick.
- NFR refs: NFR-1, NFR-2, NFR-4

REQ-2: Clean target-cue arrays upstream of the cue engine
- Actor: Subtitle source (provides raw cues); Chrome storage (fires rule changes)
- Goal: The engine's cue objects — the shared objects every consumer reads — carry cleaned `text` plus `rawText`, so all consumers (including ones inside dirty files) see cleaned text without per-surface forks
- Preconditions: **invariant — every `SrtCue[]` passed as the target argument to `loadCues`/`loadBilingualCues` is `cleanTargetCues`-processed.** Intake seams (all in clean files, enumerated exhaustively):
  - `handleAutoLoadSubtitles` (`subtitleAutoLoad.ts`) — after parse, before `controller.loadBilingualCues/loadCues` + `onPanelRender` + translate-prefill fan-out
  - `processImportedFiles` (`contentScriptFileImport.ts:91,98`) — `targetCues` before `loadBilingualCues` + `latestTargetCues`, and the single-file fallback `parsed[0].cues`
  - `contentScriptSelection.ts` — target-branch of `onPanelSelect`/imported (:45), `onSubtitleSelect` auto-track re-select (:88), `onSearchedSelect` (:145), `handleSearchResultSelect` first-load (:290) — each cleans the cues var before `loadBilingualCues` + `latestTargetCues`
  - OCR bridge (`contentScriptLifecycle.ts:88-103`) — clean once into a local (`const targetCues = cleanTargetCues(d.targetCues)`) used by every consumer in the block (`loadBilingualCues`, `latestTargetCues`, `mergeCuesForPanel`, `broadcastCues`); `ocrTargetSlot.cues` alone stores the **raw** array, and the OCR re-activation select (`contentScriptSelection.ts:207`) cleans `slot.cues` at egress
  - `contentScriptMessages.ts` adapters (:245-246) + re-pushes (:118,134,320) — idempotent defense-in-depth; re-pushes of `latestTargetCues`/`snapshot.targetCues`/`[...getTargetCues()]` (`contentScriptSelection.ts:217`, `contentScriptKeyboard.ts:196,211`, `contentScriptController.ts:418` dirty) are safe-by-construction: any array sourced from engine/`latestTargetCues` is already cleaned
  - local-player (`useSubtitleEngine.ts`/`useSubtitleMatching.ts` → `loadAndParseSubtitle` → `engine.loadBilingualCues/loadCues` :151,153) — separate entrypoint context, clean files — same helper at its load boundary, and `buildBilingualCues` (PlayerView) propagates `rawTargetText`
- Caches (`importedParsedTarget`, `parsedSearchCache`, `ocrTargetSlot`) store **raw** cues — cleaning happens at select/load egress only, keeping caches as pristine source material and covering every future select path uniformly. Any revived/dead `subtitleSyncController` helper that later writes `latestTargetCues` or calls the load methods must apply the same egress-clean rule.
- Basic flow:
  1. System resolves the enabled rule list from `advanced.cleanupRules` (`resolveCleanupRules` SSOT — catalog + `builtinEnabled` + customs).
  2. `cleanTargetCues(cues)` maps each cue to `{ ...cue, rawText: cue.rawText ?? cue.text, text: applyCleanupRules(raw, rules) }` — idempotent (cleaning is always from `rawText`), returns a new array, and registers it in a WeakRef registry.
  3. The cleaned array fans out: engine (`loadCues`/`loadBilingualCues` stores the same object refs), `latestTargetCues`, panel merge, broadcast, tokenize `setCues`, `studyMode.setCues` — all hold the same cleaned objects.
  4. On rule change (storage onChanged → fingerprint diff), `recleanRegistered()` rewrites `cue.text` in place on every registered array (`SrtCue.text` is readonly — the runtime mutates through an explicit mutable view; documented) — engine, tokenize's stored array, playback's cue list, `latestTargetCues` — all update because they share the object refs (caches are raw + unregistered by design); then `useCuesStore.recleanTargetText()` maps store cues to fresh objects **without** touching `targetActiveIndex`/`nativeActiveIndex` (a plain `setCues` would reset them and blank the current line). Each extension context (content script, side panel, local player) runs its own runtime instance fed by the same `chrome.storage.onChanged` — no cross-context state.
- Alt flow: persisted rules not yet loaded at first intake → clean with built-in defaults; when the stored set arrives (fingerprint diff) `recleanRegistered()` re-derives — bounded transient, no refetch.
- Exception: a rule whose regex throws at runtime is skipped for that text (per-rule try/catch); other rules still apply.
- Rules: only the **target** track is cleaned — `nativeCues`/`nativeText` untouched (overlay's existing bracket strip on the native line stays via the legacy flag); `index`/`start`/`end` preserved; `applyCleanupRules` is pure + deterministic; application order = resolved rule order, then a normalization post-pass (per-line: trim, collapse `[ \t]{2,}`→`' '`, strip orphaned separators left by removed labels — leading `^[ \t]*[,:;]+[ \t]*` (`(JOHN): hi` → `hi`) and trailing `[ \t]*[:;]+$` (`hi :(JOHN)` → `hi`; a trailing `,` is kept — legit continuation commas are too common to strip) — drop emptied lines, final trim).
- Postcondition: engine-held cue objects have cleaned `text` + `rawText`.
- NFR refs: NFR-1, NFR-2, NFR-6

REQ-3: Same cleaned text on every learning surface
- Actor: — (system guarantee)
- Basic flow:
  1. `SubtitleBlock` renders `cue.text` from `useCuesStore` — populated from `Tihoka_CUES_UPDATED` carrying the (already-cleaned) engine arrays → cleaned. Legacy `removeBracketed` prop pass stays for the native line.
  2. Overlay tokenize binding reads `engine.getTargetCues()` — cleaned objects → no raw re-insertion.
  3. `studyMode.setCues(engine.getTargetCues())` → playback's cue list holds cleaned objects → `enterCue`'s `cue.text.trim()` check and all emitted cue text are cleaned.
  4. `mergeCuesForPanel` emits `BilingualCue` with `targetText` = cleaned text + `rawTargetText` = `cue.rawText ?? cue.text` → panel props and the `SUBTITLE_CUES_LOADED` broadcast carry both (`bilingualCueSchema` gains optional `rawTargetText` — **required**, zod strips unknown keys).
  5. `SubtitlePanel` maps incoming `cues` → display cues with `targetText = applyCleanupRules(rawTargetText ?? targetText, currentRules)` (memoized on cues + rules fingerprint; panel subscribes to the study-mode store so a toggle re-renders) → `CueList`, `practiceCues`, practice session all consistent, and the side panel re-derives on rule change without a re-broadcast.
  6. Card `contextSentence` and comprehension score read `cue.text` → cleaned.
- Alt flow: `rawTargetText` absent (stale/foreign payload) → fall back to `targetText` (degrades to the snapshot's cleaned text).
- Exception: none beyond REQ-2's.
- Rules: one transformation, one rule list; the only per-surface work is the panel's re-derivation map (needed because broadcast/store snapshots are static objects).
- Postcondition: all surfaces consistent, including consumers inside dirty-owned files (tokenize controller, card creator, `enterCue` path).
- NFR refs: NFR-1, NFR-5, NFR-6

REQ-4: Rendered-empty cues are hidden
- Actor: — (standing system rule, independent of which cleanup rules are on)
- Basic flow:
  1. Panel: `visibleCues` excludes cues whose effective target **and** native text are both empty; `practiceCues` additionally requires non-empty cleaned `targetText` (filtering lives in `SubtitlePanel`, before the dirty `CueList`).
  2. Overlay: `SubtitleBlock` gates on non-empty effective `cue.text` — a cleaned-empty target cue renders as no cue (no text, no background layer); the native-layer `hasNativeCue` check likewise gates on non-empty effective native text so an empty pair produces no background box at all.
  3. Playback: `enterCue`'s empty check reads cleaned `cue.text` (objects are shared) → cleaned-empty cue is skipped as a non-cue — no pause/wait wedge, no step arming.
- Alt flow: target cleaned-empty but native has text → the row stays (translation still informative) but is never a practice target.
- Rules: hiding ≠ skipping — playback timing, cue indices, seek math untouched; hidden cues remain in the store/engine for nav/seek-by-time.
- Postcondition: no ghost rows, no exercises on unspoken answers, no empty overlay box, no soft-lock.
- NFR refs: NFR-1

REQ-5: Built-in rule catalog
- Actor: — (system ships it)
- Basic flow: `BUILTIN_CLEANUP_RULES` (ordered, all `defaultEnabled: true`; glyph set `G = ♪♫♩♬♭♮𝄞𝄢𝄡🎵🎶🎤🎧` shared by music rules):
  1. `html-tags` — `<[^>]+>` — residual markup tags.
  2. `brackets` — `\([^()]*\)|\[[^\[\]]*\]|\{[^{}]*\}` with `repeatUntilStable` (≤3 passes) — matched `()`/`[]`/`{}` pairs incl. nesting.
  3. `bracket-orphans` — `\((?![^(]*\))|\[(?![^\[]*\])|\{(?![^{]*\})` — a lone opener with no same-type closer ahead (runs only after pairs stabilize → matches `removeBracketedText`'s unclosed-bracket behavior for same-type input).
  4. `speaker-label` — `^\s*[-–—―]?\s*[A-ZÀ-Þ][A-ZÀ-Þ0-9 .,'&()_-]{1,39}:` — `-OWNER:`, `MAN 1:` at line start (≥2 chars, optional leading dash). Documented edge: also eats legit all-caps sentence labels (`NOTE:`, `CHAPTER 3:`) — accepted, toggleable.
  5. `speaker-chevrons` — `^\s*>+\s*` — `>>`/`>>> ` speaker-change markers.
  6. `dialogue-dash` — `^\s*[-–—―]+[ \t]*` — leading dialogue dash(es). Documented edge: eats `- 5 items`-style enumerations — accepted, toggleable.
  7. `trailing-dash` — `[ \t]*[-–—―]+[ \t]*$` — a dash orphaned at line end (e.g. the `-` left behind by a stripped `-(CHUCKLES)`).
  8. `music-glyphs` — `[G]+` — stray note glyphs anywhere; wrapped lyrics keep their inner text (`♪ theme ♪` → `theme`) because only the glyphs are stripped (the former `music-wrapped` whole-line rule was removed — it ate real song lyrics).
  9. `control-glyphs` — `[\u200B-\u200F\u202A-\u202E\uFEFF]` — invisible bidi/zero-width marks.
- Alt flow: user disables any built-in via its toggle (persisted in `builtinEnabled`).
- Rules: catalog order = application order before customs (pairs before orphans, speaker-label before trailing-dash); stable ids (persisted keys); each entry carries name + one-line description + inspectable pattern. Documented residues: `<<x>>` → `>` (html-tags eats `<<x>`), mid-word `a(b)c` → `ac`, depth >3 nesting leaves `()`, cross-type nested spans like `(a [b)` can diverge from `removeBracketedText` — all bounded, toggleable, improvable via custom rules.
- Postcondition: fresh install cleans SDH brackets, speaker labels, chevrons, dashes (leading + orphaned trailing), note glyphs, residual tags, control chars — without dropping text wrapped in those glyphs.
- NFR refs: NFR-2, NFR-3

REQ-6: One-key replay in practice
- Actor: Learner
- Goal: Rehear the active cue with a single Ctrl tap while typing
- Preconditions: practice session active, `activeCue` exists, input focused
- Basic flow:
  1. Actor presses and releases Ctrl with no intervening keydown → system replays the active cue (same `onReplay` as the footer button).
  2. Footer legend shows `Ctrl` for replay.
- Alt flow: Ctrl+R / Cmd+R continue to work unchanged.
- Exception: any other keydown while Ctrl held (chord — Ctrl+C/V/R/…, including keys whose keydown is swallowed by the OS → covered by the keydown-presence check) → no replay; `e.repeat` ignored; input blur or `Escape` clears the pending flag; both `ControlLeft`/`ControlRight` count; `Meta` (Cmd alone) deliberately does NOT fire — Cmd is a heavy OS chord key on macOS (Cmd+R still works via the existing handler).
- Rules: fire on Ctrl **keyup** only when pending is still set; never when `activeCue` is null.
- Postcondition: cue replayed; draft text untouched.
- NFR refs: NFR-4

REQ-7: Full-width practice input
- Actor: Learner
- Basic flow: `.answerInput` no longer caps at `60ch` inside `@container (min-width: 768px)`; existing `max-inline-size: 100%` governs.
- Rules: `.clozeText`/`.feedbackTokens` keep their `70ch` cap.
- NFR refs: NFR-4

REQ-8: Configurable cue lead-in on study-driven seeks
- Actor: Learner
- Goal: Replays/repeats include speech onset on loosely-timed sources
- Preconditions: `advanced.cueLeadInMs` persisted int, 0–2000, step 50, default 0
- Basic flow:
  1. Actor sets lead-in in Advanced → persisted, applied immediately.
  2. Every study-driven seek whose semantic target is "the start of cue C" emits `C.start − leadIn` clamped ≥0:
     - playback-controller chain/loop/step seek-backs via `cueStartMs()` and skip/JUMP emits (`cues[i].start`) — each emitted `seek` action carries `cueSeq` = the target cue's `index` (SRT sequence, distinct from the array-index `cueIndex` already used by other action types) for REQ-9;
     - practice replay/prev/next + Ctrl replay: `SubtitlePanel` resolves the target cue from `practiceCues` (hidden cues already excluded — nav skips them consistently in both transports), marks `markCueSeekIntent(target.index)`, then emits `onReplayCue({ ...target, start: target.start − leadIn })` through the injected seam (overlay-mode impl seeks `cue.start − offsetMs` directly) or `onSeek(target.start − leadIn)` on the fallback path;
     - side-panel practice transport: the sender (`App.tsx` `handleReplayCue`/`seekAndResume`) includes `cueSeq` in the SEEK_TO payload — schema (`seekToPayloadSchema` + `SeekToPayload` type) gains optional `cueSeq`; the background relay (`sidePanelRelay.ts`) forwards it instead of rebuilding `{timeMs}`; the content handler marks the intent.
- Alt flow: lead-in = 0 → targets identical to today on every path.
- Exception: practice "next" at the last cue → injected `onContinueCue` is still invoked (preserves its resume-at-end behavior); otherwise prev/next route through the replay seam — the injected `onPreviousCue`/`onContinueCue` are bypassed for seek purposes (their `findIndex` anchors can't accept a shift; recorded as debt).
- Rules: lead-in is subtracted exactly once, at the emission site — `seekToCue`/`seekVideo`/SEEK_TO handlers stay dumb transports. Landing EPS asymmetry is pre-existing (`seekToCue` +80ms vs `seekVideo` none) and unchanged — every path lands where it lands today minus `leadIn`. Non-study seeks untouched: cue-list row clicks, `a`/`d`/`s` shortcuts, offset sync, resume positions.
- Postcondition: replay lands before speech onset; display timing (`offsetMs`) unaffected.
- NFR refs: NFR-1, NFR-3

REQ-9: Lead-in landing must not arm the wrong cue's study chain
- Actor: — (system guarantee)
- Goal: A lead-in seek landing inside an earlier cue's window must not arm that cue's pause/repeat/skip logic; the intended cue arms when playback reaches it
- Basic flow:
  1. Study-driven seeks record their **intended cue** (`cueSeq` = the cue's SRT-sequence `index`, uniform across transports):
     - internal: `seek` PlaybackAction carries `cueSeq` → `trackInternalSeek` stores `pendingCueSeq`;
     - external: `markCueSeekIntent(seq)` (shared clean module) — called by `SubtitlePanel` before injected practice emissions (same content-script context) and by the SEEK_TO handler in `contentScriptMessages` (payload `cueSeq` forwarded by `sidePanelRelay`).
  2. `SubtitleStudyModeController.onTimeUpdate`, **before** the cue-change branch (unconditional per tick): if `pendingCueSeq` is set and `targetCues[targetIndex]?.index === pendingCueSeq` → the engine sits on the intended cue → clear `pendingCueSeq`. This clears same-cue seeks (repeat/loop land back on the owned cue — no cue-change event ever fires) and prevents the intent from stalling the next genuine cue's chain.
  3. In the cue-change branch: while `pendingCueSeq` is still set, a `targetIndex` whose cue `.index ≠ pendingCueSeq` updates `lastTargetIndex` (bookkeeping — no refire) but skips `enterCue`. The intended cue arms when playback reaches it.
  4. Intent lifecycle: cleared on observed match (step 2), replaced by a newer marked seek, reset on `applyStudyMode`/`setCues`/`destroy`, and on an external `onSeeking` arriving >250ms after the mark (a subsequent unmarked user seek wins; ≤250ms is the marked seek's own landing — kept).
- Alt flow: lead-in lands in a silence gap → no foreign cue → nothing suppressed; intended cue arms on entry. Overlapping cues: any non-intended `enterCue` is suppressed while pending (no window-end condition needed).
- Exception: playback paused before reaching the intended cue → intent persists until a match or a newer/external seek. Duplicate `.index` values in malformed tracks → first match wins (findIndex) — bounded ambiguity, noted.
- Rules: suppression applies only to **arming** — the cue engine's index tracking and overlay highlight still follow the video clock (briefly showing the earlier cue's text while landed inside it is honest). An externally-marked seek still goes through `onSeeking`'s normal path — `playback.abort()` runs and `lastTargetIndex` resets (the intent's own landing IS an external seek); this is intended: the old chain is cancelled and the intended cue re-arms fresh on entry. Internal seeks are filtered by `internalSeekTargetMs` tolerance before reaching this path, as today.
- Relay hygiene folded into the same edit: `ShortcutActionPayloadSchema` gains optional `seekTime` and `sidePanelRelay` forwards the full parsed payload — today the relay rebuilds `{action}` and zod strips `seekTime`, silently killing the ADR-021 D8 fast path (pre-existing bug, same rebuild-drop pattern as `cueSeq`).
- Postcondition: dictation replay with lead-in crossing a contiguous boundary plays the onset audio and pauses at the intended cue's end — not the previous cue's.
- NFR refs: NFR-1

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | No per-tick work: `cleanTargetCues` runs only at intake/reclean; regexes compiled once per resolved-rule-list version; panel map memoized on (cues, fingerprint); intent check is O(1) per timeupdate | P | O(1) repeat ticks |
| NFR-2 | User regex trust boundary: compile-validate (`gmu`) at save; per-rule try/catch at apply; caps ≤50 customs / ≤500 chars / ≤3 stable passes. Honest ceiling: catastrophic-but-valid backtracking can still stall one clean pass — bounded by caps, not eliminated | R, +security | invalid input never reaches the render path |
| NFR-3 | Schema stays v1 — never bump `CURRENT_VERSION` (v<1 resets to INITIAL, wiping modes). Seeding: absent `cleanupRules` → `builtinEnabled` = catalog defaults **except** `brackets` seeded from legacy `removeBracketed` (respects the stored choice); `custom` = []. Fresh `INITIAL` ships `cleanupRules` all-defaults-on. `removeBracketed` stays on `StudyModeAdvancedSettings` as a derived field (= brackets-rule enabled) — recomputed both at sanitize time AND at `setAdvanced` write time so `reactSubtitleController.ts:583` compiles/works unchanged. Note: fresh installs now get `removeBracketed=true` derived → the overlay native-line bracket strip becomes default-on for new users (intended default change). The legacy checkbox row in `StudyModesTab` is replaced by the rules group | R | zero data loss; dirty call sites untouched |
| NFR-4 | Rules UI keyboard-operable, labeled controls, delete confirmation, inline validation; Ctrl replay never disturbs typing/chords | U | same a11y bar as the rest of the tab |
| NFR-5 | **No edits to dirty files** owned by in-flight work: `CueList.tsx`, `CueRecommendFab.module.css`, `reactSubtitleController.ts`(+test), `contentScriptController.ts`, `subtitleCueEngine.ts`, `subtitleTokenizeController.ts`(+test), `tokenize/utils/*`, `useMenuPlacement.ts`, `shared/i18n/messages/{en,vi}.json`, `docs/2-architechture-system.md`, dictionary files, `CueList.test.tsx`, `e2e/stage2/*`, `mockResources.ts`, `entities/dictionary/*` | S | zero merge conflicts with `subtitle-bulk-status` |
| NFR-6 | Cleaning is idempotent: `rawText` is never re-cleaned — `cleanTargetCues` on already-cleaned objects is a no-op | R | deterministic |

## Flows / States

### Rule application (per cue text)

```
rawText ──▶ for each enabled rule in resolved order:
              try { text = text.replace(regex, rule.replacement ?? '') } catch → skip rule
              (repeatUntilStable: loop ≤3 until unchanged)
            ──▶ post-pass: per-line trim, collapse runs of spaces/tabs,
                strip orphaned leading `^[,:;]+` / trailing `[:;]+$` separators,
                drop emptied lines, final trim ──▶ cleaned text
```

### Cue-object lifecycle

```
parse ──▶ cleanTargetCues(cues) → new objects {…cue, rawText, text}
        → registered in WeakRef registry
        → fan-out: engine.loadBilingualCues / latestTargetCues /
          mergeCuesForPanel / tokenize.setCues / studyMode.setCues /
          broadcast (all share the SAME object refs)
rule change ──▶ recleanRegistered(): in-place cue.text rewrite on
        registered arrays (all shared-ref consumers update)
        → useCuesStore.recleanTargetText() fresh objects (React re-render,
          active indices preserved)
        → SubtitlePanel re-derives display cues from rawTargetText
```

### Ctrl replay state machine (practice input)

```
idle ──keydown Control (no repeat)──▶ pending
pending ──keydown any other key──▶ idle        (chord → no replay)
pending ──keyup Control──▶ replay(activeCue) → idle
pending ──blur/Escape──▶ idle
```

### Lead-in seek + intent

```
study-mode chain/skip/JUMP            practice replay/prev/next (SubtitlePanel)
  cueStartMs()/cues[i].start − L        resolve target from practiceCues
  seek action {timeMs, cueSeq}          markCueSeekIntent(target.index)
       │                                onReplayCue({…t, start−L}) │ onSeek(start−L)
       ▼                                     injected impl: video.currentTime
  trackInternalSeek → pendingCueSeq       = start−L−offset  OR  SEEK_TO{timeMs,cueSeq}
       │                                     → relay forwards → handler marks → seekVideo
       ▼
  per-tick: targetCues[targetIndex].index = pending → clear pendingCueSeq
  cue-change(M): M.index ≠ pending → lastTargetIndex=M, no enterCue
                 M.index = pending → (already cleared) enterCue(M)
```

## Function ↔ Feature Map

| Function (what the system does) | Features (tools supporting it) |
|---|---|
| Clean target cue text per enabled rules | `applyCleanupRules` + `resolveCleanupRules` + `BUILTIN_CLEANUP_RULES` (pure, `entities/studyMode/cleanupRules.ts`); `cleanTargetCues`/`recleanRegistered` (`features/subtitle/logic/subtitleCleanupRuntime.ts`, per-context); `markCueSeekIntent` (`shared/lib/cueSeekIntent.ts`); intake-seam calls in autoLoad/fileImport/selection/lifecycle/messages/local-player |
| Carry cleaned+raw text to every surface | `SrtCue.rawText?`, `BilingualCue.rawTargetText?` (+zod optional), `mergeCuesForPanel` propagation, `useCuesStore.recleanTargetText()`, `SubtitlePanel` display-cue map |
| Let the user manage the rule set | Rules group in `StudyModesTab` Advanced (list + toggles + add/edit/delete + validation); `advanced.cleanupRules`/`cueLeadInMs` persist + sanitize/seed in `migrateStudyModeState` + `studyModeStore.setAdvanced` |
| Hide rendered-empty cues | `visibleCues`/`practiceCues` effective-empty filters, `SubtitleBlock` empty-gate, `enterCue` cleaned-text check (free via shared objects) |
| Land study seeks before speech onset | `cueLeadInMs` + Advanced number control; `cueStartMs`/skip/JUMP subtraction + `cueSeq` on seek actions; `SubtitlePanel` shifted emissions; `seekToPayloadSchema`/`SeekToPayload` + `ShortcutActionPayloadSchema`/`ShortcutActionPayload` optional `cueSeq`/`seekTime` + `sidePanelRelay` full-payload forwarding + `App.tsx` sender; `markCueSeekIntent` + `pendingCueSeq` suppression in `SubtitleStudyModeController` |
| Rehear a cue with one key | Ctrl-tap handler in `SubtitlePracticeSession` input + legend update |
| Give the answer field the row width | remove `60ch` cap (one CSS deletion) |
| Localize new UI copy | feature-local `cleanupRuleMessages` (en/vi) — interim until `messages/{en,vi}.json` are unblocked (dirty) |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| `SubtitleCleanupRule` | `id`, `name`, `description`, `pattern`, `replacement?`, `enabled`, `builtin`, `repeatUntilStable?` | resolved in-memory from catalog + settings | session |
| `advanced.cleanupRules` | `{ builtinEnabled: Record<id, boolean>, custom: SubtitleCleanupRule[] }` | `chrome.storage.local[STUDY_MODES]` (via `StudyModeState`) | persistent |
| `advanced.cueLeadInMs` | int 0–2000, default 0 | same | persistent |
| `SrtCue.rawText?` | original pre-clean text | engine arrays, `latestTargetCues`, store (shared refs — caches stay raw) | per load |
| `BilingualCue.rawTargetText?` | original pre-clean target text | panel props + `SUBTITLE_CUES_LOADED` payload | per message/store |
| Seek intent | `{ cueSeq, armedAt }` pending marker | `cueSeekIntent` module (`src/shared/lib/`) + `SubtitleStudyModeController.pendingCueSeq`; handoff = pull (coordinator consults the module per tick) | until consumed/expired |

## Traceability

| Need | REQ | SC |
|---|---|---|
| N1 (practice scores spoken text) | REQ-2, REQ-3 | SC-1 |
| N2 (same cleaned text all surfaces) | REQ-2, REQ-3 | SC-1, SC-2 |
| N3 (rendered-empty cue hidden) | REQ-4 | SC-3 |
| N4 (toggle + CRUD custom rules) | REQ-1 | SC-5, SC-6 |
| N5 (built-in edge-case coverage) | REQ-5 | SC-7 |
| N6 (bad regex never breaks) | REQ-1, REQ-2; NFR-2 | SC-8 |
| N7 (legacy pref carries over) | REQ-5; NFR-3 | SC-9 |
| N8 (uniform cleaned text incl. dirty-owned consumers) | REQ-2, REQ-3; NFR-5 | SC-2, SC-3, SC-4 |
| N9 (one-key replay) | REQ-6 | SC-10 |
| N10 (full-width input) | REQ-7 | SC-11 |
| N11 (lead-in for onset) | REQ-8, REQ-9 | SC-12, SC-13, SC-14 |

| Journey step (TO-BE) | REQ |
|---|---|
| 1 rule group with toggles + custom rules | REQ-1, REQ-5 |
| 2 `Let the man breathe!` everywhere | REQ-2, REQ-3, REQ-5 |
| 3 cleaned-empty cues vanish, no wedge | REQ-4 |
| 4 custom rule persists | REQ-1; NFR-3 |
| 5 Ctrl replay + full width | REQ-6, REQ-7 |
| 6 lead-in setting lands replay early | REQ-8, REQ-9 |

## Alternatives Considered

1. **Clean at `useCuesStore.setCues`** (v1 spec) — rejected by review: the store is a downstream leaf; the engine holds parallel raw arrays that tokenize, `enterCue`, card text, and broadcast read → leaves the majority of surfaces raw. Chosen instead: clean upstream of the engine where the shared objects are created.
2. **Clean inside `parseSubtitle`** — rejected: parser stays a pure format→cues function; role (target vs native) isn't known at parse time; would also silently change non-study consumers (local-player scoring, tests).
3. **Per-surface cleaning** (panel map + overlay prop + practice args) — rejected: re-introduces N-surface forks, can't reach consumers inside dirty files.
4. **Request-handoff on the dirty files** — rejected for now: blocks this item on `subtitle-bulk-status` indefinitely; the chosen boundary makes their files correct-by-construction. Recorded as the fallback if a seam turns out dirty at DELIVER time.
5. **RE2/regex-timebox dependency** — rejected: new dep not justified; caps + try/catch bound the realistic risk.

## Boundaries

- Always: `npm run typecheck && npm run test:unit && npm run build` before commit; tokens/components from `src/shared/ui`; pure logic separated from side effects; one SSOT (`applyCleanupRules`).
- Ask first: new dependencies (none planned); `manifest.json` changes (none needed); `bilingualCueSchema`/`seekToPayloadSchema`/`shortcutActionPayloadSchema` additive-optional fields — flagged, called out in review.
- Never: edit dirty files (NFR-5 list); bump `STUDY_MODES` schema version; commit secrets; hand-edit generated `tokens.css`/`tokens.ts`.

## Success Criteria

- [ ] SC-1: `-OWNER: Let the man breathe! -(CHUCKLES)` renders/scores as `Let the man breathe!` on overlay, panel row, dictation evaluation, and cloze parts with default rules on.
- [ ] SC-2: Toggling a rule off then on changes rendered text on all surfaces without reloading cues — overlay (`SubtitleBlock`), tokenized overlay line, panel list, practice target — via `rawText`/`rawTargetText` re-derivation (in-place rewrite + panel map + store bump), including the side panel.
- [ ] SC-3: A cue that cleans to empty (`(APPLAUSE)`, `♪♪`, `♪ Theme music ♪`) produces no panel row, no practice target, no overlay box; in pause-based modes `enterCue` skips it — no wedge.
- [ ] SC-4: Overlay tokenize binding renders cleaned text (engine objects are cleaned upstream — no raw re-insertion); card `contextSentence` and comprehension score use cleaned text.
- [ ] SC-5: Each rule toggles independently; built-ins can't be deleted/edited; custom rules add/edit/delete with name+description+regex and persist across reload.
- [ ] SC-6: Custom regex compiles under `gmu` at save time — invalid patterns refused with an inline error; duplicate/empty names refused.
- [ ] SC-7: Built-ins cover: brackets incl. nesting + lone unmatched opener (parity with `removeBracketedText`), `NAME:`/`MAN 1:` speaker labels, `>>` markers, leading dashes, wrapped music lines (whole line gone), stray note glyphs, residual `<tags>`, invisible control chars.
- [ ] SC-8: A runtime-throwing user rule cannot crash rendering (per-rule try/catch). Known ceiling: a catastrophic-but-valid pattern can still stall one clean pass — bounded by caps, not eliminated (documented, no RE2 dep).
- [ ] SC-9: Existing `removeBracketed=true` → brackets rule enabled; `false` → disabled; other built-ins default-on for everyone; `removeBracketed` remains on the type (derived) and `reactSubtitleController.ts:583` keeps working unchanged.
- [ ] SC-10: Ctrl tap replays the active practice cue; Ctrl+other-key chords, `e.repeat`, blur, and Cmd alone never replay; Ctrl+R/Cmd+R still work; legend updated.
- [ ] SC-11: `.answerInput` fills the footer row at ≥768px container width.
- [ ] SC-12: With `cueLeadInMs=L>0`, study-driven cue-boundary seeks land at `cue.start−L` clamped ≥0: chain repeat/loop/step seek-backs, skip/JUMP, practice replay/prev/next, Ctrl replay — in both overlay and side-panel practice. With L=0, identical to today. Every path subtracts exactly once.
- [ ] SC-13: A lead-in landing inside the previous cue's window does not arm that cue's chain (no premature `pausedEnd`/`waiting`); the intended cue arms when playback reaches it; cue-list clicks and `a`/`d`/`s` seeks behave exactly as today.
- [ ] SC-14: `git status` shows no edits to the NFR-5 dirty-file list; new UI copy lives in the feature-local messages module.

## Definition of Done

- [ ] All Success Criteria pass (unit tests for: rule engine incl. repeatUntilStable + per-rule try/catch, migration seeding, empty-cue filtering, Ctrl state machine, lead-in subtraction at each emit site, intent suppression incl. overlapping/late-arriving cues)
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] UI changes pass design-system check (tokens/components from `src/shared/ui`)
- [ ] Real-Chrome verification per `testing-extension-browser`: rule toggles live-update overlay + tokenized line + panel + practice; lead-in replay audible onset; `git status` clean of foreign files
- [ ] Canon docs updated: `docs/2-architechture-system.md` (post-handoff — file currently dirty; capture the change notes for the owning agent or update after their merge), `docs/0-wiki.md` changelog

## Open Questions / Accepted Risks

- Tokenize staleness mechanism (corrected): `videoTokenMap` caches **prepared tokens keyed by cue index** (`videoTokenPreloader.ts:156-160`) — an in-place `text` rewrite does not invalidate the cache, so after a rule toggle the binding can align OLD prepared tokens onto NEW text until the next `setCues`/cue load. Bounded to the tokenize feature, cosmetic, resolves on next cue load; no clean seam exists to force a rebind (controller is dirty-owned). Accepted.
- OCR bridge re-cleans the growing `d.targetCues` array per `__Tihoka_OCR_TRACKS` message (~5/s, O(cues×rules)) — bounded by typical OCR session volume; the helper is idempotent so unchanged cues are cheap re-maps.
- Translate prefill now receives **cleaned** target text (`latestTargetCues`/engine refs) — translations skip annotations; desired, flagged as a content change.
- Seek-intent freshness window 250ms covers relay/CustomEvent hop jitter; a second unmarked user seek within the window could briefly suppress one `enterCue` — self-heals on the next cue boundary.
- `removeBracketed` legacy field lingers as a derived value until `subtitle-bulk-status` lands and its call site can be cleaned up — recorded debt.
- Practice prev/next route through the replay seam (`onReplayCue` with shifted target + resolved from `practiceCues`) so the dirty controller's `findIndex` anchor is never shifted — the injected `onPreviousCue`/`onContinueCue` props are bypassed for seeks (kept for API compat + last-cue resume); flagged for the owning agent's merge review.
- Feature-local i18n module is interim debt — merge keys into `shared/i18n/messages` after `subtitle-bulk-status` ships.
- ReDoS ceiling as stated in NFR-2/SC-8.
- Anki card `contextSentence` inherits cleaned text (cards get spoken text — desired, but a silent content change for rule-covered annotations; called out).
- `docs/2-architechture-system.md` is dirty-owned — the required update is staged for the owning agent or post-merge.
