# Analyze-gate review: anki-import

> Artifact: `docs/intent/anki-import.md` · Mode: all · Reviewer: fresh-context
> subagent (read-only) · Date: 2026-09-30

## Gate checklist results

- [x] `## Journey` AS-IS + TO-BE, ≥3 steps each, TO-BE ends at value *(after fix 1)*
- [x] No need is a disguised solution/value *(after fixes 2)*
- [x] `ui_surface: yes` consistent with user-visible journey
- [x] Decision `go` supported by risk register (both High risks have mitigations)
- [x] Confidence tags honest (Value row downgraded to medium)
- [x] Every need cites evidence or `[assumption]` + confidence; business-level
- [x] Scope matches confirmed decisions in audit §6
- [x] Code claims verified: `types.ts:133`, `cardCreation.ts:52`,
  `selectNextReview.ts:106` (NO_TEMPLATE), `ankiConnectClient.ts`,
  `CARD_CREATOR_REQUEST` transport reusable, `sql.js` + `unzipit` deps present,
  ts-fsrs `State` ≡ Anki `type` enum, `ICON_CATALOG` lacks `import` icon,
  `SrsHome.tsx:208–215` top-bar placement real

## Findings (must-change, all applied)

1. TO-BE numbered list ended with an edge-case dump — moved to unnumbered
   paragraph so the journey literally ends at value.
2. N12 was a placement solution → reworded to discoverability need with the
   placement recorded as confirmed decision; N3 reworded as user-issued
   constraint + confirmed mechanisms.
3. N1 citation `audit §5` → corrected to §6.
4. zstd risk: verified `fflate@0.8.3` has zero zstd support — mitigation
   rewritten as the confirmed finding (new dep `fzstd`/`@bokuweb/zstd-wasm`
   or legacy-compat export fallback).

## Applied fixes

All four must-change items applied to the intent doc; audit doc nits also
fixed (unzipit note, zstd confirmation, `selectNextReview.ts:106` off-by-one,
winner-only NO_TEMPLATE phrasing, duplicate section numbering).

VERDICT: APPROVE_WITH_CHANGES
