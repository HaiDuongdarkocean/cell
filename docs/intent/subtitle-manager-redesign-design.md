# Subtitle Manager — redesign design doc

Companion to `subtitle-manager-redesign-brief.md`. Design-only output:
mockup `src/entrypoints/mockup-subtitle-manager-redesign/` + this mapping doc.
No product code changed.

Method: `visual-reference-design` (decompose → compose → place → size → color →
icon → reconstruct → verify).

## 0 — Reference ingest

Two references, same grammar family. **Ref-1**: travel-app UI kit board, 10
phone screens ~390px logical on a light blue-gray canvas. **Ref-2** (latest,
overrides where they differ): car-wash booking app, 2 phone screens — flat
rows with **icon-in-tinted-squircle** as the selected indicator (idle = gray
tinted tile, selected = solid primary tile + white glyph, NO radio), "Add On
Services" as flat toggle/checkbox rows on bare surface (no card wrapper),
icon+label step chips, full-width solid CTA. Both fixed-density consumer apps;
all frames idle — hover/focus/disabled are inferred.

Layout grammar extracted (this is what we borrow — NOT the light surfaces):

- **Cards**: white, radius ~18–22px, padding 16–20px, soft shadow, content
  grouped per card (flight summary, filters sections, hotel results).
- **Segmented pills**: gray pill track, equal segments; active = **solid blue
  pill + white text** ("One Way", "All", "Upcoming").
- **List rows**: thumb + title + dot-separated meta + trailing price/action.
  Ref-2: icon squircle IS the selection state (solid primary when on) — no
  separate radio.
- **Section headers**: bold title left, "See All ›" right.
- **Settings rows**: icon/title/description + trailing toggle or chevron.
  Ref-2: rows sit flat on the surface — no card/border wrapper.
- **CTA**: full-width solid blue pill-ish rect, ~52px, above bottom bar.
- **Bottom bar**: 4–5 equal icon+label slots, active = accent color.
- **Spacing rhythm**: 8pt grid; card padding 16–20; inter-card gap 12–16.
- **Accent**: royal blue ≈ `#2E6BE6` → maps semantically to `--color-primary`
  (dawn `#5EA5E9` light / `#6AB2F5` dark).

Hard constraint (brief C): panel is a dark-glass overlay on video. We keep
`--color-surface(-popover)` at 85–88% + `blur-lg`; only the grammar ports over.

## 1 — Atom inventory (current panel → target)

| Atom | Type | Note |
|---|---|---|
| Panel surface | overlay surface | dark glass, kept; height: fixed → **fit-content ≤ cap** |
| Header (icon + title + X) | bar | kept as-is |
| Section bar TARGET(n)/NATIVE(n) + 3 icon btns | sticky tablist + actions | kept; gains translucent blur bg for scroll overlap |
| Track row | list option | **→ card row**: radius, glass fill, hairline, selected tint + **icon tile** |
| Off row | list option | same card grammar, compact height |
| Track meta tags | inline text | kept (dot-separated — matches reference meta rows) |
| Radio | selection indicator | **→ removed**; icon squircle carries selected state (ref-2) |
| Latency StepperSection | molecule | kept (`Stepper` pill + status + reset) |
| _dead band_ | empty scroll area | **killed** by fit-content height + Auto section |
| Settings "Phụ đề" toggles (dialog) | settings rows | **→ "Auto-load" flat section** inside tracks view (no card — ref-2 + user feedback) |
| Cue display InkTabs | mode toggle | **→ SegmentedControl pill** (solid accent active) |
| Footer 5 slots | nav bar | **→ 4 slots**; Generate lifted to primary CTA row |
| _(new)_ Generate CTA | primary action | full-width `Button primary` in dock |
| _(new)_ Scroll affordance | overflow hint | `mask-image` bottom fade on `.tracksBody` when content continues below (`data-more`) |
| _(new)_ Icon tile | selection indicator | 40px squircle, `surface-hover` idle → `primary` solid + `primary-foreground` glyph selected |

## 2 — Component tree (tracks view)

```
.panel                     dark glass, fit-content, right-docked (desktop)
├─ .header                 icon subtitleManager + title + X            [kept]
├─ .tracksBody             overflow-y auto, scrollbar hidden,          [kept + fade]
│  │                       data-more → 32px bottom mask-image fade
│  ├─ .sectionBar          sticky; InkTabs (plain "· N" counts, no
│  │                       badge pills) + Import/EyeOff/AudioLines;
│  │                       bg = surface-popover 96% + blur-md (no bleed)
│  ├─ .tabContent          per-role panel; flex column, gap space-2
│  │  ├─ .sectionCard      TRACKS zone card (radius-container, glass)
│  │  │  └─ .trackList     role=listbox — flat rows, no per-row borders
│  │  │     ├─ Off row     role=option, circleX tile + label, centered
│  │  │     └─ TrackRow ×n role=option, captions tile + name + meta + download
│  │  └─ .sectionCard      PLAYBACK zone card
│  │     └─ .playBody      uniform 12px inset
│  │        ├─ StepperSection   Latency + Saved/Saving + −0.5/val/+0.5 + ↺
│  │        └─ .cueRow     hairline divider + label + SegmentedControl
│  │                     (filled, 40px segments, solid-active override)
│  └─ .sectionCard.autoCard AUTO-LOAD zone card — once for both tabs
│     └─ SettingsGroup label + flat SettingsRow toggles (12px inset);
│        dependent rows dim via .rowDisabled when auto-load is off
└─ .dock                   pinned cluster — CTA + nav only
   ├─ Button primary md    "Generate native" (languages icon) — full width
   └─ FooterBar            4 ghost slots: Search · OCR · Customize · Hide/Show
```

Placement decisions:

- **Zone cards (proximity)** — each functional zone is ONE card
  (`radius-container`, glass fill, hairline): Tracks / Playback / Auto-load.
  Children inside a card are flat rows — no per-child borders, dividers are
  hairlines. Uniform text inset = **12px** everywhere: card pad 4 + row pad 8
  (track/cue rows), card pad 4 + `playBody` 2 + StepperSection 6 (latency),
  card `padding-inline: space-3` (auto rows).
- **Cue display lives in the Playback card** (with Latency, hairline divider):
  both control cue rendering — proximity wins; dock keeps only CTA + footer,
  freeing ~80px of content height. Segments bumped to 40px (touch floor).
- **Auto section, once, below both tab panels** (inside `.tracksBody`, after
  `.tabContent`): the three toggles are overlay-global, not per-role — rendering
  them per tab would duplicate identical state. Inside the scroll region so the
  `data-more` fade advertises it below the fold. EmptyState+Import was rejected
  (redundant with the section-bar `+` action) and removed.
- **Tab counts are plain text** ("TARGET · 3") — secondary color, normal weight,
  middot separator; badge pills removed (InkTabs `badge` prop unused).
- **Generate lifted out of FooterBar** as the single primary CTA: cuts the
  5-way equal-choice row to 4 nav slots (Hick's) and matches the reference's
  "filters → big blue CTA → tab bar" stack. Alternative considered — Generate
  as `primarySubtle` footer slot — rejected: it stays a 5th equal choice.
- Footer keeps `FooterBar` (4 slots), edge-to-edge under the dock padding.

## 3 — Size table (px → token → hit target)

| Element | Logical px | Token | Hit target |
|---|---|---|---|
| Panel width (desktop) | 360 | `--dialog-max-width-sm` | — |
| Panel radius | 12 / 16 | `radius-element` (desktop L corners), `radius-container` (mobile top) | — |
| Header height | 44 | `space-11` min-height | X btn 40 |
| Section bar | ~48 | `space-1/3` padding + tab `space-9` min | tabs ≥36, icon btns 40 (`iconbutton-size-md`) |
| Track card | min-h 48, pad 8, gap 8, radius 12 | `space-12`, `space-2`, `radius-element` | full card ≥48 |
| Off card | min-h 40 | `space-10` | ≥40 |
| Icon tile | 40 squircle, radius 8 | `space-10`, `radius-lg` (concentric: card 16 → row 12 → tile 8) | inside card |
| Download btn | 40 | `iconbutton-size-md` | 40 |
| Stepper pill | 40 | `space-10` (input height) | 40/seg |
| Auto section | flat, pad 4/0/12 | `space-1/3` | rows ≥~40 via `space-2` dense |
| Toggle | xs (existing recipe) | `toggle-*` | ~36 — acceptable (label row is also clickable target via htmlFor? no — Toggle input hit is its label box; keep as-is, matches Settings dialog) |
| Segmented control | seg min-h 40, radius pill | `space-10`, `radius-pill` | 40 — G3 resolved in mockup via min-height override |
| Generate CTA | 40 | `button-height` (`size-element-lg`) | 40 full width |
| FooterBar | ~57 | content height | full slot ≥48 |
| Dock padding | 8/12 | `space-2/3` | — |

## 4 — Type table

| Element | Spec |
|---|---|
| Panel title | `font-size-base` `weight-semibold` `tracking-tight` |
| Tab labels | InkTabs default (`sm medium`, uppercase via product labels) |
| Track name | `font-size-sm` `weight-medium` `leading-tight`, ellipsis |
| Track meta | `font-size-xs`, `text-secondary`, dot-separated |
| Section labels (Latency, Auto-load, Cue display) | `font-size-xs` `weight-medium` `text-secondary` |
| Settings row title / desc | SettingsRow canonical (`sm medium` / `xs secondary`) |
| Segmented | `font-size-xs` `weight-medium` (filled recipe) |
| CTA | `font-size-sm` `weight-medium` (Button md) |
| Footer labels | `font-size-xs` `weight-medium` (Button vertical) |

## 5 — Color map

| Component | bg | fg | Rule / contrast |
|---|---|---|---|
| Panel (desktop) | `color-surface` 85% + `blur-lg` | `text-primary` | glass over video; text on blended surface ≥7:1 |
| Panel (mobile) | `surface-popover` 88% + blur | same | — |
| Track card idle | `surface-card` 55% alpha + `border-subtle` hairline | `text-primary` | alpha fill keeps video bleed; name ≥7:1, meta ~4.5:1 |
| Track card hover | `surface-hover` 70% | same | — |
| Track card selected | `primary-subtle` | name `text-accent-strong` | accent tint + solid tile; ≥4.5:1 |
| Icon tile | `surface-hover` → active `primary` | `text-secondary` → `primary-foreground` | ≥3:1 vs card bg; ref-2 selector grammar |
| Meta tags | — | `text-secondary`; AUTO=`info`, source=`success` | unchanged |
| Auto section | `surface-card` 55% + `border-subtle` (zone card) | SettingsRow canonical | card groups the global toggles |
| Cue segmented track | `surface-hover` (filled variant) | `text` muted | — |
| Segmented active | **`primary` solid** | **`primary-foreground`** | DS gap G1 — see §10 |
| Generate CTA | `primary` | `primary-foreground-soft` | Button primary token pair |
| Dock separator | hairline `divider` top border | — | — |
| Footer | FooterBar hairline top | ghost btns; active slot `primary` tint | — |
| Saved status | — | `success` | unchanged |

## 6 — Icon table (collision check)

| Position | Glyph | Catalog name | Collision verdict |
|---|---|---|---|
| Header | library/list | `subtitleManager` | kept, unique to manager |
| Close | × | `x` | standard dismiss |
| Section bar + | plus | `plus` | "add track" — unique here |
| Section bar hide | eye-off | `eyeOff` | pairs with footer hide — same semantics, consistent |
| Section bar condense | audio-lines | `audioWave` | unchanged |
| Track tile | captions frame | `captions` | ref-2 selector tile; tile = selected indicator |
| Off tile | circle-x | `circleX` | "no subtitle" — distinct from the two eyeOff hide actions (was eyeOff ×3 collision) |
| Track download | download | `download` | unchanged |
| Latency reset | rotate-ccw | `rotateCcw` | unchanged |
| Cue display | — (text labels) | — | no icon (reference pattern: text segments) |
| Generate CTA | languages | `generateNative` | same glyph as old footer slot — moved, not duplicated |
| Footer | search / scan / sliders / eye | `search`, `scanText`, `slidersHorizontal`, `eye`/`eyeOff` | OCR slot swapped `captions`→`scanText`; Hide slot swaps eye↔eyeOff with its label (was always crossed-eye, contradictory when showing "Show") |

All glyphs are outline lucide (2px stroke, round caps) — matches reference's
outline icon style. Paired states: `eye`/`eyeOff` both exist; Hide slot swaps
label Hide↔Show (existing behavior kept).

## 7 — State matrix

| Component | idle | hover | pressed | focus-visible | disabled | active/selected | saving/error |
|---|---|---|---|---|---|---|---|
| Track card | glass fill | `surface-hover` 70% | (hover bg stays; ripple N/A) | `border-focus` outline | N/A | `primary-subtle` + solid tile | — |
| Off card | secondary text | same | same | same | — | same selected recipe | — |
| Icon tile | `surface-hover` | — | — | — | — | `primary` fill + `primary-foreground` glyph | — |
| IconButton (section/header) | ghost | `overlay-hover` | scale | `border-focus` | `disabled` (condense) | `active` tint (hide-section) | — |
| InkTabs tab | secondary | — | — | focus ring | — | primary text + ink bar | badge count |
| Stepper ±btn/input | pill | — | — | ghost input none | — | — | `Saving…`/`Saved` status slot (success color) |
| Toggle | track | thumb lift | — | input focus ring | `disabled` dim + chain | `primary` track | — |
| Segmented segment | muted | subtle bg | — | `border-focus` outline | — | solid primary (G1) | — |
| Generate CTA | primary fill | `primary-hover` | press scale 0.985 | focus ring | `disabled-opacity` (no cues) | — | loading → `Spinner` (Button supports `loading`) |
| FooterBar slot | ghost | hover bg | ripple | ring | — | `active` flat (Hide↔Show) | `ripplePulse` on Generate removed (CTA has own emphasis) |
| tracksBody fade | off when content fits | — | — | — | — | `data-more` → 32px `mask-image` fade | — |
| Disabled auto rows | full color | — | — | — | `rowDisabled` dim (toggle keeps own disabled opacity — no double-dim) | — | — |

## 8 — Motion spec

- Track card bg/ring: `duration-150 ease-out` (matches `.track` today).
- Segmented: variant default `duration-fast ease-in-out`; solid pill switch is
  instant-per-frame (no thumb slide — `filled` has no moving indicator; a true
  sliding pill is optional polish, not required).
- Panel enter/exit, view slides, header slide stack: unchanged (existing
  `duration-300 cubic-bezier(0.32,0.72,0,1)`).
- Mobile auto-hide header/footer on scroll: unchanged; applies to `.dock` too
  (product selector `[class*='footer']` must be retargeted to the dock wrapper —
  flagged for deliver).
- `prefers-reduced-motion`: all additions fall under existing reduced-motion
  guards; mockup includes the guard on track cards.
- Focus order: header → tabs → section actions → cards → stepper → auto
  toggles → segmented → CTA → footer. Escape: unchanged `pushEscapeLayer`.

## 9 — Viewport behavior

- **Desktop ≥840px**: right-docked card, `width: min(100%, --dialog-max-width-sm)`
  (360 — brief's 420 measurement is the live build; keep token), **height:
  fit-content, max-height: min(100%, 660px)** — kills the dead band. Left
  corners rounded, flush right edge, slide-in kept.
- **Mobile <840px**: bottom sheet hugs content (`max-height: 75vh` — matches
  the product manager-sheet spec) — no change besides shared internals.
- Content scroll region = `.tracksBody` (tabs + list + latency + auto section);
  dock never scrolls. When `scrollHeight > clientHeight` and scroll isn't at
  bottom, `.tracksBody` gets `data-more` → bottom `mask-image` fade
  (`linear-gradient(to bottom, black calc(100% - var(--space-8)), transparent)` — 32px).
  Without it, hidden scrollbars + a fold clipping mid-row made the Auto-load
  settings undiscoverable (grader P1 — fixed in mockup).

## 10 — DS gaps (need before deliver)

- **G1 — `SegmentedControl` variant `solid`**: reference needs active = solid
  `primary` + `primary-foreground` on `surface-hover` track. Existing variants:
  `raised` (surface float), `accent`/`filled` (primary-subtle tint). Mockup
  simulates via `[aria-checked='true']` override in `.cueSeg`; deliver adds a
  real variant + showcase entry + style-guard update. (Shared UI change →
  needs Anh's confirm per AGENTS rule.)
- **G2 — glass card recipe**: `Card` assumes opaque `--card-background`. Overlay
  surfaces need the `color-mix(surface-card 55%)` + hairline fill that product
  track rows already hand-roll. Deliver should either add `Card
  variant="overlay"`/`data-glass` or formalize a `--card-overlay-*` token —
  not yet another local recipe.
- **G3 — segmented hit height**: `chip-height` = 32px < 40px touch target.
  `size="md"` only applies to `chips` variant. Either bump via
  `data-compact-hit` policy or accept 32 (segments share a row — Fitt's ok on
  desktop; mobile should use md-height segment option). Decide in deliver.
- **G4 — FooterBar margin escape**: dock padding requires footer to stretch
  `margin-inline: -space-3`; alternatively give the dock zero horizontal padding
  and pad cueRow/CTA individually — deliver chooses the cleaner split.

No new tokens required. No new icons required.

## 11 — i18n keys

Reuse (unchanged strings, en+vi exist):

- `subtitle.manager.*` (title, off, source*, downloadItem…)
- `subtitle.offset.*` (latency, saved, saving, reset…)
- `subtitle.playerMode.displayMode(.list/.active)`
- `subtitle.search.title`, `subtitle.ocr.label`, `subtitle.customize.title`,
  `subtitle.action.hide/show`
- `subtitle.generate.buttonTitle` ("Generate native" / "Tạo phụ đề bản địa") →
  CTA label (was title-attr only; promoted to visible label — reuses existing key)
- `settings.block.autoLoad(.hint)`, `settings.block.autoLoadAsr`,
  `settings.block.autoTranslate(.hint)` — move semantics to manager; deliver may
  rename to `subtitle.manager.auto.*` or keep keys (decision: rename for honesty,
  update both locales + all callers in same commit).

New keys needed:

| Key | EN | VI |
|---|---|---|
| `subtitle.manager.auto.title` | Auto-load | Tự động tải |

(empty-state keys dropped — EmptyState removed per user feedback.)

VI length check (rendered in mockup): "Chỉ câu đang phát", "Tạo phụ đề bản
địa", "Cả phụ đề tự động của YouTube" all fit at 360–420px — see
`mobile-light-vi.png`, `desktop-dark-vi(-scrolled).png`.

## 12 — Deviation list

| Deviation | Reason | Severity |
|---|---|---|
| Light surfaces → dark glass | hard constraint C | constraint |
| Card radius 12/16 vs ref ~18–22 | proportion-adjusted to 48–170px heights; token snap | ≤2px-class token choice |
| Active segment solid vs DS `filled` tint | G1 — DS gap, staged via override | DS gap |
| Radio → icon tile (ref-2 grammar) | tile is the selected indicator — removes a second affordance | ref-2 direction — flag for review |
| Selected ring removed (`shadow-inset-selected`) | ref-2 selection = tile fill + row tint only; ring was redundant with tile | polish |
| Zone cards; per-row borders removed | user feedback — proximity cards + flat children | user choice |
| Cue display → Playback card (was dock row) | user feedback — it consumed dock height; groups with Latency | user choice |
| Tab badges → plain "· N" counts | user feedback — badge pills too heavy for counts | user choice |
| Segmented min-height 32→40 | touch floor (Fitts), resolves G3 locally | a11y fix |
| Sticky bar 60%→96% popover | scrolled text bled under tabs | grader P1 fix |
| eyeOff×3 → `circleX` Off tile + eye↔eyeOff Hide swap | icon-scope collision | grader P1 fix |
| Row-level dim on disabled chain | disabled toggles with full-color text read as enabled | grader P2 fix |
| EmptyState removed | user feedback — `+` in section bar already covers "add"; text narrowed usable space | user choice |
| Bottom `mask-image` fade on overflow (32px) | scrollbar is hidden; fold clipping mid-row hid the moved settings | grader P1 fix |
| OCR footer icon `captions`→`scanText` | frees `captions` for the track tile; `scanText` matches toolbar OCR glyph | icon hygiene |
| Panel height fit-content (was fixed 660) | kills ~300px dead band — brief B requirement | design change — flag for review |
| Section bar gains translucent blur bg | content scrolled under fully-transparent bar read as defect | polish fix |
| Footer 5→4 slots + CTA row | brief B option "tách riêng" — Hick's | user choice |
| Cue label stacked above segmented (was inline row) | reference filters grammar + VI label wrap safety | layout change |
| Meta tags unchanged (no chips) | reference uses dot-separated meta text too | none |
| `state-focus-segment.png` focus landed on CTA not segment | capture artifact — Tab moved past radio group; focus ring evidence still valid | evidence note |

## 13 — Deliver-phase contract notes (do not lose)

- Keep hooks: `subtitle-manager-panel`, `subtitle-manager-close`,
  `manager-section-header`, `manager-section-body`, `manager-item-*`,
  `manager-off-*`, `manager-download-*`, `manager-offset-*`, `manager-import-*`,
  `manager-hide-section-*`, `manager-condense-audio`, `pm-cue-display-row`,
  `manager-search-subtitles`, `manager-ocr-settings`,
  `manager-customize-appearance`, `manager-hide-both`, `manager-generate-native`
  (now on the CTA). New: `manager-auto-group`, `manager-auto-load`,
  `manager-auto-load-asr`, `manager-auto-translate`.
- Roles kept: `dialog`, `tablist/tab/tabpanel`, `listbox/option`,
  `radiogroup/radio` (SegmentedControl provides), `switch` (Toggle provides),
  `role="status"` on offset save label. Track tiles are `aria-hidden` — the
  `option`'s `aria-selected` still carries selection to AT.
- Settings deletion (deliver): remove `data-section="block"` block + nav entry
  `'block'` in `SettingsDialogContent.tsx` — check `sectionRef('block')`,
  settings nav list, and any e2e deep-links to `#block`.
- Storage keys unchanged: `subtitleOverlayAutoLoad`, `subtitleOverlayAutoLoadAsr`,
  `subtitleOverlayAutoTranslate`, `PLAYER_MODE_CUE_DISPLAY`.
- Shadow-DOM rules: unchanged — `composedPath` outside-click, `pushEscapeLayer`,
  `getRootNode` focus.
- Mobile scroll auto-hide: retarget footer selector to `.dock` wrapper.

## 14 — Evidence (`tmp/subtitle-manager-redesign/`)

| File | Covers |
|---|---|
| `desktop-dark-default.png` | idle, 3+1 tracks, tile selection, fold fade |
| `desktop-dark-empty.png` / `-scrolled` | 0-track (no EmptyState — Off row only) + disabled Generate |
| `desktop-dark-many.png` | 8-track scroll, truncation, sticky bar |
| `desktop-light-default.png` | light glass |
| `desktop-dark-vi.png` / `-scrolled` | VI labels |
| `desktop-dark-auto-(off-)scrolled.png` | auto card, disabled chain |
| `mobile-dark-default.png`, `mobile-dark-many.png`, `mobile-dark-scrolled.png`, `mobile-light-vi.png` | bottom sheet |
| `state-hover-track/footer/generate.png` | hover |
| `state-focus-segment.png`, `state-focus-toggle.png` | focus rings |
| `state-cue-active.png`, `state-saving.png`, `state-saved-offset.png`, `state-hide-active.png`, `state-native-tab.png`, `state-auto-enabled.png`, `state-auto-disabled-chain.png` | toggles/tabs/saving |

Open mockup: `npm run dev` →
`http://localhost:5173/src/entrypoints/mockup-subtitle-manager-redesign/index.html`
(params: `?viewport=desktop|mobile&mode=dark|light&scenario=default|empty|many&auto=on|off|chain&lang=en|vi`).
