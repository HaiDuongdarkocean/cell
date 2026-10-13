# Intent — `i1-content-queue`

> Backlog #6 · Cost M · Value ★★★★★ · Source: migaku+lingq
> Pain: "Có score nhưng phải tự mò video vừa sức — cần 'xem gì tiếp' sort theo coverage gần band 95–98%"

## 8-field frame (autonomous — inferred from codebase, zero questions)

1. **Problem**: Local-player library has videos but no signal about which one is the best next watch. Comprehension score exists only for the *currently loaded* media (`mediaScoreSource`); the library list sorts by recent/title/added — nothing about learnability.
2. **User**: Immersion learner with a local video + subtitle collection in Tihoka's local player (`orca-local-player` IDB), wordStatus vocabulary built up over time.
3. **Current workflow**: Open local player → scan titles → guess which video is "vừa sức" → maybe watch and check the live comprehension chip → back out and try another. LingQ's equivalent pain: %known exists per lesson but sorting requires manual inspection.
4. **Pain**: Scores are computed but thrown away per-session; picking the next video is mò — i+1 content (stretch band, ~90–95% coverage) is the most valuable watch but indistinguishable in the list.
5. **Evidence**: `computeStats(tokens,'media')` already yields `coverage` + `band` (comfortable ≥95 / stretch 90–95 / hard <90); `matchSubtitlesForVideo` + `parseSubtitleFile` resolve each video's target subtitle; `fetchTermStatuses` batches status lookups ≤1000 terms; `ComprehensionBadge` renders coverage+band; `sortLibrary`/`SortBy` is an open comparator registry.
6. **Desired outcome**: Library gains a "Best fit (i+1)" sort — every video that has a scorable subtitle shows a coverage badge and sorts by distance to the i+1 sweet spot (95%); scores persist on `VideoRecord`, refresh in background on library open and on live word-status changes.
7. **Constraint**: Zero new deps; reuse `createTokenList`/`computeStats`/`fetchTermStatuses`/`matchSubtitlesForVideo`/`parseSubtitleFile`/`ComprehensionBadge`; no permission prompts in background (`verifyPermission` query-only — unscored videos show no badge, never a nag); scores are a cache — statuses are truth, recompute on change; fail-closed — empty status map aborts the run, never writes fake "all unknown" scores.
8. **Scope**: In — per-video coverage computed from the auto-matched *target* subtitle, persisted `VideoRecord.comprehension`, `'fit'` sort mode, badge on `LibraryCard`, debounced live recompute. Out — streaming-site libraries (no local mediaLibraryRepository there), manual per-video subtitle-track selection affecting the score, re-scoring while a video plays (the live badge already covers it), queue across devices/sync.
