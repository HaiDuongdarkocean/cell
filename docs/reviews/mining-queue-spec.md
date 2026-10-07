# Spec review — `mining-queue`

Fresh-context spec-reviewer pass (BA/PO/TL lenses) on `docs/specs/mining-queue.md`, 2026-10-07.

Codebase verification: `popupTypes.ts:399` prefill carries everything needed (term/defs/sentence/media/`lookupResult`); `cardCreatorBridge.ts` `sendToCard`:123, `openStandaloneCardCreator`:268, `handlePopupQuickAdd`:682 ocean-srs fork; `CueList.tsx:444` actions slot exists; `panelTabs.ts` bar=4/tools=2 → adding tab with `mobileNav:'tools'` keeps ≤5 rail; `wordStatusClient`/cross-tab message-relay precedent confirms background-owned store is the right call; `sessionEventsTap.ts:95` fire-and-forget confirmed — queue correctly specifies stronger durability; `useSubmitNote`/`CardCreatorPanel.tsx:163` `onSubmitSuccess`/`onAfterSubmit` hook exists for remove-on-save.

## Findings (resolved in this pass)

- **Major 1** — silent scope cut: intent N4/S5/TO-BE-5 quick-add had no REQ → added REQ-5.
- **Major 2** — full snapshots in QUEUE_LIST would bloat payload vs <500ms target → lean row projection + QUEUE_GET full snapshot split.
- **Major 3** — cardify "marks/removes" had no carrier → `queueItemId` threaded through open context; deterministic remove via `onSubmitSuccess`/`onAfterSubmit`.
- Minor — badge wording vs deferred global badge: aligned (removed badge from REQ-7 actor list).
- Minor — REQ-9/SC-9 missing from traceability: added.
- Minor — "queue feature enabled" precondition referenced undefined toggle: dropped.
- Minor — strip rules now enumerate `audioBytes`/`audioBytesB64`, `video`/`initialMedia`/`cue` live refs, `MediaFile` blobs.
- Minor — naming disambiguation vs `CardCreatorQueueItem` noted in feature map.
- Minor — `videoId`/`sourceLabel` source stated (SubtitlePanel context / page title).
- Minor — optimistic confirmation stated explicitly in REQ-1.
- Minor — no alternatives section → added (IDB-vs-storage, DB reuse, naming).

Accepted risks recorded: media-URL expiry before cardify; `mobileNav:'tools'` discoverability.

## Applied fixes

- REQ-1: precondition "feature enabled" removed; step 3 states optimistic confirm + error toast on failure.
- REQ-2: source refs provenance stated (SubtitlePanel/CueList context, sourceLabel=page title/library name).
- REQ-3: lean row projection specified.
- REQ-4 (renumbered): cardify fetches full snapshot, threads `queueItemId`, deterministic remove on submit success.
- REQ-5 new: quick-add to configured sink without dialog (completes S5/TO-BE-5).
- REQ-6 discard (renumbered); REQ-7 propagation (badge actor removed); REQ-8 cap; REQ-9 i18n.
- Data: snapshot strip rules enumerated; projection split documented.
- Traceability: N7 restored, quick-add/discard/propagation/i18n rows added; SC-10 added.
- Alternatives considered section added.

VERDICT: APPROVE
