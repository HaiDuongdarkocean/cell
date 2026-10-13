# Universal Panel + Settings — UX Audit & Redesign Brief (Spotify-minimal direction)

Date: 2026-10-08 · Method: question-first audit (`audit-ui-ux-then-redesign`)
Evidence: user screenshot (desktop), live showcase renders `viewport=1200` / `viewport=390` (real components, Dawn theme), CSS/JSX source read.

## Design Read (one sentence)

The panel has a solid two-mode skeleton (desktop sidebar / mobile bottom-nav), but it reads as an "admin form app" rather than a focused consumer surface: three navigation layers compete at once, surfaces nest 3 levels deep, and Settings is a 13-section scroll document instead of a grouped drill-in.

## Reframed design question

Not "how to make it prettier" but: **how does a first-class consumer app (Spotify) keep one nav surface, one content surface, and shallow grouping — and which of our layers is redundant?**

---

## Findings (L1 observable → L2 structural → L3 principle)

### F1 — P1 · Navigation: 3 layers visible simultaneously

- **Question:** How many ways to navigate are on screen at once?
- **Evidence:** Desktop render shows (a) left rail with 9 destinations + collapse, (b) header segmented toggles, (c) Settings' own horizontal pill strip — which **truncates at every width** ("Word ba…" at 1200px, "R…" at 390px). Mobile adds a bottom nav = still 3 layers.
- **Standard:** Spotify = exactly one nav surface per breakpoint. Secondary navigation is drill-in (list rows → detail page), never a second persistent bar.
- **Current:** `SettingsDialogContent navMode="horizontal"` renders 13 pill anchors over a scroll-spy document; the strip overflows on 390px and even on 1200px.
- **Proposed:** Settings becomes a **grouped index → drill-in** pattern: one list of ~5-6 groups (General / Language & Profiles / Media & Subtitles / Dictionary / Card Creator / Advanced). Mobile: tap group → push page with back. Desktop: sticky slim sub-nav OR same drill-in in the content column. The 13 pills disappear.
- **Risk:** scroll-spy deep-links (`openSettingsSection`) must map to group→section anchors; keep section ids.
- **Verdict:** restructure IA, not reskin.

### F2 — P1 · Surfaces: card-in-card-in-row nesting (3 levels)

- **Question:** How many surface levels separate the user from a control?
- **Evidence:** Settings = section `Card` (bg + radius) → inner tinted box (profile list) → selected row (accent border). Dictionary mobile: 5 identical round buttons + 3 differently-shaped badges fighting for the same band.
- **Standard:** Spotify uses ~2 surface levels: app chrome + content. Separation via spacing + hairline divider, not borders/shadows. One accent color; badges keep semantic colors but one shared chip shape.
- **Current:** every settings section is a Card with border/radius; gap rhythm inconsistent; controls stretch full column width.
- **Proposed:** flatten — panel body is ONE surface; sections separated by `space-6`/`space-8` + 1px `color-border` hairline; remove card chrome from sections. Chips/badges → single pill shape token. Icon buttons: keep circular (already token-correct) but establish primary/secondary emphasis.
- **Risk:** sections currently rely on Card padding — need spacing audit per section.
- **Verdict:** token/component-level change, biggest "feels like Spotify" lever.

### F3 — P2 · Duplicated hierarchy

- **Question:** Does any label appear twice for the same thing?
- **Evidence:** "Resources" card heading + inner row titled "Resources" again; word "serendipity" appears 3× on mobile (search field, recent chip, heading); pill nav labels repeat the card headings directly below them.
- **Standard:** each fact/label rendered once at the correct level.
- **Proposed:** section heading = group title; remove inner duplicate rows; kill the pill nav (F1) removes the biggest duplication.
- **Verdict:** falls out of F1+F2.

### F4 — P2 · Header chrome competes with content

- **Question:** What does the eye land on first?
- **Evidence:** header = flag icon + tab title + segmented toggle pair + close — the toggle pair reads as tabs but is a mode switch (tokenize/media).
- **Proposed:** header = context title + close only; move media toggles into a compact trailing cluster with `title`/aria labels, visually quiet (ghost icon buttons).
- **Verdict:** polish pass after F1/F2.

### F5 — P3 · Bottom nav is already right

- Mobile bottom nav (5 items, icon+label, active accent, Tools→sheet) is structurally correct and Spotify-shaped. Keep. Only polish: hit-area, active weight, safe-area padding.

---

## Redesign brief — "Spotify-minimal" target

| Layer | Now | Target |
|---|---|---|
| Nav | sidebar + header pills + settings pills (3) | ONE per breakpoint (rail / bottom bar) |
| Settings IA | 13-section scroll-spy doc | ~5-6 grouped index → drill-in |
| Surfaces | cards ≥2 deep + borders | 1 content surface + hairlines |
| Shape | mixed chip/button radii | pill chips, radius-md rows, circular icon btns |
| Accent | blue + pink + green badges + accent borders | 1 accent for active/primary; semantic colors stay but unified chip |
| Spacing | ad-hoc gaps | strict 4/8 rhythm; section gap = `space-6`/`space-8` |
| Type | ok — Heading/Text tokens exist | keep; tighten heading weights |

## SSOT action list (where changes land)

1. `SettingsTab`/`SettingsDialogContent`: new `navMode="drill-in"` (or `"index"`) — grouped index list + section pages. **Reuse** `List`/`ListItem` if present, else `Card`→flat rows. Keep `scrollIntoView` deep-link contract.
2. `UniversalPanel.module.css`: flatten body surface; hairline separators via `color-border`.
3. `UniversalPanelHeader`: quiet trailing cluster (ghost icon buttons) for tokenize/media toggles.
4. `tokens.json`: no new colors needed; possibly add `chip` shape alias — check `PATTERN_CATALOG` first.
5. `CollapsibleSidebar`/`BottomNav`: polish only (active-state weight, hit-area ≥44px).

## Hand-off

This is a `pipeline-design` candidate (multi-surface IA change) — do not implement from this audit alone; the drill-in IA + flattened surface language should be approved as a design brief first, then `pipeline-deliver`.
