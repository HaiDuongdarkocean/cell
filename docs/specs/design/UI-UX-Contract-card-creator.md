# UI-UX-Contract — Card Creator Redesign

> **AI Agent Task Contract**. Implementer MUST follow this contract verbatim for Card Creator layout.
> **Reference image**: `docs/mockups/popup-dictionary/reference-card-creator.png` (the right panel of the two-pane workspace).
> **Parent spec**: `docs/specs/design/UI-UX-Contract-popup-dictionary.md` (read for popup-dictionary behavior + intent).
> **Design system**: `docs/design-system/design-system-showcase/design-system.md` (token + component source of truth).
> **Agent guide**: `docs/design-system/design-system-showcase/agent.md` (how to query design-system.md).

---

## 1. Goal (single sentence)

Redesign the **right pane Card Creator** in `docs/mockups/popup-dictionary/` so its layout, structure, and component hierarchy match the reference image exactly, using Cell Design System tokens/components.

---

## 2. What NOT to do (anti-patterns)

- DO NOT mirror the popup-dictionary header inside Card Creator. Card Creator header is a **plain title bar** "Card Creator" + actions.
- DO NOT use flat form rows with labels on the left. Every field must be a **card panel**.
- DO NOT put action buttons next to textareas as ghost-only inline links. Action buttons sit in the **card header**.
- DO NOT omit the preview card. The preview card is **mandatory** and appears first.
- DO NOT use a "Media update" dropdown or "Cancel" button in the footer. Footer has exactly **CLEAR FIELDS + CREATE CARD**.
- DO NOT hardcode colors. All colors come from `design-system.md` tokens.
- DO NOT invent new component class names. Use the mapped classes in Section 4.

---

## 3. Visual blueprint (YAML structure + HTML skeleton)

### 3.1 YAML structure tree (machine-parseable layout order)

```yaml
right_pane:
  class: workspace__pane workspace__pane--right
  layout: flex column
  children:
    - header:
        class: workspace__pane-header creator-header
        flex_shrink: 0
        children:
          - title: { class: creator-header__title, text: "Card Creator" }
          - actions:
              class: creator-header__actions
              children:
                - icon_button: { class: icon-btn, aria_label: "Card settings", icon: settings }
                - icon_button: { class: icon-btn, aria_label: "Close Card Creator", icon: close }
    - subheader:
        class: creator-subheader
        flex_shrink: 0
        children:
          - row: { class: creator-subheader__row, label: "Card type", dropdown: { class: dropdown, value: Sentence } }
          - row: { class: creator-subheader__row, label: "Deck", dropdown: { class: dropdown, value: "My Cards" } }
    - body:
        class: workspace__pane-body
        flex: 1
        overflow_y: auto
        padding: space-3 space-4
        children:
          - form:
              class: creator-form
              gap: space-3
              children:
                - preview_card: { class: creator-preview }
                - field_cards: [Target word, Sentence, Sentence translation, Definition, Sentence audio, Word audio, Images, Example sentences, Notes]
    - footer:
        class: creator-footer
        flex_shrink: 0
        children:
          - button: { class: btn, text: "CLEAR FIELDS" }
          - button: { class: "btn btn--primary", text: "CREATE CARD" }
```

### 3.2 HTML skeleton (target DOM template)

AI agent: copy this structure, fill `{SLOT}` with content. Do NOT invent new wrappers.

```html
<div class="workspace__pane workspace__pane--right">
  <!-- HEADER -->
  <div class="workspace__pane-header creator-header">
    <h2 class="creator-header__title">Card Creator</h2>
    <div class="creator-header__actions">
      <button class="icon-btn" aria-label="Card settings">{SETTINGS_SVG}</button>
      <button class="icon-btn" aria-label="Close Card Creator">{CLOSE_SVG}</button>
    </div>
  </div>

  <!-- SUBHEADER -->
  <div class="creator-subheader">
    <div class="creator-subheader__row">
      <span class="creator-subheader__label">Card type</span>
      <div class="dropdown">{DROPDOWN_SENTENCE}</div>
    </div>
    <div class="creator-subheader__row">
      <span class="creator-subheader__label">Deck</span>
      <div class="dropdown">{DROPDOWN_MY_CARDS}</div>
    </div>
  </div>

  <!-- BODY (scrollable) -->
  <div class="workspace__pane-body">
    <div class="creator-form">

      <!-- PREVIEW CARD -->
      <div class="creator-preview">
        <h2 class="creator-preview__word">{TARGET_WORD}</h2>
        <p class="creator-preview__sentence">{SENTENCE_WITH_TARGET_BOLD}</p>
      </div>

      <!-- FIELD CARD (text type) — repeat for: Target word, Sentence, Sentence translation, Definition, Example sentences, Notes -->
      <div class="creator-field-card">
        <div class="creator-field-card__header">
          <span class="creator-field-card__label">{LABEL}</span>
          <div class="creator-field-card__actions">
            <button class="btn btn--ghost">{ACTION}</button>
            <button class="icon-btn creator-field-card__clear" aria-label="Clear {label}">{CLOSE_SVG_16}</button>
          </div>
        </div>
        <div class="creator-field-card__body">
          <textarea rows="2">{VALUE}</textarea>
        </div>
      </div>

      <!-- FIELD CARD (audio type) — for: Sentence audio, Word audio -->
      <div class="creator-field-card creator-media-card">
        <div class="creator-field-card__header">
          <span class="creator-field-card__label">{LABEL}</span>
          <div class="creator-field-card__actions">
            <button class="btn btn--ghost">{ACTION}</button>
            <button class="icon-btn creator-field-card__clear" aria-label="Clear {label}">{CLOSE_SVG_16}</button>
          </div>
        </div>
        <div class="creator-field-card__body creator-media-card__body">
          <div class="creator-media-row">
            <button class="audio-play">{AUDIO_SVG_16} Andrew (Male from United States)</button>
          </div>
          <button class="btn btn--primary creator-media-card__add">+ ADD</button>
        </div>
      </div>

      <!-- FIELD CARD (image type) — for: Images -->
      <div class="creator-field-card creator-media-card">
        <div class="creator-field-card__header">
          <span class="creator-field-card__label">Images</span>
          <div class="creator-field-card__actions">
            <button class="btn btn--ghost">ADD</button>
            <button class="btn btn--ghost">SEARCH</button>
            <button class="icon-btn creator-field-card__clear" aria-label="Clear Images">{CLOSE_SVG_16}</button>
          </div>
        </div>
        <div class="creator-field-card__body">
          <div class="creator-image-grid">
            <div class="creator-image-grid__thumb">{THUMB_1}</div>
            <div class="creator-image-grid__thumb">{THUMB_2}</div>
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- FOOTER -->
  <div class="creator-footer">
    <button class="btn">CLEAR FIELDS</button>
    <button class="btn btn--primary">CREATE CARD</button>
  </div>
</div>
```

### 3.3 Layout rules (CSS)

```yaml
layout_rules:
  right_pane: { display: flex, flex-direction: column }
  header: { flex-shrink: 0 }
  subheader: { flex-shrink: 0 }
  body: { flex: 1, overflow-y: auto, padding: "var(--space-3) var(--space-4)" }
  footer: { flex-shrink: 0 }
  form: { display: flex, flex-direction: column, gap: "var(--space-3)" }
```

---

## 4. Component mapping → design-system.md

| UI element | design-system.md component | Custom class | Required tokens |
|---|---|---|---|
| Header title | plain text | `.creator-header__title` | `font-size-lg`, `font-weight-semibold`, `color-text` |
| Header actions | icon-button | `.icon-btn` | 40×40 desktop, 44×44 mobile |
| Subheader dropdowns | dropdown | `.dropdown` | `color-surface`, `color-border`, `radius-md` |
| Preview card | card | `.creator-preview` | `radius-lg`, `color-surface`, `color-border`, `space-5 space-4` padding |
| Preview word | plain text | `.creator-preview__word` | `font-size-3xl`, `font-weight-bold`, `color-text` |
| Preview sentence | plain text | `.creator-preview__sentence` | `font-size-base`, `color-text-secondary`; target `<b>` uses `color-text` + `font-weight-semibold` |
| Field card | card | `.creator-field-card` | `radius-lg`, `color-surface`, `color-border` |
| Field card header | card header | `.creator-field-card__header` | border-bottom `1px solid color-border-subtle`, padding `space-2 space-3` |
| Field label | plain text | `.creator-field-card__label` | `font-size-xs`, uppercase, `color-text-muted` |
| Field action button | button | `.btn.btn--ghost` | uppercase text, hover `surface-hover` |
| Field clear X | icon-button | `.icon-btn.creator-field-card__clear` | 28×28, `color-text-muted` |
| Field textarea | input | `.creator-field-card__body textarea` | width 100%, min-height 56px, `radius-md`, `color-background`, `color-border` |
| Audio item | button | `.audio-play` | inline-flex, `radius-md`, border `color-border`, bg `color-background` |
| ADD primary button | button | `.btn.btn--primary` | text "+ ADD" |
| Image grid | — | `.creator-image-grid` | grid `auto-fill minmax(120px, 1fr)`, gap `space-2` |
| Image thumb | — | `.creator-image-grid__thumb` | aspect-ratio 4/3, `radius-lg`, bg `surface-hover`, border `color-border` |
| CLEAR FIELDS | button | `.btn` | secondary style |
| CREATE CARD | button | `.btn.btn--primary` | primary CTA |

---

## 5. Field card inventory (order is locked)

| # | Card label | Header action(s) | Body content |
|---|------------|------------------|--------------|
| 1 | Target word | MODIFY | textarea = target word |
| 2 | Sentence | CREATE | textarea = sentence, target word bolded if `boldTarget` setting ON |
| 3 | Sentence translation | CREATE | textarea = sentence translation |
| 4 | Definition | SEARCH | textarea = first definition text |
| 5 | Sentence audio | CREATE | `.audio-play` row "Andrew (Male from United States)" + `.btn--primary` "+ ADD" |
| 6 | Word audio | SEARCH | `.audio-play` row "Andrew (Male from United States)" + `.btn--primary` "+ ADD" |
| 7 | Images | ADD, SEARCH | `.creator-image-grid` with 2 placeholder thumbs + optional "+ ADD" below grid |
| 8 | Example sentences | SEARCH | textarea = first dictionary example or empty |
| 9 | Notes | CREATE | textarea = empty |

---

## 6. Card header structure (every field card)

```html
<div class="creator-field-card__header">
  <span class="creator-field-card__label">{LABEL}</span>
  <div class="creator-field-card__actions">
    <button class="btn btn--ghost">{ACTION}</button>
    <!-- Images only: also ADD and SEARCH buttons here -->
    <button class="icon-btn creator-field-card__clear" aria-label="Clear {label}">
      <!-- close SVG, 16x16 -->
    </button>
  </div>
</div>
<div class="creator-field-card__body">
  <!-- textarea OR audio row + ADD OR image grid -->
</div>
```

**Rules**:
- Label is uppercase, `font-size-xs`, `color-text-muted`.
- Action button text is uppercase (e.g., "MODIFY", "CREATE", "SEARCH", "ADD").
- Clear X is always the right-most element, 28×28, close SVG 16×16.
- Images card is the only card with TWO action buttons in header (ADD + SEARCH) before the X.

---

## 7. State matrix

| Element | Default | Hover | Active/Pressed | Focus | Disabled |
|---------|---------|-------|------------------|-------|----------|
| Field card | surface bg, border color-border | — | — | — | — |
| Textarea | bg color-background, border color-border | border color-border-focus | — | 2px ring color-primary, offset 2px | opacity 0.5 |
| Ghost action | transparent | bg surface-hover | scale 0.98 | 2px ring | opacity 0.5 |
| Clear X | color-text-muted | color-text | — | ring | — |
| Audio play | bg color-background | bg surface-hover, border focus | — | ring | — |
| Primary ADD | bg color-primary | bg color-primary-hover | scale 0.98 | ring | opacity 0.5 |
| CREATE CARD | bg color-primary | bg color-primary-hover | scale 0.98 | ring | disabled if target empty |
| CLEAR FIELDS | bg color-surface | bg color-surface-hover | scale 0.98 | ring | — |

---

## 8. Acceptance Criteria (AT) — CSS selector + assertion format

Run these with Playwright in `docs/mockups/popup-dictionary/index.html` after switching to "Card Creator" view.
Each AT is a CSS selector + assertion. AI agent can copy-paste these into `page.evaluate()`.

```yaml
AT01:
  selector: ".workspace__pane--right"
  assert: exists
AT02:
  selector: ".creator-header__title"
  assert: textContent === "Card Creator"
AT03:
  selector: ".creator-header__actions .icon-btn"
  assert: count === 2
AT04:
  selector: ".creator-subheader .dropdown__trigger"
  assert: ariaLabels === ["Card type", "Deck"]
AT05:
  selector: ".creator-preview"
  assert: exists
AT06:
  selector: ".creator-preview__word"
  assert: textContent === fixture.target
AT07:
  selector: ".creator-preview__sentence b"
  assert: exists AND textContent === fixture.target
AT08:
  selector: ".creator-field-card"
  assert: count === 9
AT09:
  selector: ".creator-field-card .creator-field-card__label"
  assert: textContents === ["Target word","Sentence","Sentence translation","Definition","Sentence audio","Word audio","Images","Example sentences","Notes"]
AT10:
  selector: ".creator-field-card"
  assert: every card has ".creator-field-card__label" AND ".creator-field-card__actions"
AT11:
  selector: ".creator-field-card .creator-field-card__clear"
  assert: count === 9
AT12:
  selector: ".creator-media-card:has(.audio-play)"
  assert: every card has ".audio-play" AND ".btn--primary" with textContent "+ ADD"
AT13:
  selector: ".creator-image-grid .creator-image-grid__thumb"
  assert: count >= 2
AT14:
  selector: ".creator-field-card:has(.creator-image-grid) .creator-field-card__actions .btn"
  assert: textContents includes "ADD" AND "SEARCH"
AT15:
  selector: ".creator-footer .btn"
  assert: textContents === ["CLEAR FIELDS", "CREATE CARD"]
AT16:
  selector: ".creator-footer .btn--primary"
  assert: exists AND textContent === "CREATE CARD"
AT17:
  selector: ".creator-footer .btn:not(.btn--primary)"
  assert: exists AND textContent === "CLEAR FIELDS"
AT18:
  selector: "console"
  assert: error count === 0
AT19:
  selector: "[data-theme='dark'] .workspace__pane--right .creator-field-card"
  assert: all cards have same width (±5px)
AT20:
  selector: "[data-theme='light'] .workspace__pane--right .creator-field-card"
  assert: all cards have same width (±5px)
```

---

## 9. File targets for implementation

| File | Purpose |
|---|---|
| `docs/mockups/popup-dictionary/creator.js` | Replace render functions with new card-based layout |
| `docs/mockups/popup-dictionary/creator.css` | Replace styles with new preview/field-card/media-card/footer styles |
| `docs/mockups/popup-dictionary/index.html` | Bump module version if ES module cache issues occur |

---

## 10. AI implementation order

1. Read this contract.
2. Read `docs/design-system/design-system-showcase/design-system.md` for token/component rules.
3. Read `docs/mockups/popup-dictionary/creator.js` and `creator.css` to see current state.
4. Rewrite `creator.js` top-down: header → subheader → preview → field cards → footer.
5. Rewrite `creator.css` to match Section 4 mapping.
6. Bump `index.html` module version if needed.
7. Run AT01-AT20 with Playwright.
8. If any AT fails, redesign — do not patch symptoms.
9. Only after all AT pass, report completion.

---

## 11. Notes for human review

- The reference image uses a purple/violet accent color. The Cell Design System uses blue primary (`--color-primary`). **Keep Cell blue** — only layout must match the image, not the third-party color scheme.
- The left pane (popup dictionary) is out of scope for this contract. Do not modify it.
- The user avatar in the very top-right of the reference image is part of a global app chrome, not the Card Creator panel. Ignore it unless explicitly requested.
