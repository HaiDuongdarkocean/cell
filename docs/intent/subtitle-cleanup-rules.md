# Intent: Subtitle cleanup rules — user-managed text removal for the learning surface

> Slug: `subtitle-cleanup-rules` · Mode: all · Source: user statement (4-part request, this thread)
> ui_surface: yes          ← consumed by specify→design|deliver routing
> confidence: medium

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | Learners are tested against subtitle text that is never spoken — speaker labels (`OWNER:`), sound-effect annotations (`(CHUCKLES)`), music markers (`♪`), dialogue dashes (`- `) — so dictation/cloze mark correct answers wrong, the panel shows unlearnable rows, and there is no way to fix it beyond one all-or-nothing bracket toggle. Separately, real-world subtitle timing drifts from speech (speech onset ~500ms *before* cue start), so every cue-boundary replay clips the leading word(s) — the learner hears "you known" instead of "don't you known". | User statement: input `-OWNER: Let the man breathe! -(CHUCKLES)` → user hears only "let the man breathe"; user statement: cue 2 "don't you known" replays as "you known" (~500ms lead drift); practice engine tokenizes raw `cue.targetText` (`src/features/studyModes/lib/subtitlePractice.ts:219`, evaluate at `SubtitlePractice.tsx:105`); all cue-boundary seeks land at `cue.start - offsetMs + 80ms` (`seekToCue`, `src/shared/lib/dom/netflixPlayback.ts:85-88`; chain seeks `studyModePlaybackController.ts:285,298,346`; practice replay `reactSubtitleController.ts:417-420`) | high |
| Change | One boolean (`advanced.removeBracketed`, overlay-only) → a rule set: built-in rules for common unspoken annotation classes + user-defined regex rules, each individually toggleable, applied to the target subtitle on every learning surface; plus a system rule that textless cues never render. Plus a persisted lead-in (ms) in Advanced that shifts every study-mode cue-boundary replay/seek target earlier so speech onset is included. | `removeBracketed` only reaches `SubtitleBlock` (`src/features/subtitle/ui/reactSubtitleController.ts:583` → `SubtitleBlock.tsx:118-123`); panel `visibleCues`/`practiceCues` filter on raw text (`src/features/subtitle/ui/SubtitlePanel.tsx:118-125`); every replay/seek-back emits `seek` to raw `cue.start` (`studyModePlaybackController.ts:177,285,298,346,371`; practice `reactSubtitleController.ts:407-430`) | high |
| Solution | Direction: a persisted ordered list of cleanup rules (built-in + custom regex, enable/disable, add/edit/delete) evaluated by one pure function over target text wherever the cue is a learning surface; cues whose rendered text collapses to empty are dropped from display. Plus `advanced.cueLeadInMs` (or equivalent) subtracted from the cue-start seek target on study-driven seeks, clamped ≥0, adjustable in Advanced. | Existing seam: `removeBracketedText` pure fn (`src/features/subtitle/logic/removeBracketed.ts:6`) proves the pattern; settings already persist + relay via `STORAGE_KEYS.STUDY_MODES`; `cueStartMs()` is a single SSOT for chain seeks (`studyModePlaybackController.ts:392-394`); `SubtitleStudyModeController` already marks internal seeks (`subtitleStudyModeController.ts:139-145`) | medium |
| Value | Practice scoring reflects what is actually said; panel only shows learnable lines; user adapts to any subtitle source's annotation conventions without waiting for a code change. | User explicitly asked for rule CRUD ("thêm sửa xóa update các quy tắc") and default edge-case coverage ("note âm nhạc và các edgecase tương tự") | high |
| Stakeholder | Language learners using dictation/cloze/listening modes on real-world subtitles (SDH/HI captions, fansubs, karaoke subs). | Practice surface exists in panel for all video sources (`docs/2-architechture-system.md:52`) | high |
| Context | Chrome MV3 extension; cues flow content-script → side panel/overlay; another agent holds uncommitted work in `CueList.tsx`, `reactSubtitleController.ts`, `contentScriptController.ts` (subtitle-bulk-status) — design must not require edits to those files. | `git status` this session; pipeline-state ownership rules in `AGENTS.md` | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Extension maintainers (solo maintainer + agents) | One pure cleanup function as SSOT; no per-surface forks of the logic | Pure-function precedent exists (`removeBracketed.ts`); must coexist with in-flight subtitle work — solution routes around dirty files |
| Customer | Learner (5–80y, any device) toggling rules and writing regex | Rules understandable by name/description; safe defaults on; a bad regex must not break playback | Regex is expert-facing — UI needs name+description so non-regex users still benefit from toggles |
| Supplier/Dependency | Subtitle sources (SDH captions, fansubs, YouTube CC, local .srt/.vtt/.ass) | Annotation conventions vary per source — rules must be per-rule toggleable, not a global mode | Parser already strips HTML/tags upstream (`parser-tolerance-skip-noise-lines` learning) |
| Organization | Future contributors | Rule list is data, not code — new built-ins are catalog entries | `docs/2-architechture-system.md` must be updated on ship |
| Regulator | Chrome Web Store policy | none — no new permissions, no network, no eval of remote code | User regex runs locally via `RegExp` constructor — no CSP issue (no `eval`) |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Practice (dictation/cloze) must score and blank only spoken text — unspoken annotations never become expected tokens or blanks | F | `collectTokenSpans(cue.targetText)` feeds both exercise types raw (`subtitlePractice.ts:219`); user report | high |
| N2 | The target subtitle shown in the overlay and the panel list must show the same cleaned text the learner is tested on | F | Overlay cleans (`SubtitleBlock.tsx:118-123`); panel renders raw (`SubtitlePanel.tsx:278`, CueList) | high |
| N3 | A cue whose rendered text is empty must not occupy a row in the panel nor render in the overlay — regardless of *why* it is empty (cleanup rules or source) | F | User clarification: "rule hệ thống độc lập, không liên quan regex"; today `visibleCues` only drops both-empty raw cues (`SubtitlePanel.tsx:118-119`), `practiceCues` keeps raw-target-nonempty (`:123`), and `(MUSIC)` actually tokenizes to `["MUSIC"]` → a 1-blank exercise whose answer is an unspoken word — worse than a ghost row | high |
| N4 | Users can enable/disable each cleanup rule independently, and add/edit/delete their own rules identified by name + description + regex | F, U | User statement verbatim | high |
| N5 | Common unspoken-annotation classes are covered out of the box (bracketed SDH, speaker labels, music/song markers, dialogue dashes, similar edge cases) so most users never write regex | F, U | User statement ("tìm ra các edgecase khác như note âm nhạc"); prior art exists in `sanitizeTtsText` glyph catalog (`src/entrypoints/background/handlers/ttsFetchAudio.ts:72`) | medium |
| N6 | An invalid or pathological user regex must not crash playback or freeze the panel | R, S | `[assumption]` — user-supplied regex is a trust boundary; catastrophic backtracking would stall every render | medium |
| N7 | The existing `removeBracketed` preference must carry over — a user who had it on keeps equivalent behavior after upgrade | R | `migrateStudyModeState` sanitizes `advanced` (`migrateStudyModeState.ts:59-72`) — trap: `version < CURRENT_VERSION → INITIAL_STUDY_MODE_STATE` (:91-93) wipes activeModeId+customModes, so migration must stay at v1 and fold the legacy bool into the rules field | high |
| N8 | Every surface that consumes cue text as learning material — including ones living in files owned by other in-flight work (overlay tokenize binding, playback empty-skip, card creation, comprehension score) — must see the same cleaned text, which means cleaning target-cue arrays **upstream of the cue engine** (the engine holds the shared objects every consumer reads; `useCuesStore.setCues` is only a downstream leaf) | F, S | Audit findings: tokenize controller rebuilds the overlay line DOM from `targetCues[i].text` (`subtitleTokenizeController.ts:151,237-246`) and would re-insert raw text over a cleaned render; `enterCue` skips only raw-empty cues (`studyModePlaybackController.ts:162`) → a cleaned-empty cue reaches `pausedEnd`/`waiting` while practice shows no active cue and every nav control is disabled — soft-lock. Spec review confirmed all `loadCues`/`loadBilingualCues` call sites sit in clean files (`contentScriptMessages`, `contentScriptFileImport`, `contentScriptSelection`, `contentScriptLifecycle`, `subtitleAutoLoad`) | high |
| N9 | Replaying a cue during practice takes one key (Ctrl), matching muscle memory from Language-Reactor-style players | U | User statement; current handler `SubtitlePractice.tsx:183-188`; legend `:244` | medium — "chế độ repeat" read as the practice session context (dictation/cloze presets pause+wait on the cue, i.e. the repeat workflow) |
| N10 | The practice answer input uses the full row width on wide panels | U | User statement; width cap `SubtitlePractice.module.css:199-201` | high |
| N11 | Study-mode cue-boundary seeks (chain repeat, step seek-back, practice replay/prev/next, Ctrl replay) must land early enough to include speech onset — a configurable lead-in (ms) subtracted from the cue-start seek target, adjustable in Study Modes → Advanced | F, U | User statement: ~500ms drift means replayed cue 2 drops "don't" ("tôi chỉ nghe được you known"); `seekToCue` lands at `cue.start - offsetMs + 80ms` (`netflixPlayback.ts:85-88`); every study seek emits raw `cue.start` — chain `studyModePlaybackController.ts:285,298,346` via `cueStartMs()` :392; skip/JUMP `:177,371`; practice handlers set `video.currentTime` directly (`reactSubtitleController.ts:407-430` — dirty file) | high |

## Scope

- **In:**
  - Rule-management UI inside Study Modes → Advanced, replacing the single brackets checkbox: list of rules with per-rule enable toggle; add/edit/delete for custom rules (fields: name, description, regex pattern); built-in rules toggleable but not deletable.
  - Built-in rule catalog covering: bracketed annotations `()[]{}`, leading speaker labels (`OWNER:`/`MAN 1:`), music/song markers (`♪…♪`, `♫`, `♬`, `𝄞` + wrapped lyrics), leading dialogue dashes (`- `/`– `), and comparable unspoken-annotation edge cases identified in SPECIFY.
  - One pure SSOT function applying the enabled rule set to target-subtitle text, invoked **upstream of the cue engine** — at every clean-file boundary where target-cue arrays are handed toward the engine (post-parse in `subtitleAutoLoad`, `contentScriptFileImport`, `contentScriptSelection`, `contentScriptLifecycle`/OCR, `contentScriptMessages` adapters): each cue becomes `{ ...cue, rawText, text: cleaned }` so a rule change can re-derive without refetch (in-place `text` rewrite reaches every shared-ref consumer: engine, tokenize, playback cue list, `latestTargetCues`, card text). Every downstream consumer — overlay (`SubtitleBlock`), panel rows (`CueList`), practice (dictation evaluation/progress + cloze generation), overlay tokenize binding, playback empty-skip, card text, comprehension score — then sees cleaned text uniformly, including consumers inside files owned by other in-flight work.
  - System rule: cues whose rendered target+native text are both empty are excluded from the panel list; practice additionally excludes cues whose cleaned target is empty; overlay renders an empty cleaned cue as no cue (no background); the playback state machine treats it as a non-cue (no pause/wait wedge).
  - Persistence + migration of `StudyModeAdvancedSettings` at **unchanged schema version** (`removeBracketed` boolean folds into the brackets rule's enabled state; the field stays on the type, derived, for backward compat of in-flight call sites like `reactSubtitleController.ts:583`).
  - Practice polish: remove the `60ch` cap on `.answerInput` at ≥768px; Ctrl alone replays the active cue inside the practice session (Ctrl+R preserved); shortcut legend updated.
  - Cue lead-in: `advanced.cueLeadInMs` (persisted, 0–2000ms, default 0) shown in Study Modes → Advanced; every study-mode seek that targets "the start of a cue" (chain repeat/loop/step seek-back, skip/JUMP, practice replay & prev/next buttons, Ctrl replay) lands at `cue.start − leadIn` (clamped ≥0). Applied at emission boundaries in clean files: `cueStartMs()`/skip/JUMP emits in the playback controller, and `SubtitlePanel`'s cue-seek emissions (onSeek wrap + shifted cue arg through the injected replay/nav seam — prev/next resolve their target cue in-panel so the dirty controller's `findIndex` anchor is never shifted). A lead-in landing inside an earlier cue's window must not arm that cue's study chain — the intended cue arms when playback reaches it (seek-intent marking in clean files only). Lead-in applies whether or not any cleanup rule is enabled — independent concerns sharing Advanced.
- **Out:** cleaning the *native* track beyond today's overlay behavior (native keeps whatever it gets today — the bracket strip in `SubtitleBlock` continues to apply to the native line for parity); changes to TTS sanitization (`sanitizeTtsText` stays its own layer); Anki card text pipeline; editable-regex flags UI (flags fixed per rule); non-study cue navigation (cue-list row click, `a`/`d` prev/next, `s` replay-cue shortcut, overlay repeat button) keeps landing at cue.start — lead-in is a study-mode concern; auto-detecting per-source subtitle drift.
- **Non-goals:** not a subtitle *parser* change (rules run post-parse on cue text); not a global "skip non-dialogue" playback feature (hidden ≠ skipped — playback timing is untouched); not an NLP/heuristic annotation detector — rules are literal regexes the user can inspect; not a subtitle *sync/offset* feature — lead-in shifts only study-driven seek targets, display timing (`offsetMs`, ADR-019) is untouched.

## Workflow

The learner watches with dictation mode on. The player pauses at each cue end; the learner types what they heard. Behind the scenes, every cue's target text passes through the enabled cleanup rules before it becomes an exercise, a panel row, or an overlay line — one function, one rule list, three surfaces. When the learner opens Study Modes → Advanced, they see the rule group instead of the old checkbox: built-ins already on, each with a plain-language name and a one-line description. They toggle a rule off → the change persists and the next render of every surface reflects it. They hit "add rule", type a name, a description, and a regex → the rule joins the list, applied in order after the built-ins, deletable and editable. A cue like `♪ Theme music ♪` or `(APPLAUSE)` collapses to nothing → it simply does not exist in the panel list, the practice rotation, or the overlay. During practice the learner taps Ctrl → the cue replays (Ctrl+R still works); the answer field spans the full footer row. Because their source runs ~500ms early, they set the Advanced lead-in — now every replay, repeat loop, and step seek-back lands a beat before the cue boundary, so "don't you known" comes through whole instead of clipped to "you known".

## Journey

### AS-IS

1. Learner enables Advanced → ticks "Remove text in brackets…" — one switch, all-or-nothing, and it only reaches the video overlay.
2. In dictation, the cue `-OWNER: Let the man breathe! -(CHUCKLES)` pauses; the learner hears "let the man breathe", types it, and is scored against `owner let the man breathe chuckles` — marked missing/incorrect through no fault of their own.
3. The panel row and cloze blanks show the same raw text; a `(MUSIC)`-only cue survives `practiceCues`' raw-text filter and becomes a 1-blank exercise whose answer is an unspoken word (or a disabled input when nothing tokenizes at all).
4. The learner wants speaker labels gone too — there is no setting for it; they file a feature request.
5. To rehear the cue they must chord Ctrl+R inside a narrow input capped at 60ch on wide panels.
6. Their subtitle source runs ~500ms early, so every replay of cue 2 lands after speech onset — they hear "you known", never "don't you known", and no setting can fix it.

### TO-BE

1. Learner opens Advanced → "Subtitle cleanup" group lists built-in rules (brackets, speaker labels, music markers, dialogue dashes, …) each toggleable, plus any custom rules they added with name/description/regex.
2. The same cue renders `Let the man breathe!` on the overlay and in the panel; dictation scores against exactly the spoken words; cloze never blanks `CHUCKLES` or `OWNER`.
3. Cues that clean down to nothing never appear — no ghost rows, no exercises built on unspoken answers, no empty overlay box — and a pause-based mode glides over them instead of wedging on a hidden cue with all controls disabled.
4. The learner adds a rule for their fansub's `-name-` convention, toggles off the dash rule for a source where dashes are real dialogue, and the setup survives reload.
5. They tap Ctrl to rehear the line — the replay now starts a configurable lead-in before the cue boundary, so the first word is no longer clipped — and type into a full-width answer field.
6. They set lead-in to ~500ms in Advanced; replay of cue 2 now lands before speech onset and the full "don't you known" is audible — on a well-synced source they set it back to 0 and replay lands exactly on the cue.

## Stories

- S1: As a learner in dictation/cloze, I want exercises built from spoken text only, so that my score reflects listening skill — done when no enabled-rule-matched span ever appears as an expected token, blank, or feedback diff.
- S2: As a learner, I want every surface (overlay, panel, practice) to show the same cleaned target text — done when a cue renders identically transformed in all three.
- S3: As a learner, I want textless cues to disappear from the list entirely — done when a cue with empty rendered text produces no panel row, no practice step, no overlay box.
- S4: As a learner with unusual subtitle sources, I want to add my own removal rules with a name, description, and regex, and toggle or delete them later — done when a custom rule persists across reload and applies in rule order.
- S5: As a learner, I want sane defaults covering common annotation conventions — done when a fresh install cleans SDH brackets, speaker labels, music markers, and dialogue dashes with zero setup.
- S6: As a learner replaying lines, I want a single-key replay and a full-width input — done when tapping Ctrl replays the active cue and the input is not width-capped on wide panels.
- S7: As a learner with early-running subtitles, I want a configurable lead-in so replays include speech onset — done when a persisted ms value in Advanced shifts every study-mode cue-boundary seek earlier and 0 restores today's landing.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| User regex with catastrophic backtracking stalls every cue render (no regex timeout in JS) | external/hidden | panel freeze, needs reload | Medium — mitigate: validate on save, per-rule try/catch at apply, cap rule count/text length, document; full ReDoS prevention impossible without a dep (RE2) — flag as accepted ceiling |
| Over-aggressive built-in rule eats real dialogue (e.g. dash rule on "- item one - item two" lists, speaker label on "NOTE:" prose) | operational | silent text loss — worst failure mode for a learning tool | Good — defaults ship conservative; every rule toggleable; per-rule descriptions make behavior inspectable |
| Migration edge: `removeBracketed=true` users must keep behavior; legacy call sites still read the field (`reactSubtitleController.ts:583` — dirty file owned elsewhere) | internal | typecheck break or silent behavior change | Good — keep `removeBracketed` as a derived field in the type; migration writes it from the brackets rule |
| Overlap with in-flight `subtitle-bulk-status` work (dirty `CueList.tsx`, `reactSubtitleController.ts`, `contentScriptController.ts`, `subtitleTokenizeController.ts`) | operational | merge conflict / touching another agent's files | Good — cleaning at the `cuesStore.setCues` boundary makes dirty consumers read cleaned text through the same fields they already read; zero edits to dirty files |
| Schema bump to v2 silently wipes `activeModeId` + all `customModes` (`migrateStudyModeState.ts:91-93` resets on `version < CURRENT`) | internal | data loss of user-created study modes | Good — stay at v1; `sanitizeAdvanced` tolerates missing fields; derive `removeBracketed` from the brackets rule |
| Overlay tokenize re-inserts raw text or mis-binds spans if render text and tokenize text diverge | internal | raw annotations resurfacing exactly on the most interactive surface | Good — same boundary fix; `bound.originalText === cue.text` compares cleaned-to-cleaned |
| Side panel holds its own cue copy (message-fed) — rule changes must propagate there too | internal | panel/overlay disagree after a toggle | Good — broadcast stays raw; each context re-derives at its own intake via the same SSOT helper + storage listener |
| Ctrl-only replay fires when user chords Ctrl+C/V inside the input | human | accidental seek during typing | Good — fire on Ctrl keyup only when no other key was pressed while held; Ctrl+R path unchanged |
| "Repeat mode" interpretation wrong (N9) — user may mean a specific study-mode preset | human | shortcut lands in the wrong context | Medium — conservative read covers dictation+cloze practice; revisit at design approval gate |
| Lead-in seek lands inside the *previous* cue's window while the state machine is idle → engine reports prev cue active → `enterCue` fires on the wrong cue (`subtitleStudyModeController.ts:118-126` re-enters whenever `!hasActiveCue`) | internal | replaying cue 2 could arm cue 1's chain — wrong pause/scoring context | Good — `internalSeekTargetMs` already distinguishes self-issued seeks (:89-100); suppress `enterCue` until the seek's target cue becomes active, or clamp lead-in to the prev cue boundary — decide in SPECIFY |
| Practice replay/prev/next seeks live in dirty `reactSubtitleController.ts` (`handleReplayCue` :417-430) | operational | can't inject lead-in at the seek call site without touching another agent's file | Good — pass lead-in through the prop chain at a clean level (`SubtitlePanel`/`SubtitlePractice` adjust the cue-start they hand to `onReplayCue`/`onPreviousCue`/`onContinueCue`, or the store value is read at the panel boundary); decide in SPECIFY |
| Lead-in > 0 on a well-synced source replays the tail of the previous line | human | mild annoyance; also `enterCue` wedge risk above | Good — 0 restores exact current behavior; default value decided at design gate (user's observed drift ~500ms argues for an editable field, not a fixed constant) |

## Decision

go — the pain is real and evidenced in code (practice scores raw text, panel shows raw text, one overlay-only toggle); the fix is a bounded data-driven rule list on an existing seam, routable around the in-flight work.

## Draft Acceptance Criteria

- [ ] `-OWNER: Let the man breathe! -(CHUCKLES)` renders/scores as `Let the man breathe!` in overlay, panel, dictation, and cloze with default rules on.
- [ ] A cue that is only `♪…♪` or `(APPLAUSE)` produces no panel row, no practice cue, no overlay box.
- [ ] Each rule toggles independently; custom rules persist across reload with name/description/regex; built-ins cannot be deleted.
- [ ] A saved-invalid regex is rejected at input; a runtime-throwing regex cannot crash the render path.
- [ ] Existing `removeBracketed=true` users keep equivalent behavior after upgrade.
- [ ] Ctrl tap replays the active practice cue; Ctrl+C/V inside the input does not; Ctrl+R still works.
- [ ] `.answerInput` has no `60ch` cap at ≥768px container width.
- [ ] Study Modes → Advanced exposes a lead-in control (ms); value persists across reload; 0 = current landing behavior.
- [ ] With lead-in = L, every study-mode cue-boundary seek (chain repeat, step seek-back, skip/JUMP, practice replay/prev/next, Ctrl replay) targets `cue.start − L` (clamped ≥0) — never a later position than today; cue-list row clicks and non-study shortcuts land exactly at `cue.start` as before.
- [ ] A replay whose lead-in crosses into the previous cue's window does not arm the previous cue's study-mode chain — the intended cue arms when playback reaches it.
