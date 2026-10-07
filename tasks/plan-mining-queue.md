# Plan — mining-queue

Spec: `docs/specs/mining-queue.md` · Design: `docs/intent/mining-queue-design-brief.md` + `component-mapping.md`
Mode: `all` · Owner: `devin-1-1791342575`

## Architecture decisions (from spec, confirmed against code)

- New isolated IDB `orca-mining-queue` v1, store `items` (keyPath `id`, indexes `by_dedupeKey`, `by_createdAt`). Own `openDB` in feature repository — baseRepository's getDB is lang-scoped (`orca-dict-{hash}-{lang}`), not reusable.
- Background-owned SSOT: handlers `QUEUE_ADD/LIST/GET/REMOVE` + broadcast `QUEUE_CHANGED` to all tabs (panels live in content scripts) AND `messageBus.broadcast` (extension pages like local-player).
- `MiningQueueItem` entity in `src/entities/miningQueue/` — shared type across content UI + background.
- Snapshot = `PopupCardCreatorPrefill` minus non-serializable/live fields (`video`, `initialMedia`, `cue`, `AudioItem.audioBytes`, `MediaFile` blobs). `lookupResult` persists (structured clone).
- Queue surface: `queue` tab, `mobileNav: 'tools'`, icon `layers`.
- Cardify: QueueTab → `controller.sendToCard(DictionaryPanelPrefill)` + module-level `pendingQueueItemId` in mountUniversalPanel; `onAfterSubmit` removes it on success.
- Quick-add (term rows): destination fork — `ocean-srs` → `addToOceanSrs` + remove on resolve; else `sendToCard` with `initialAction:'quick-add'` (CardCreatorPanel auto-submits when idle) → removal via same `onAfterSubmit` thread.
- Capture points: popup header `layers` button (threads `onSaveToQueue` alongside `onSendToCard`/`onQuickAdd`); CueList row `onSaveCue` prop → layers IconButton beside timestamp.

## Tasks

| # | Task | AC | Parallel? |
|---|------|----|-----------|
| T1 | `entities/miningQueue` types + `entities/message` QUEUE_* types/schemas/registry + `messages.ts` | SC-* base | no |
| T2 | `miningQueue/logic/queueLogic.ts` (dedupeKey, cap, stripSnapshot, builders, projection) + test | SC-5, SC-6 | after T1 |
| T3 | `services/miningQueueRepository.ts` (own DB) + `miningQueueClient.ts` + tests | SC-3, SC-5, SC-6 | after T1 |
| T4 | `background/handlers/miningQueue.ts` + register in `index.ts` | SC-3 | after T3 |
| T5 | `QueueTab` UI + css + panel wiring (types.ts 'queue', panelTabs entry, UniversalPanel pane, mountUniversalPanel queuePanel + cardify/quick-add/discard wiring, persistTab) | SC-4, SC-7, SC-8, SC-10 | after T3 |
| T6 | Popup save affordance (`useCandidate.saveToQueue` + CandidateView layers button + mountPopupDictionary/PopupDictionary/popupLifecycle/webTextDictionaryController thread) | SC-1 | after T3 |
| T7 | Cue save affordance (CueList `onSaveCue`, SubtitlePanel forward, SubtitlePanels wire + local-player if applicable) | SC-2 | after T3 |
| T8 | i18n en+vi keys | SC-9 | parallel w/ T5-T7 |
| T9 | Gates: typecheck/lint/unit/build + browser verify; arch docs + wiki | DoD | last |
| T10 | Delete `src/entrypoints/mockup-mining-queue/`; remove tmp shoot script | hygiene | at ship |

## Risks

- `onSaveToQueue` threads through 4 layers (mountPopupDictionary → PopupDictionary → CandidateView → useCandidate). Alternative rejected: context/global — explicit prop threading matches existing `onSendToCard`/`onQuickAdd` pattern.
- Sentence items have no term — cardify opens Dictionary prefill with `term` absent; CardCreatorPanel quick-add guard already handles termless contexts (won't auto-submit).
- QUEUE_CHANGED broadcast to all tabs: fire-and-forget, harmless when no listener.
