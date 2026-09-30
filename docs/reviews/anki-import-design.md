# Design review — anki-import

Inputs: `docs/intent/anki-import-design-brief.md`, `docs/intent/anki-import-component-mapping.md`, mockup `src/entrypoints/mockup-anki-import/`.

## Evidence

- `node scripts/check-design-brief.mjs anki-import` → `design brief ok — 16 tokens, 22 components, 0 icons`, VERDICT: PASS.
- Icon QC (`import` in ICON_CATALOG): all 92 icons pass.
- Mockup rendered via `npm run dev`, captured in Chrome (devtools MCP), light + dark + mobile:
  - `tmp/anki-import/mockup-source-fail-light.png` — source select + AnkiConnect prerequisite checklist.
  - `tmp/anki-import/mockup-scope-light.png` / `mockup-scope-dark.png` — deck/notetype picker, cloze row disabled, suspended badge.
  - `tmp/anki-import/mockup-mapping-light.png` — per-notetype field mapping + live front/back preview + sample nav.
  - `tmp/anki-import/mockup-mapping-mobile.png` — MobileSheet host at 375px.
- Entry-point placement verified in backdrop top bar: import icon sits immediately left of the settings gear.

## Vision-reader findings → resolution

| Finding | Severity | Resolution |
|---|---|---|
| Footer clipped / missing in mapping step | blocker | Viewport artifact (800px). Retaken at 1280×1100 — footer + summary visible. |
| Cloze disabled row not visible | major | Same viewport artifact — visible in retake with `không hỗ trợ` badge. |
| Preview card labelled "mặt trước" while showing back | major | Fixed — added explicit "Mặt trước" / "Mặt sau" labels. |
| `Badge` warning variant white-on-amber in dark theme (low contrast) | major | Real component defect — `Badge.module.css` now uses `--color-on-warning` instead of `--color-text-primary`. Dark = dark-on-amber, light unchanged (`#2A2A2B` ≈ text-primary). |
| Mobile step rail wraps | minor | Accepted — labels shrink; tracked for implementation polish. |
| "Thử lại" button placement, deck-name wrap ragged, tab size | minor | Accepted for mockup; implementation uses Tabs component + row layout from mapping doc. |

## Assessment

Wizard covers the confirmed journey: hybrid source entry → prerequisite roadmap on failure → deck/notetype scope with state counts → target language → per-notetype field mapping with live front/back preview → progress → report. All elements map to existing shared components and tokens; only new asset is the `import` icon. Both themes render solid surfaces; mobile uses the canonical MobileSheet.

VERDICT: PASS
