# Spec Review — subtitle-cleanup-rules

**Artifact:** `docs/specs/subtitle-cleanup-rules.md` (v2.2 final)
**Intent:** `docs/intent/subtitle-cleanup-rules.md`
**Review mode:** fresh-context `spec-reviewer` subagent, 4 passes (BA/PO/TL lenses + adversarial code verification)

## Pass history

| Pass | Verdict | Outcome |
|---|---|---|
| v1 | REJECT | "One ingestion boundary" premise refuted — `useCuesStore.setCues` is a downstream leaf; the dirty `subtitleCueEngine` holds the parallel raw arrays that tokenize, `enterCue`, card text, and broadcast actually read. |
| v2 | REJECT | Architecture verified sound (clean upstream of engine at intake seams), but 6 localized defects: trailing-dash orphan broke SC-1; `sidePanelRelay` drops `cueSeq`; pending-intent lifecycle stalls chains; brackets parity overclaimed; seam enumeration incomplete; tokenize-staleness wording wrong; local-player unscoped. |
| v2.1 | REJECT | 1 blocker (OCR slot raw-vs-cleaned contradiction + unenumerated `selection.ts:207` egress), stale `cueIndex`/`pendingCueIndex` naming vs normative `cueSeq`, `SHORTCUT_ACTION` `seekTime` relay drop (pre-existing bug folded into fix), wrong residues, false cache shared-ref claim. |
| v2.2 | **APPROVE_WITH_CHANGES** | All rejection causes verified fixed; remaining items were clause-level edits — applied in this revision (see below). |

## Changes applied after the final pass

1. `:45` OCR destination list — clean once into a local covering every consumer in the block (`loadBilingualCues`, `latestTargetCues`, `mergeCuesForPanel`, `broadcastCues`); slot alone stays raw.
2. `bracket-orphans` — dropped the incorrect `(a]` divergence claim.
3. REQ-9 abort wording scoped to externally-marked seeks (internal seeks filtered by `internalSeekTargetMs` first).
4. `:48` — revived `subtitleSyncController` helpers must apply the same egress-clean rule.
5. Feature map + Boundaries rows now include `ShortcutActionPayloadSchema`/`ShortcutActionPayload` + `seekTime` fold; traceability N8 → SC-4 added.
6. Rule-application diagram post-pass line now shows the orphaned-separator strip.

## Architecture summary (verified end-to-end by reviewers)

- **Cleaning boundary:** `cleanTargetCues()` at every clean-file seam where a target `SrtCue[]` heads toward `loadCues`/`loadBilingualCues` — produces `{...cue, rawText, text}` objects that fan out as shared refs into engine, `latestTargetCues`, tokenize, playback, merge, broadcast. Zero edits to in-flight dirty files; every dirty-owned consumer is correct-by-construction.
- **Re-derivation:** WeakRef registry + in-place `text` rewrite on rule change; `useCuesStore.recleanTargetText()` for React (active indices preserved); `SubtitlePanel` re-derives display cues from `rawTargetText` (covers side-panel broadcast snapshots).
- **Lead-in:** `advanced.cueLeadInMs` subtracted once at each study-seek emission site (`cueStartMs`, skip/JUMP, `SubtitlePanel` practice emissions); `cueSeq` intent marking (seek action + SEEK_TO payload + `markCueSeekIntent`) with `pendingCueSeq` suppression in `SubtitleStudyModeController` — match-check unconditional per tick.
- **Migration:** schema stays v1; `brackets` seeded from legacy `removeBracketed`, other built-ins default-on; `removeBracketed` remains a derived field.

## Risks accepted (in spec)

ReDoS ceiling (caps + try/catch, no RE2 dep), tokenize prepared-token cache staleness until next cue load, feature-local i18n module (en/vi files dirty), prev/next routed through replay seam, `docs/2-architechture-system.md` update deferred (dirty-owned), fresh-install `removeBracketed=true` default change, catalog residues documented.

VERDICT: APPROVE_WITH_CHANGES
