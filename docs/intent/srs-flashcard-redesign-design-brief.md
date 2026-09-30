# Design brief: srs-flashcard-redesign

Design authority: 4 user-supplied reference screenshots (Migaku-style SRS review). Clone structure 1:1; all colors/spacing/radii from `tokens.json` — no hardcoded hex.

## Layout

Stage = full-viewport ``core.dark.background``, `position: relative`. Card centered (`margin: auto`), `max-width: 30rem`, `min-height: 60vh`, `background: `core.dark.surface``, `radius: `static.radius.card``, `box-shadow: `static.shadow.md``, `padding: `static.spacing.6`.`

### Chrome (fixed corners, circular `Button` `variant="ghost"` on ``derived.dark.color-surface-elevated`` fill)

- top-left: close — icon: `x` — ends session.
- top-center: 3 step dots — icons: `volumeHigh` (sound), `bookOpen` (meaning), `pencil` (spelling); active gets ``derived.dark.color-primary-subtle`` fill + ``core.dark.primary`` icon.
- top-right: `{dueNow} new` — `Text` ``static.font.sizes.sm`,` ``core.dark.textSecondary``.
- bottom-left: `repeat` (study again), `layers` (manage view).
- bottom-right: `trash` (delete card, confirm), `pencil` (edit card).
- bottom-center: ✗ `x` forget on ``derived.dark.color-surface-elevated``; ✓ `check` remember on existing warning→error gradient (``core.dark.warning`` → ``core.dark.error``), size ``static.spacing.14`` circles, gap ``static.spacing.4`.`

### Card front

- "New" pill: `Badge`-style span, ``core.dark.success`` bg / ``derived.dark.color-on-success`` text, `radius-full`, `font-size-xs`, positioned `absolute; top: 0; translateY(-50%)` on card.
- Word: `Heading` ``static.font.sizes.3xl`` bold, centered.
- Sentence: ``static.font.sizes.xl`,` target phrase `<strong>`.
- Translation (when the stimulus carries it): ``core.dark.textSecondary`` ``static.font.sizes.md`.`
- Spelling input unchanged (`InputField`), centered, `max-width: 20rem`.
- Card body click flips to back; ✓ on front also flips; ✗ on front submits `forget`.

### Card back (inside card, top→bottom)

`Heading` word → sentence (bold target) → audio row (two ``derived.dark.color-primary-subtle`` circle buttons, icons `audioWave` + `volumeHigh`) → "See translation" `Button variant="secondary" size="sm"` uppercase ``static.font.tracking.widest``, swaps to translation `Text` on reveal → `Separator` → definition block (left-aligned: `targetWord (ipa) ★` ``static.font.sizes.sm`` bold row + gloss ``static.font.sizes.sm`)` → image `radius-lg` full-width → notes block ``derived.dark.color-primary-subtle`` bg, `radius-lg`, centered, "NOTES" caption ``static.font.sizes.xs`` ``static.font.tracking.widest`` uppercase.

### Edit card panel

Same centered card shell, scrollable (`max-height: 90vh`, `overflow-y: auto`), narrower `max-width: 26rem`:

- Header row: `settings` icon left, "Edit card" `Heading` centered, `wrench` icon right.
- Two `Select`s side by side: Card type (current notetype, disabled) / Deck (all collection decks).
- Preview: word + sentence centered.
- Field rows: `Label` left + action link right; `Textarea` for text/translation/context/list; audio row = play `Button` + source `Text` + Add/Remove; image row = `Thumbnail`-like img + Add/Remove.
- `DELETE CARD` — `Button variant="destructive" fullWidth`.
- Reset component / Reset card — `Button variant="ghost"` destructive-confirm rows.
- Footer meta `Text` ``static.font.sizes.xs`` ``core.dark.textSecondary`` centered: Created / Last pos / Last fail.
- Sticky bottom bar: Save `Button variant="primary"` + Cancel `ghost`.

## Motion

None beyond existing — card content swaps front↔back instantly (reference shows no transition).

## a11y

- Step dots `role="list"` + `aria-current="step"`; all icon buttons keep `aria-label` i18n keys.
- Card body flip: `role="button"`, `tabIndex=0`, Enter/Space flips.
- Edit panel traps focus (entrypoint page, not shadow DOM — standard focus management).
