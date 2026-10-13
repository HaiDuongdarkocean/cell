# R7 findings — perf campaign

Phone context: LG V600, Quetta, ~40 open tabs, 7 dicts installed.

## Selected for implementation
- **F1** broadcast fan-out: `sendMessageToAllFramesInTab` pays
  getAllFrames + N×sendMessage per tab; plain tabs.sendMessage reaches
  all frames. ~160 IPCs → ~40 per broadcast. Files:
  shared/lib/chrome-apis/tabs.ts:45-64; callers dictionaryBroadcast.ts,
  wordStatus.ts broadcastToOtherTabs, srsCardsBroadcast.ts, sidePanelRelay.ts.
- **F4** `requestRemoteCheck` fires on read-only paths (LOOKUP_REQUEST,
  wordStatus marks) → sync check pass every ≥3s incl. mid-import; gate
  on active resource-import/delete job. handlers/lookup.ts:38,
  syncTriggers.ts:68-93.
- **F5** sentence wash: `onTokenEnter`/`washSentence` re-runs full
  layout pipeline per token even when sentenceKey unchanged;
  `watchPopupGeometry` installs document-wide subtree MutationObserver
  while wash pinned. webTokenizeController.ts:927-953,
  sentenceHighlight.ts:200-249,352-358.
- **F2** DICTIONARY_CHANGED re-resolve herd across all tabs at job-done
  (part of measured ~10s tail): gate invalidate/dictEpoch on
  document.visibilityState, defer to visibilitychange.
  dictionaryCrossTab.ts:31-33, subtitleTokenizeController.ts:171-174,
  CueList.tsx:377-383.

## Deferred (needs sync-connected phone to matter)
- **F3** contentHash/blob serialize all ~130k rows in SW twice per
  resource (serializeResourcePortable + readResourceBlob).
- **F6** sync-applied import/delete uses single unbounded txs in SW
  (dictLocalSource.ts:324-388) — pre-R6 stall lives on sync path.

## Dead ends verified (do not revisit)
- CueList current-cue linear findIndex — negligible.
- Lookup hot path already well-cached (lookupOrchestrator.ts:114-161).
- bindTokenBlock single-fragment, TokenizeScheduler rAF/idle buckets.
- VIDEO_TIME_UPDATE already 4Hz-gated + no-ops for non-panel tabs.
