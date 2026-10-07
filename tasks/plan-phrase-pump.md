# Plan — phrase-pump (deliver)

> Spec: `docs/specs/phrase-pump.md` · Design: `docs/intent/phrase-pump-design-brief.md` + `phrase-pump-component-mapping.md`

## Slices

1. **Deep link + view wiring** — additive `view?: string` on `SrsOpenStudyPagePayload` + schema; handler appends `?view=`; `srs-study/App.tsx` gains `location.search` init + `'pump'` view in union.
2. **Types + pure logic** — `features/phrasePump/types.ts` (`PumpItem`, `PumpConfig`); `logic/pumpFields.ts` (sentence/sentAudio/target field detection on note+notetype: canonical ids → `frontTemplates[].stimulusType==='sentence'` → role→id mapping); `logic/sessionBuilder.ts` (filter → dedupe normalized sentence (SRS wins) → sort SRS `nextDue` asc → queue newest-first append → cap 200).
3. **Sources** — `services/pumpSources.ts`: `listPumpDecks()` (all collections → decks), `buildPumpSession({deckId|null, includeSubdecks, includeQueue})` — deck resolution mirrors `resolveDeckIds` (module-private → reimplemented minimal), due cards → notes+notetypes batched, audioUrl resolution (sentAudio asset bytes→objectURL via `getAudioAssetsByNote` + `audioAssetId`; raw `data:`/`https:` field passthrough), queue items via `listQueueRows` + batched `getQueueItem` (langCode + snapshot `audioItems[].url`).
4. **Player engine** — `services/pumpPlayer.ts` + `usePumpPlayer` hook: state machine idle/playing/paused/done; item driver: asset → `<audio>` (true pause), else `engine.speak` (pause=stop→resume restarts item); repeat×N, gap timer, shuffle remaining, skip prev/next, stop; post-stop settlements discarded (never counted); prefetch-1 resolves next audio during current play; skipped counter.
5. **UI** — `ui/PumpView.tsx` + module css per mapping (setup card / stage card / summary / empty); `SrsHome` pump action (`audioWave` icon); `PlaylistTab` pinned launcher ListItem above records conditional → `SRS_OPEN_STUDY_PAGE {view:'pump'}`.
6. **i18n** — `pump.*` keys en+vi.
7. **Tests** — sessionBuilder (dedupe/order/cap/queue merge), pumpFields (detection order incl. non-canonical notetype), pumpPlayer (fake engine + timers: repeat, gap, skip, stop-discard, prefetch call, asset vs tts pause semantics), 200-item build bench, App view init test if cheap.
8. **Gates + ship** — typecheck/lint/unit/build + deep-imports + feature-cycles; fresh-context verify → `docs/reviews/phrase-pump-verify.md`; delete mockup + shoot script; docs updates; transition shipped; backlog row.

## Risks / decisions locked

- Pump lives on extension page → direct repo imports allowed (SrsHome precedent); no new message types; `view` field additive on existing payload.
- `miningQueue` import edge is one-directional (it imports `generateId` from srs — phrasePump→miningQueue creates no cycle; verify via check-feature-cycles).
- TTS discard rule: after `engine.stop()`, pending `speak()` settlement is swallowed — player tracks a generation counter per item.
- No writes: pump never calls `putCard`/review writers; queue rows untouched.
