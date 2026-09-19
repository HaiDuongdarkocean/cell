# Intent: Primer tab (Words) UI/UX redesign

> Slug: `primer-tab-redesign` · Mode: interactive · Source: user statement + screenshots `quetta_9ArgVDS498.png`, `quetta_QRXi3nekSB.png`
> ui_surface: yes
> confidence: high

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | The Words (primer) tab's row layout reads as developer internals, not a learner-facing list: a meaningless green rank number, a `×N` glyph with no words, token underline styling that renders near-black on the dark panel, and a header that wraps into two disjoint stat fragments on narrow screens — users cannot tell what they are looking at or why a word matters | Screenshot quetta_QRXi3nekSB (mobile: header splits into two blocks, dark terms); `PrimerTab.tsx:80-96` (FrequencyBadge rank chip + `×count` bare); user statement | high |
| Change | Dense developer-flavored row (`term — rank chip — ×N — square play`) → compact learner row (`round play button — word — small sub-line with repetition info`), grouped single-line header, readable term color, tighter spacing | `PrimerTab.tsx:60-112`, `PrimerTab.module.css:46-73` | high |
| Solution | Restructure the row to play-affordance-left + word-info-right, fold the frequency/repetition data into a human-readable sub-line under the term, group header stats, and switch the seek icon to the system's circular play glyph | user statement (explicit layout `div > play + word info`); `navPlay` = circle-play icon `src/shared/icons/index.ts:292` | high |
| Value | Users understand each row at a glance on any screen size — what the word is, how often it appears in this video, and one tap to jump to it — matching the visual language of the subtitle panel around it | user statement; subtitle panel design language (`subtitlePanelsShared`) | high |
| Stakeholder | End learner (5–80, mobile + desktop) watching subtitled video and previewing unfamiliar words before/while watching | intent `pre-watch-primer` (wiki line 85) | high |
| Context | Lives inside the subtitle overlay panel (`SubtitlePanel` Words tab) on host pages; dark-dominant context; narrow mobile widths must not break | `SubtitlePanel.tsx` mounts `PrimerTab`; screenshots | high |

## Stakeholders

| Group | Who | Their need re: this change | Capability/constraint |
|---|---|---|---|
| Team | Extension maintainers | Small, bounded UI rework reusing shared atoms + tokens; no data-model change | PrimerRow already carries `count`, `rank`, `band` (`primerList.ts:4-15`) — presentation-only change |
| Customer | Language learner | Read a word list, understand why each word is listed, tap to jump/lookup | Persona 5–80, any device — clarity over density |
| Supplier/Dependency | tokenize + dictionary status data | none — same `PrimerRow[]` input | `buildPrimerList` unchanged |
| Organization | Repo consistency | Keep subtitle-panel visual language (tokens, shared/ui), no one-off styling | `AGENTS.md` UI rules |
| Regulator | none | none — no new data surface | — |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | Rows must read as a learner list: word + why-it-matters info in plain words — frequency rank stays visible but as readable text, not a green chip | U | user: "thông báo được frequency rank thứ tự là bao nhiêu... nhìn giống plain text, như `unknown · frequency:50 · xuất hiện:×30`" | high |
| N2 | Secondary info (status, frequency rank, repetition count) lives on a small sub-line under the word — term on top, meta below | U | user: "term ở trên và các dòng thể hiện thông tin phụ ở dưới" | high |
| N3 | The seek affordance must be a circular play icon on the LEFT of the row (`div > play button + word info`), matching system iconography | U | user statement; `navPlay` circle-play icon exists in catalog | high |
| N4 | Header statistics must be grouped into a single compact line that survives narrow widths | U | user: "hiển thị thống kê quá nhiều label → gom lại"; mobile screenshot | high |
| N5 | Term text must use readable foreground color on the dark panel (no near-black token styling) | U | user: "màu chữ không hợp lý... đen xì" | high |
| N6 | Vertical/horizontal spacing must tighten — list must not consume excess space | U | user: "tập trung vào spacing để không bị chiếm quá nhiều không gian" | high |
| N7 | Word tap still opens dictionary lookup; play tap still seeks to first cue; status (unknown/tracking) still visually distinguishable | F | existing behavior `PrimerTab.tsx:23-38,97-110` | high |

## Scope

- **In:** PrimerTab row anatomy (play-left + term + sub-line), header stat grouping, term/meta colors, spacing tokens, circular seek icon, narrow/mobile layout; sub-line keeps frequency rank + status + repeat count as readable info. **User wants 3 mockup variants at design stage — (a) plain-text meta, (b) CSS-visual meta, (c) creative — to pick from**
- **Out:** `buildPrimerList` logic, token map, sorting; other subtitle panel tabs; dictionary popup
- **Non-goals:** changing which words are listed or their order; adding/removing actions (lookup + seek stay); data-model or message changes

## Workflow

A learner opens the subtitle panel → Words tab. The system renders the primer list sorted by frequency rank. The learner scans rows top-down: each row shows a circular play affordance, the word, and a small line saying how often it appears (and optionally its frequency tier in words). Tapping the word opens the dictionary popup at that word's context; tapping play seeks the video to the word's first cue. On a phone the panel is narrow — the header stays one line and rows stay one compact unit tall.

## Journey

### AS-IS
1. Learner opens Words tab on a narrow panel → header stats split into two wrapping blocks ("150 new words" vs "148 unknown · 2 tracking").
2. Each row shows: underlined term (near-black on dark), a green number chip (frequency rank — meaningless to non-developers), a bare `×N`, and a square-ish play icon on the right.
3. Learner cannot tell what the green number means, why `×53` appears, or which control seeks vs looks up; rows are tall and airy.
4. On mobile the row still fits but the header fragments and the term color fails contrast expectations.

### TO-BE
1. Learner opens Words tab at any width → one compact header line states the count summary.
2. Each row shows: round play button (left), the word in readable text, and a small sub-line under it reading e.g. "×53 · appears often in this video" semantics.
3. Learner taps play to jump to the first cue, or taps the word area for the dictionary — status (learning/new) remains distinguishable without a cryptic number.
4. Rows are compact; the list shows more words per viewport on both mobile and desktop.

## Stories

- S1: As a learner, I want each word row to tell me in plain text how often the word appears in this video so that I understand why it's listed — done when the sub-line conveys repetition without developer jargon.
- S2: As a learner, I want a clearly recognizable play control to jump to where the word is spoken so that I don't confuse lookup with seek — done when a circular play button sits left of the word and seeks on tap.
- S3: As a learner on a phone, I want the tab to stay readable at narrow widths so that I can browse words comfortably — done when header + rows don't wrap into fragments.
- S4: As a learner, I want to distinguish words I'm already learning from new ones — done when the sub-line names the status (unknown/learning) in words.

## Risks

| Risk | Type | Impact | Team's ability to respond |
|---|---|---|---|
| Dropping the rank chip loses "how common is this word" signal if no substitute is designed | human/UX | medium | DESIGN stage keeps frequency meaning via sub-line text or a subtle band dot — user decides at mockup |
| `js-cell-token--status-*` styling is shared with cue-list tokens — overriding it inside PrimerTab must not leak to cue list | internal | medium | Scope the override under `.primerTab` module class; visual check on both surfaces |
| Very long words with sub-line could still crowd on 280–320px panels | operational | low | ellipsis on term; sub-line truncates |
| Play-left placement flips the click affordance users may have learned | human | low | Whole row still opens lookup; play button is bigger + labeled aria |

## Decision

no-go — user pivoted on 2026-09-19: the Words (primer) tab is removed entirely instead of redesigned. Rationale: the feature is not needed at this time and the FAB (CueRecommendFab) already carries the desired learner-facing design language. Scope delivered before the pivot: REQ-5 (hide single-tab strip) + REQ-6 (cue-list desync + sync pill) shipped via `feat/primer-tab-redesign` (`6eda69e6`, `2f2a4e8f`). Removal deletes `PrimerTab.*`, `primerList.*`, `FrequencyBadge.*`, `primer.*` i18n keys, the mockup entrypoint, and all `SubtitlePanel` words wiring; the earlier brainstorm directions (context cards, TTS on text pages, inline status triage, unified Words surface) are recorded as future ideas, not committed scope.

## Draft Acceptance Criteria

- [ ] Row structure: circular play icon button on the left, word on top + sub-line meta below
- [ ] Sub-line conveys status, frequency rank, and repetition count as readable text (e.g. `unknown · freq #50 · ×30 in video`) — no unexplained chips
- [ ] Three mockup variants produced for the meta treatment (plain text / CSS-visual / creative); user picks before implementation
- [ ] Header statistics grouped into a single compact line; no two-block wrap at ≤360px panel width
- [ ] Term color meets readable contrast on dark panel (uses `--color-text` family, not near-black token styling)
- [ ] Row vertical spacing reduced vs current; no visual regression at desktop width
- [ ] Play button seeks to first cue; word area opens dictionary lookup; unknown vs tracking still distinguishable
- [ ] i18n strings for the sub-line (en + vi)
- [ ] `data-cell-id` hooks preserved (`primer-tab`, `primer-list`, `primer-row`, `primer-seek`)
