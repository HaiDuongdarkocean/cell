# Analyze review — message-validation-thread

Fresh-context audit (subagent_explore 5603fb5c) of `docs/intent/message-validation-thread.md` r0.

## Findings → applied fixes

1. **MISSING (high) — `UPDATE_SETTINGS.settings` `z.custom<Partial<Settings>>` merges wholesale into persisted settings** — worst blast radius in the class. → Added to in-scope table + AC4.
2. **MISSING (high) — iframe manager bridge postMessage casts** (`data.state as SerializedManagerState`, `action as ManagerAction`, `args.result/keys`) — same defect class on the postMessage channel. → Recorded in not-a-defect/accepted-risk table as explicit **follow-up item** (origin/source checks already shipped in debug-seam-hardening; S-scope stays runtime messages).
3. **MISSING (medium) — `LOOKUP_REQUEST` `z.custom<LookupRequest>`** object-check only → added to scope + AC5.
4. **MISLEADING — AC5 "unknown source defaults to YouTube"** — an unknown `source` string fails the enum at envelope level; only *absent* source defaults. → AC1 reworded.
5. **MISLEADING — value overclaimed as security fix** — shape validation blocks malformed input only; well-shaped hostile payloads still pass. → Business Case Value rewritten as crash-resistance/integrity hardening with the honest bound stated.
6. **WRONG-ish — "partial side effects" in AS-IS journey** — mappers run before any side-effectful call; a throw aborts cleanly. → Journey reworded.
7. **MISSING — defended sites worth naming** — `playerStateSignalSchema.payload` downstream narrowing, `ocrContentScript` postMessage gaps, `srs.ts:75` harmless cast, `contentScriptMessages` guards nuance → added to verified table.
8. **Note — threat asymmetry** — `DETECTED_SUBTITLES` page-JS-forgeable via postMessage relay; the other two are extension-internal (no `externally_connectable`). → Reachability column added; `handleMessage` tabId forcing credited.
9. **Note — source audit staleness** — audit #10's line cites drifted → noted in header.

VERDICT: APPROVE_WITH_CHANGES

## Post-review fix

- `## Journey` rewritten from prose paragraphs to >=3 enumerated steps per half (structural gate requirement; content unchanged).
