# Verify Review — subtitle-cleanup-rules

VERDICT: PASS

Fresh-context adversarial verification of the implementation against
`docs/specs/subtitle-cleanup-rules.md` and ADR-105, performed by an independent
reviewer agent, then re-verified after fixes.

## Round 1 — FAIL → fixes applied

| # | Finding | Fix |
|---|---------|-----|
| B1 | `SubtitleBlock` rendered a colored layer for cleaned-empty cues (REQ-4/SC-3) | `hasTargetCue`/`hasNativeCue` gate on non-empty effective text |
| B2 | `recleanTargetText` copied stale objects; store diverged on 2nd+ reclean (REQ-2/SC-2) | `recleanTargetText(clean)` re-derives `text` from `rawText` |
| B3 | Side-panel `a/d/s` SHORTCUT_ACTION carried lead-in + `cueSeq` (REQ-8/SC-13) | Reverted to `seekTime: targetCue.start`; `cueSeq` removed from SHORTCUT_ACTION schema/type/relay/handler |
| N1 | Legacy bracket strip on target line could diverge from cleaned text | Target line uses cleaned `cue.text`; legacy strip kept for native only |
| N2 | No tests for the seek-intent mechanism | Added suppression + stale-intent tests |
| N3 | `PlayerView.buildBilingualCues` dropped `rawTargetText` | Propagated in both branches |
| N5 | Regex compiled per cue per rule (NFR-1) | `ResolvedCleanupRule` carries a precompiled `RegExp` |

## Conformance matrix (post-fix)

| REQ | Status |
|-----|--------|
| REQ-1 Manage rules (toggle/add/edit/delete/validate/persist) | ✅ |
| REQ-2 Clean at intake, `rawText` preserved, reversible reclean | ✅ |
| REQ-3 Same cleaned text on every surface | ✅ |
| REQ-4 Cleaned-empty cues hidden (panel, overlay, practice, playback) | ✅ |
| REQ-5 Built-in catalog (10 rules, spec order + patterns) | ✅ |
| REQ-6 Ctrl-tap replay (+Ctrl+R, no Ctrl+C/V replay) | ✅ |
| REQ-7 Full-width practice input (`60ch` cap removed) | ✅ |
| REQ-8 `cueLeadInMs` on study/practice seeks only; a/d/s + row clicks untouched | ✅ |
| REQ-9 `cueSeq` seek intent suppresses foreign-cue arming | ✅ |

## Evidence

- `npm run typecheck`, `npm run lint`, `npm run build` — pass.
- `npm run test:unit` — 6687/6688 pass; sole failure `migakuFixtures.test.ts`
  is an untracked network-fixture test owned by a different in-flight feature.
- Real Chrome verifier `tmp/subtitle-cleanup-rules/verify.mjs` — **19/19**
  including the strengthened check that a cleaned-empty cue renders neither
  text nor background bar (`bg: rgba(0,0,0,0)`).
