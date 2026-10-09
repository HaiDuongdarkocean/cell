# Design review — word-status-flags

Inputs: `docs/intent/word-status-flags-design-brief.md`, `docs/intent/word-status-flags-component-mapping.md`, mockup `src/entrypoints/mockup-word-status-flags/`.

## Evidence

- `node scripts/check-design-brief.mjs word-status-flags` → `design brief ok — 17 tokens, 1 components, 0 icons`, VERDICT: PASS.
- Mockup mounts the real `CandidateView` (`Real` variant) via showcase mock infra (`installMockChrome`, `installMockDictionarySendMessage`, `getMockLookupResult`); concepts compose real `StatusRow`/`StatusPill` + shared `Button`/`Icon`/`Menu` + production CSS-module classes — no hand-drawn replica of shipped UI.
- `StatusRow`/`StatusPill` extracted from `CandidateView` as pure refactor; 22/22 CandidateView tests pass.
- Screenshots (Chromium, dark + light): `tmp/word-status-flags/concept-real-dark.png`, `concept-a-dark.png`, `concept-a-light.png`, `concept-b-dark.png`, `concept-c-dark.png`, `concept-c-light.png`.
- Interactive states verified in DOM + pixels: pill 3-cycle, tracking toggle, SRS button ghost/fill/disabled, gradient capsules.

## User feedback incorporated

| Feedback | Resolution |
|---|---|
| Baseline mockup was a `.mk*` replica, not the real popup — invalid comparison | Rebuilt: `Real` mounts production `CandidateView`; concepts reuse extracted `StatusRow`/`StatusPill` + shared components; pipeline rule hardened in `pipeline-design` skill (no replicas — hard rule). |
| Gradient must be continuous `flag → unknown` | Fixed in all concepts; verified on screenshots (tracking = orange→red, learning = green→red). |
| Gradient rendered as one solid color | Root cause: production rules ship `html body … !important`; mockup overrides lacked specificity. Fixed with `html body` prefix + extra class — lesson recorded in design brief. |
| Missing SRS icon button design | Added state-aware SRS button (ghost → create card / learning fill → view card / disabled when base ≠ unknown) in `cellHeaderActions` of every concept. |

## Approved decision

User approved **Concept B control + Concept A capsule**:

- Popup: segmented status control `[base | flag]` — left segment cycles `unknown → known → ignore`; right flag segment shows/toggles tracking (eye, clickable = key-4 semantics) or shows learning (layers, read-only).
- Tokens: smooth gradient capsule `flag → unknown` on tracking/learning; i+1 gap word keeps the frequency band pill.
- SRS icon button in header actions is the only learning source (create card → `unknown+learning`; remove card → `unknown`).

## Assessment

Covers all REQs: 3-base pill cycle, tracking flag toggle, learning via SRS only, i+1 = exactly one unknown-family gap, frequency emphasis on the gap, flag→unknown gradients on both token CSS builders. All elements map to existing shared components/tokens; new pieces are in-place composition in `StatusRow` + one `SrsButton`.

VERDICT: PASS

Approved by user (concept B control + A capsule).
