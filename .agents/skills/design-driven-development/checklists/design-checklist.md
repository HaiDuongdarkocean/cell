# Design Checklist — Phase 1

> Run during Phase 1. Two sections: Audit (redesign only) + Acceptance Test definitions.

## Audit (redesign only) — 8 axes

Run against existing screen before designing new contract. Record in `audit:`.

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

## Acceptance test definitions

Written into contract `acceptance_tests:`. Reviewer runs against evidence package.

| ID | Name | Method | Pass |
|---|---|---|---|
| AT1 | First-glance | View desktop screenshot, answer 3 questions in 3s (sees / knows to do / needs guide=false) | 3/3 match `first_glance` |
| AT2 | Flow step count | Read flow simulation, count steps per task | all tasks ≤ 3 |
| AT3 | Visual tell sweep | View all screenshots, scan for AI tells (em-dash, Inter, purple gradient, 3 equal cards, fake screenshot, scroll cue, locale strip, version footer, eyebrow > ceil(sections/3), centered hero variance>4) | zero tells |
| AT4 | A11y runtime | Read a11y report from evidence | 0 violations |
| AT5 | Console clean | Read console log from evidence | 0 errors (warnings OK if justified) |
| AT6 | Responsive collapse | Compare desktop vs mobile 375px | single-column, no h-scroll, targets ≥ 44px |
| AT7 | Contract compliance | Read code diff vs contract (functions→components, tokens via CSS var, fonts no Inter, radii consistent, states implemented, ARIA matches, anti-slop) | 100% match |
