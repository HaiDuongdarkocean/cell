# Sign-off Review — subtitle-cleanup-rules

**VERDICT: SIGN_OFF**

## Scope verified

- Spec: `docs/specs/subtitle-cleanup-rules.md` (REQ-1..REQ-9 + NFRs)
- ADR: `docs/adr/105-subtitle-cleanup-rule-layering.md`
- Implementation: cleanup rule entity + runtime, intake seams (auto-load, file
  import, selection, lifecycle/OCR, messages adapters, local-player), study-mode
  controllers, panel/practice UI, message schema, migration.

## Fresh-context verify (subagent, adversarial)

Initial verdict FAIL with 3 blockers — all fixed and re-verified:

| # | Finding | Resolution |
|---|---------|------------|
| B1 | Cleaned-empty cue still rendered a colored overlay layer (`SubtitleBlock` gated on cue-object presence, not effective text) — REQ-4/SC-3 | `hasTargetCue`/`hasNativeCue` now gate on non-empty effective text (`SubtitleBlock.tsx:184-185`) |
| B2 | `recleanTargetText` shallow-copied stale cue objects — store diverged from engine on the 2nd+ reclean while paused — REQ-2/SC-2 | `recleanTargetText(clean)` re-derives `text` from `rawText` under active rules (`cuesStore.ts:89`, runtime passes the transform) |
| B3 | Side-panel `a/d/s` SHORTCUT_ACTION got lead-in + `cueSeq` intent marking — REQ-8/SC-13 ("a/d/s behave exactly as today") | Sender reverted to `seekTime: targetCue.start`; `cueSeq` dropped from SHORTCUT_ACTION schema/type/relay/handler |

Non-blocking items also resolved:

- **N1** Legacy `removeBracketedText` re-strip on the target line could diverge
  from cleaned text (orphan openers) → dropped; target text is already
  rule-cleaned. Native line keeps the legacy strip (native is never cleaned).
- **N2** Intent mechanism had no tests → added `markCueSeekIntent` suppression +
  stale-intent tests (`subtitleStudyModeController.test.ts`).
- **N3** `PlayerView.buildBilingualCues` dropped `rawTargetText` → propagated in
  both branches.
- **N5** Regex compiled per cue per rule → `resolveCleanupRules` now returns
  `ResolvedCleanupRule` with a precompiled `RegExp` (compiled once per resolved
  rule list, NFR-1).

Accepted as-is (documented, spec-sanctioned): N4 (OCR slot stores cleaned
array — raw preserved, egress re-clean is idempotent), N6 (250 ms intent
freshness window — soft-lock guard documented in ADR-105), N7 (`onSeek` fallback
can't carry `cueSeq` — unreachable in practice, same-context mark covers it),
N8 (continue-at-end seeks next raw cue — spec-sanctioned resume path).

## Deterministic gates

| Gate | Result |
|------|--------|
| `npm run lint` | pass |
| `npm run typecheck` | pass |
| `npm run test:unit` | 6687/6688 pass — sole failure is `migakuFixtures.test.ts`, an untracked in-flight test from another agent (network fixture timeout), unrelated to this change |
| `npm run build` | pass |
| Brief lint (`check-design-brief`) | pass |
| Real Chrome (`tmp/subtitle-cleanup-rules/verify.mjs`) | 19/19 pass after fixes, incl. strengthened empty-cue check asserting transparent background |

## Real-Chrome coverage

Music glyphs stripped, lyric text preserved, `♪ ♪` cue renders no text and no
background bar, no ♪ rows and no empty rows in the cue list, cloze free of
glyphs, rules UI (11 toggles + add + lead-in slider), built-in toggle
off→restore / on→strip, invalid regex rejected inline, custom rule
add→reclean→delete→restore.

## Note

- Paused-mid-cue overlay refresh after a rule toggle lands on the next
  cue-enter/timeupdate (spec-accepted tradeoff); panel/store update immediately
  via `recleanTargetText`.
