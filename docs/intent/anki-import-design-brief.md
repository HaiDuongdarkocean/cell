# Design Brief: Anki → Tihoka import

> Slug: `anki-import` · Mode: all · Spec: `docs/specs/anki-import.md`

## Job + feeling

The user is **moving house**: nervous about losing years of review history,
wants reassurance before committing. The surface must feel like a guided
checklist, not a config screen — every step answers "am I safe to continue?"

## Function audit → journey (from spec REQ map)

| Function | Journey step | REQ |
|---|---|---|
| Surface the feature | open Memory, click import icon | REQ-1 |
| Read an Anki collection | choose source; connect or pick file | REQ-1/2/3 |
| Scope the import | tick decks + notetypes | REQ-4 |
| Resolve destination | pick language | REQ-5 |
| Verify mapping | preview card, adjust roles | REQ-6 |
| Write safely | progress + cancel | REQ-7/8/9/9b |
| Communicate outcome | report + "Học ngay" | REQ-10 |

## Variant (all mode — one justified)

**A stepper wizard in a dialog** (desktop `Dialog`, mobile `MobileSheet` —
same content, host picked by `useIsMobile`). Chosen over (a) inline page and
(b) a settings-section panel: the flow is modal by nature — multi-step,
destructive-adjacent, must not lose state on route change — and Memory is a
single-page app where a full-screen stepper would fight the existing chrome.
A persistent left step-rail on desktop collapses to a "Bước n/6" label +
Progress bar on mobile (375px floor).

The wizard follows existing Tihoka patterns: `SelectableCard` for binary
source choice (same archetype as destination picker in Card Creator),
`Checkbox` rows for the picker (same as deck select-mode), `Select` for
field roles, `Tabs` for notetype switching, `Progress`+`Spinner` for the run,
`Alert` for warnings/fidelity note. No new surface archetype is introduced.

## Layout sketch (desktop Dialog, ~720px)

```
┌──────────────────────────────────────────────────┐
│ Import từ Anki                              [x]  │
│ Bước 2/6 · Chọn nội dung                         │
│──────────────────────────────────────────────────│
│ ○ Nguồn  ● Phạm vi  ○ Ngôn ngữ  ○ Trường …      │  step rail (desktop)
│──────────────────────────────────────────────────│
│ Decks                          [Chọn tất cả]     │
│ ┌──────────────────────────────────────────────┐ │
│ │ ☑ Japanese › Core2k     237 new · 235 review │ │
│ │ ☑ Japanese › Mining        40 new ·  5 susp. │ │
│ └──────────────────────────────────────────────┘ │
│ Loại thẻ                                         │
│ ┌──────────────────────────────────────────────┐ │
│ │ ☑ Basic                512 notes             │ │
│ │ ☐ Cloze (không hỗ trợ)   128 notes   (disabled)│
│ └──────────────────────────────────────────────┘ │
│                          [Quay lại]  [Tiếp tục]  │
└──────────────────────────────────────────────────┘
```

Mapping step (the heart):

```
┌──────────────────────────────────────────────────┐
│ Trường & xem trước — Basic          (◀ 1/3 ▶)   │
│ [Basic] [Japanese mining]        ← notetype tabs │
│───────────────┬──────────────────────────────────│
│ Trường  → vai trò        │  Xem trước thẻ       │
│ Expression → [Target ▾]  │  ┌─────────────────┐ │
│ Meaning    → [Định nghĩa▾]│  │ (real card     │ │
│ Sentence   → [Câu ▾]     │  │  front render) │ │
│ Audio      → [Audio ▾]   │  ├─────────────────┤ │
│ Picture    → [Ảnh ▾]     │  │ back: all      │ │
│            → [Không import▾]│ │  fields        │ │
│                          │  └─────────────────┘ │
│                          │  ◀ thẻ mẫu khác ▶    │
│──────────────────────────┴──────────────────────│
│ Core2k: 2,134 thẻ · target=Expression           │
│                          [Bỏ loại này] [Tiếp]   │
└──────────────────────────────────────────────────┘
```

## States to render (mockup)

- `source` — both CTAs; connect-checking spinner; failed→checklist
- `scope` — picker with mixed states (disabled cloze row)
- `language` — single Select
- `mapping` — the two-pane step above
- `running` — staged progress + cancel
- `report` — counts + fidelity note + primary CTA

Light + dark, 375px + 1280px.

## Copy direction

Vietnamese default (locale follows `t()`); verbs over nouns
("Import từ Anki", "Kiểm tra lại", "Học ngay"); numbers always visible —
trust comes from counts, not adjectives.

## Traceability

Every control above maps: step rail→REQ-1..10 nav; source cards→REQ-1;
checklist→REQ-1 alt/N13; deck/nt lists→REQ-4; language select→REQ-5;
role dropdowns+preview→REQ-6/N5; progress+cancel→REQ-9; report→REQ-10;
top-bar icon→REQ-1/N12.
