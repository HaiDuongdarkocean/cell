# Design review — reading-annotation

VERDICT: PASS

Fresh-context `vision-reader` verified `tmp/reading-annotation/annot-{light,dark}.png` against the "Ruby cap" brief — zero deviations.

## Verified

- Caps render centered above their token at ~55% size, subordinate opacity, tone marks/diacritics legible (zh pinyin `xuéxí`/`Hànyǔ`/`yǒuyìsi`; en IPA `ˌɪntəˈnæʃnəl`/`əˈkaʊnt`).
- `很` (no reading) and the no-dictionary card render identically to today's tokens — degrade path clean.
- ON vs OFF cards are pixel-aligned on the main line — absolute-positioned cap adds zero layout shift (NFR-3 confirmed visually).
- No cap↔cap or cap↔card-label collisions on the fixtures; caps sit in the line gap as designed.
- Dark/light both correct; `color: inherit` keeps caps inside the token's frequency-pill color family.

## Accepted notes (design intent, not defects)

- Caps may overflow a narrow token's width symmetrically into inter-token whitespace — accepted furigana precedent; never widens the line.
- Wrapped token anchors the cap to its inline box (first fragment) — documented degradation.
- Caps may graze the line above on tightly-packed multi-line cues — mitigated by 55% size; production verify will re-check on a wrapped cue.

## Artifacts

- Brief: `docs/intent/reading-annotation-design-brief.md`
- Mapping: `docs/intent/reading-annotation-component-mapping.md` (linter PASS)
- Mockup: `src/entrypoints/mockup-reading-annotation/` + `tmp/reading-annotation/*.png`
