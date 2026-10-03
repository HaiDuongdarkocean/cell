# Design Review — pos-dictionary-variants

Date: 2026-10-03 · Stage: design · Mode: interactive

## Artifacts

- Design brief: `docs/intent/pos-dictionary-variants-design-brief.md`
- Component mapping: `docs/intent/pos-dictionary-variants-component-mapping.md`
- Mockup: `src/entrypoints/mockup-pos-dictionary-variants/` — `http://localhost:5180/src/entrypoints/mockup-pos-dictionary-variants/index.html`
- Lint: `node scripts/check-design-brief.mjs pos-dictionary-variants` → PASS (22 tokens, components, icons validated)

## Concepts presented

| Concept | Archetype | Verdict |
|---|---|---|
| A · Chapter links | `adjective \| verb \| noun` text links pinned top, GoldenDict/Macmillan `.dict-top` style | **CHOSEN by user** |
| B · Variant tabs | segmented pill tabs under headword | rejected |
| C · Meta chip | `pos ⌄` chip + Menu with status dots/rank | rejected |

User also refined the accent label during review: lowercase `ame`/`bre`, muted `--color-text-secondary`, hover → `--color-text-primary` + underline — **not** primary link color (recorded in brief UX flow + mockup css updated to match).

## Evidence

Playwright screenshots in `tmp/pos-dictionary-variants/`:

- `a-present.png` — default: adjective selected, `ame /ˈprezənt/`, `unknown`, `COCA 1,334`
- `a-verb.png` — variant swap: verb → `/prɪˈzent/`, `learning`, `COCA 818`, inflections + verb senses
- `a-verb-bre.png` — accent toggle ame→bre
- `b-present.png`, `c-menu.png` — alternatives rendered (menu shows status dots + per-POS rank)
- `real-present.png` — production `PopupDictionary` mounts as baseline
- `a-final.png`, `a-light.png` — dark + light theme, token-consistent both ways

## Checks against requirements

- REQ-6 selector: top of popup, ≥2 variants only, `other` last (`well` demo), hidden for single variant (`serendipity` demo)
- REQ-7 accent: label before IPA, tap cycles, static when single accent, theme-native colors
- Theme: no new surface/material — links and chips sit on popup surface with existing tokens (user rejected screenshot's light background)
- Touch: 44px min-height on links and accent button; keyboard operable (buttons + aria-current/aria-selected)
- Component mapping: `PosVariantNav` is the only Create (feature-scope; `InkTabs`/`Breadcrumb`/`Link` can't express the archetype — justified); everything else reuses existing `CandidateView` pieces

VERDICT: PASS
