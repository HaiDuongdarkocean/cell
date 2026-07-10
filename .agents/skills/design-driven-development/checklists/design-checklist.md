# Design Checklist — Gate 1 (UX) + Gate 2 (UI)

> Run during both gates. Gate 1 = Layout Audit (structure). Gate 2 = Audit (redesign) + Acceptance Test definitions.

## Gate 1 — Layout Audit (run before wireframe approval)

Every item must pass before Gate 1 approval. Record result in contract `layout_audit:`.

### Input Fetch (before any grouping)
- [ ] **Mode detected**: A (full screen) vs B (incremental) — picked before fetching.
- [ ] **Upstream output reused**: If `interview-me` / `idea-refine` ran, their output (intent / concept) is reused — not re-asked.
- [ ] **Function list audited from codebase** (Mode A): Source files read, every user action listed. Not asked from user.
- [ ] **Existing page audited** (Mode B): Current wireframe + groups + zones + order drawn from codebase.
- [ ] **New function spec extracted** (Mode B): From upstream concept OR spec/PRD OR user.
- [ ] **Constraints read from docs**: manifest.json, AGENTS.md, ADRs, architecture doc. Not asked from user.
- [ ] **Design system file read**: existing CSS variables, theme, shared UI components. Reuse tokens.
- [ ] **User asked only on cache miss**: Frequency / mental model / grouping question is focused (one question), not a dump.

### Information Architecture
- [ ] **IA model chosen**: One model explicitly picked (scope-first / domain / task-flow). Not "default" or unstated.
- [ ] **Group count fits nav type**: 2-4 groups → tabs; 5-12 → sidebar; >12 → sidebar + search.
- [ ] **No dump group**: No group named "Other", "Miscellaneous", "Advanced", "More", "Additional".
- [ ] **User vocabulary**: Group labels use the user's words, not codebase module names.
- [ ] **Change-frequency axis applied**: Frequent controls upfront, rare-but-important deep but reachable.

### Grouping (Gestalt)
- [ ] **Proximity used first**: Whitespace separates groups before borders do.
- [ ] **Borders minimal**: A border exists only where proximity alone is ambiguous.
- [ ] **Similarity consistent**: Same control type (toggle / select / button) has same visual treatment across groups.
- [ ] **Common region sparingly**: Card/panel containers only when a group needs a hard boundary; not as default decoration.

### Cognitive Load
- [ ] **Visible choices ≤ 7** per screen view (Hick's Law). More → progressive disclosure.
- [ ] **Chunks ≤ 5** per screen (Cowan's 4±1). Each group = one chunk.
- [ ] **Recognition over recall**: Current value shown next to label where applicable.
- [ ] **One primary action per zone**: Not two filled buttons competing.
- [ ] **No orphan function**: Every inventory item is in a group + zone + order slot.

### Order
- [ ] **Frequency order**: Within each group, frequent first (unless task-flow overrides).
- [ ] **Task-flow respected**: If functions form a sequence, order follows the sequence.
- [ ] **Destructive last**: Delete / reset / sign-out at the bottom, visually separated, confirm-guarded.

### Visual Hierarchy
- [ ] **Scanning pattern picked**: F-pattern (text-heavy) or Z-pattern (simple) explicitly chosen.
- [ ] **Hierarchy without chrome**: Weight + size + whitespace drive hierarchy, not border + shadow.
- [ ] **Eye path clear**: Can name where the eye goes 1st, 2nd, 3rd.

### Minimalism
- [ ] **Eliminate before hide**: Every hidden function was confirmed unneeded, not just tucked away.
- [ ] **Progressive disclosure only for secondary**: Primary path never hidden behind a collapse.
- [ ] **No decorative dividers**: One divider between sub-groups, not between every row.
- [ ] **No decorative borders/shadows**: Each remaining border/shadow serves hierarchy or a hard boundary.

### Convention (Jakob's Law)
- [ ] **No invented nav pattern**: Sidebar / tabs / top nav used; no novel custom pattern.
- [ ] **Destructive placement conventional**: Bottom of page or bottom of section, not top.
- [ ] **Settings label conventional**: "Settings" / "Options" / "Preferences" — not a coined term.

### Concrete Layout Bans (checkable)
- [ ] **No border on every card**: A border exists only where proximity alone is ambiguous.
- [ ] **No divider between every row**: One divider between sub-groups, not between each item.
- [ ] **No 3+ equal-weight buttons in one zone**: One primary, rest are text links or icon buttons.
- [ ] **No frequent control buried below rare**: Frequency orders within a group.
- [ ] **No destructive action next to frequent**: Destructive last + separated + confirm.
- [ ] **No dump group name**: No "Other" / "Miscellaneous" / "Advanced" / "More" / "Additional".

### ASCII Wireframe (before Gate 1 approval)
- [ ] **Wireframe drawn**: 1-2 variants, structure only (no color/font/radius).
- [ ] **Boxes/brackets/pipes used**: `┌─┐` containers, `[ ]` buttons/inputs, `│` dividers.
- [ ] **Whitespace visible**: Relative gaps shown (more blank lines = bigger gap).
- [ ] **Labels short**: Group + item names, not full sentences.
- [ ] **Shown to user**: User picked a variant or requested refine.

### Responsive Structure (if multi-breakpoint)
- [ ] **Breakpoints identified**: Desktop / tablet / mobile (or whichever the user needs).
- [ ] **Wireframe per distinct structure**: 1 wireframe per breakpoint IF structure differs; 1 + "scales down" note if same structure.
- [ ] **Content parity**: Same number of groups on every breakpoint. No group hidden on mobile.
- [ ] **Nav type transforms appropriately**: Desktop sidebar → tablet tabs/icon-sidebar → mobile bottom-tab/accordion/hamburger. Not invented patterns.
- [ ] **Mobile-first prioritization**: Frequent functions visible on mobile; occasional/rare collapsed into accordion.
- [ ] **Accordion rules (if used)**: Default-open = most frequent section; one open at a time on mobile; no nesting >2 levels; header = section title (dual purpose).
- [ ] **Billboard (if 1 function ≥80% usage)**: Prominent button above nav on mobile; only 1 billboard max.
- [ ] **Zone transformation**: Primary on-top mobile (no "fold"); secondary may collapse; tertiary in accordion or "Show more".

### Mode B — Placement-specific (incremental add)
- [ ] **Existing page wireframe drawn**: Current structure audited.
- [ ] **New function spec complete**: what / frequency / destructive / trigger type.
- [ ] **Placement decision table complete**: group / zone / order / destructive handling / why.
- [ ] **Before/after wireframe**: same page with `← NEW` marker.
- [ ] **Side-effect check passed**: re-grouping? Hick ≤7? Miller ≤7? whitespace? one-primary?

### Gate 1 Readiness
- [ ] **Inventory complete**: Every function tagged frequent / occasional / rare / destructive. (Mode A)
- [ ] **Bad/good contrasts written**: At least 2 (Mode A) or 1 (Mode B), each citing the principle.
- [ ] **ASCII wireframe included**: In the proposal, not skipped. Responsive variants if multi-breakpoint.
- [ ] **Proposal is showable**: Can be presented as a table + map + wireframe, not just prose.

## Gate 2 — Audit (redesign only) — 8 axes

Run against existing screen before designing new contract surface. Record in `audit:`.

### Typography
- [ ] Inter/Roboto/Arial/system default → Geist/Outfit/Satoshi/Cabinet Grotesk.
- [ ] Headline lacks presence (too small, tracking wide, weight light).
- [ ] Body width > 65ch → `max-width: 65ch`.
- [ ] Only 400/700 → add 500/600.
- [ ] Proportional numbers in data UI → `tabular-nums` or mono.
- [ ] All-caps subheaders everywhere → sentence case or lowercase italics.
- [ ] Orphaned last-line words → `text-wrap: balance`/`pretty`.

### Color & surfaces
- [ ] Pure `#000000` → off-black/zinc-950/tinted dark.
- [ ] Accent sat > 80% → desaturate. More than one accent → pick one.
- [ ] Mixing warm + cool grays → pick one family.
- [ ] AI purple/blue gradient → neutral + single accent.
- [ ] Generic `box-shadow` pure black → tint to bg hue.
- [ ] Flat zero texture → subtle noise/ambient gradient on fixed layer.
- [ ] Random dark section in light page (or vice versa) → commit one theme.
- [ ] Empty flat section no depth → bg image/pattern/ambient gradient.

### Layout
- [ ] Everything centered/symmetrical → offset margins, mixed ratios, left-aligned headers.
- [ ] 3 equal card columns → 2-col zig-zag/asymmetric grid/horizontal scroll.
- [ ] `height: 100vh` → `min-height: 100dvh`.
- [ ] Complex flexbox `%` math → CSS Grid.
- [ ] No max-width container → 1200-1440px auto margins.
- [ ] Uniform radius everywhere → vary (tighter inner, softer containers).
- [ ] No overlap/depth → negative margins for layering.
- [ ] Missing whitespace → double spacing, let it breathe.
- [ ] Buttons not bottom-aligned in card groups → pin CTAs.
- [ ] Feature lists start at different vertical positions → align shared elements.

### Interactivity & states
- [ ] No hover on buttons → bg shift/scale/translate.
- [ ] No active/pressed → `scale(0.98)`/`translate-y(1px)`.
- [ ] Instant zero-duration transitions → 200-300ms cubic-bezier.
- [ ] Missing focus ring → visible 2px accent 3:1 contrast.
- [ ] No loading → skeleton matching layout shape.
- [ ] No empty → composed "getting started".
- [ ] No error → inline message, no `window.alert()`.
- [ ] Dead links to `#` → real destination or visually disable.
- [ ] No active nav indication → style active link.
- [ ] Animating `top/left/width/height` → `transform`+`opacity` only.

### Content
- [ ] Generic names (John Doe, Acme) → realistic contextual.
- [ ] Fake round numbers (`99.99%`) → organic messy.
- [ ] AI cliches (Elevate, Seamless, Unleash, Next-Gen) → plain specific.
- [ ] Exclamation marks in success / "Oops!" errors → confident/direct.
- [ ] Passive voice / Lorem Ipsum / Title Case every header → active/real/sentence case.
- [ ] Em-dash (`—`) anywhere → hyphen/colon. Non-negotiable.

### Component patterns
- [ ] Generic card (border+shadow+white) → remove border or bg only or spacing only.
- [ ] Always one filled + one ghost → add text links/tertiary.
- [ ] Pill "New"/"Beta" badges → square/plain text.
- [ ] Accordion FAQ → side-by-side/inline disclosure.
- [ ] 3-card carousel testimonials with dots → masonry/single rotating quote.
- [ ] Pricing 3 towers → highlight recommended with color.
- [ ] Modals for everything → inline/slide-over.
- [ ] Footer link farm 4 columns → main paths + legal.

### Iconography
- [ ] Lucide/Feather exclusively → Phosphor/Radix/Tabler.
- [ ] Cliche metaphors (rocketship=Launch, shield=Security) → less obvious.
- [ ] Inconsistent stroke widths → standardize one weight.
- [ ] Missing favicon → add branded.

### Code quality
- [ ] Div soup → semantic HTML.
- [ ] Inline styles mixed with classes → styling system.
- [ ] Hardcoded px widths → relative units.
- [ ] Missing alt text → describe content.
- [ ] Arbitrary z-index `9999` → clean scale.
- [ ] Commented-out dead code → remove.
- [ ] Import hallucinations → check `package.json`.
- [ ] Missing meta tags → title/description/og:image.

## Acceptance test definitions (Gate 2 — written into contract)

Written into contract `acceptance_tests:`. Reviewer runs against evidence package post-implement.

| ID | Name | Method | Pass |
|---|---|---|---|
| AT1 | First-glance | View desktop screenshot, answer 3 questions in 3s (sees / knows to do / needs guide=false) | 3/3 match `first_glance` |
| AT2 | Flow step count | Read flow simulation, count steps per task | all tasks ≤ 3 |
| AT3 | Visual tell sweep | View all screenshots, scan for AI tells (em-dash, Inter, purple gradient, 3 equal cards, fake screenshot, scroll cue, locale strip, version footer, eyebrow > ceil(sections/3), centered hero variance>4) | zero tells |
| AT4 | A11y runtime | Read a11y report from evidence | 0 violations |
| AT5 | Console clean | Read console log from evidence | 0 errors (warnings OK if justified) |
| AT6 | Responsive collapse | Compare desktop vs mobile 375px | single-column, no h-scroll, targets ≥ 44px |
| AT7 | Contract compliance | Read code diff vs contract (functions→components, tokens via CSS var, fonts no Inter, radii consistent, states implemented, ARIA matches, anti-slop) | 100% match |

## Summary

| Section | Gate | Pass / Fail |
|---|---|---|
| Input Fetch | 1 | |
| Information Architecture | 1 | |
| Grouping (Gestalt) | 1 | |
| Cognitive Load | 1 | |
| Order | 1 | |
| Visual Hierarchy | 1 | |
| Minimalism | 1 | |
| Convention | 1 | |
| Concrete Layout Bans | 1 | |
| ASCII Wireframe | 1 | |
| Responsive Structure | 1 | |
| Mode B Placement | 1 | |
| Gate 1 Readiness | 1 | |
| Typography | 2 | |
| Color & surfaces | 2 | |
| Layout | 2 | |
| Interactivity & states | 2 | |
| Content | 2 | |
| Component patterns | 2 | |
| Iconography | 2 | |
| Code quality | 2 | |
| Acceptance tests defined | 2 | |

**Gate 1 Overall**: APPROVED / NEEDS_FIXES
**Gate 2 Overall**: APPROVED / NEEDS_FIXES
