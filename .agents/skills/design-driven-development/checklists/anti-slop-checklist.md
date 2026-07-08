# Anti-Slop Checklist

> Full ban list. Copy active bans into contract `anti_slop:`. Implementer must not violate. Reviewer checks during AT3.

## Typography
- [ ] **Inter as default** → Geist, Outfit, Satoshi, Cabinet Grotesk. (Inter OK only if user asks for neutral/public-sector.)
- [ ] **Roboto/Arial/Open Sans/Helvetica as default** → same reason, AI defaults.
- [ ] **Generic serif (Times/Georgia/Garamond/Palatino) as default** → distinctive modern serif only (PP Editorial New, GT Sectra, Recoleta, Cormorant, Playfair, EB Garamond).
- [ ] **Fraunces/Instrument Serif as default** → LLM-favorite display serifs.
- [ ] **Em-dash (`—`) anywhere** → hyphen/colon/comma/period/parens. En-dash also banned. Date/number ranges use hyphen (`2018-2026`, `$40-80k`).
- [ ] **Oversized H1 that screams** → control hierarchy with weight + color, not raw scale.

## Color
- [ ] **Pure `#000000`** → off-black, zinc-950, charcoal.
- [ ] **Pure `#ffffff` canvas** → warm bone `#FBFBFA` or off-white.
- [ ] **AI purple/blue gradient** → neutral base + single considered accent.
- [ ] **Oversaturated accents (>80%)** → desaturate to blend with neutrals.
- [ ] **More than one accent** → pick one, lock whole page.
- [ ] **Mixing warm + cool grays** → pick one family, tint consistently.
- [ ] **Generic `box-shadow` pure black** → tint shadow to background hue.
- [ ] **Beige+brass+oxblood+espresso as default** → rotate: Cold Luxury, Forest, Black and Tan, Cobalt and Cream, Terracotta and Slate, Olive and Brick, monochrome+pop.

## Layout
- [ ] **3 equal card columns as feature row** → 2-col zig-zag, asymmetric grid, horizontal scroll, masonry.
- [ ] **`height: 100vh`** → `min-height: 100dvh` (iOS Safari bug).
- [ ] **Complex flexbox `%` math** → CSS Grid.
- [ ] **Centered hero when variance > 4** → split/left-aligned/asymmetric. (Exception: editorial/manifesto.)
- [ ] **Split-header (big headline + small explainer)** → stack vertically.
- [ ] **Zigzag 3+ consecutive sections** → break with full-width/vertical-stack/bento/marquee.
- [ ] **Bento with empty cells** → N items = N cells, re-shape grid.
- [ ] **Bento all white-on-white text** → 2-3 cells need visual variation.
- [ ] **`border-t`+`border-b` on every row** → pick one divider, sparingly.
- [ ] **Section-layout repetition** → each layout family max once per page. 8 sections → ≥4 families.

## Hero (landing only)
- [ ] **Headline > 2 lines desktop** / **subtext > 20 words or > 4 lines** / **top padding > `pt-24`**.
- [ ] **> 4 text elements in hero** (eyebrow OR brand strip, headline, subtext, CTAs only).
- [ ] **"Used by/Trusted by" logo wall in hero** → separate section below.
- [ ] **Version labels** (`V0.6`, `BETA`) unless launch brief.
- [ ] **"Brand . No. 01" sub-eyebrows**.

## Eyebrow restraint
- [ ] **Eyebrow on every section** → max 1 per 3 sections. 9 sections → ≤3 eyebrows.
- [ ] **Section-number eyebrows** (`00 / INDEX`, `001 . Capabilities`) → plain language.
- [ ] **Micro-meta-sentences under eyebrows**.

## Content
- [ ] **Generic names** (John Doe, Acme, Nexus, SmartFlow) → realistic contextual.
- [ ] **Fake round numbers** (`99.99%`, `50%`) → organic messy (`47.2%`, `$99.00`).
- [ ] **AI cliches** (Elevate, Seamless, Unleash, Next-Gen, Game-changer, Delve, Tapestry, "In the world of...") → plain specific.
- [ ] **Exclamation marks in success** / **"Oops!" errors** → confident/direct.
- [ ] **Passive voice** / **Lorem Ipsum** / **Title Case every header** → active/real draft/sentence case.
- [ ] **Fake-precise numbers without justification** (`92%`, `4.1x`) → real data or label mock.

## Component
- [ ] **Generic card (border+shadow+white)** → remove border, or bg only, or spacing only. Cards only when elevation = hierarchy.
- [ ] **Always one filled + one ghost button** → add text links/tertiary.
- [ ] **Pill "New"/"Beta" badges** → square/flags/plain text.
- [ ] **Accordion FAQ** → side-by-side list, searchable help, inline disclosure.
- [ ] **3-card carousel testimonials with dots** → masonry wall, embedded posts, single rotating quote.
- [ ] **Modals for everything** → inline editing, slide-over, expandable.
- [ ] **Avatar circles exclusively** → squircles/rounded squares.
- [ ] **Footer link farm 4 columns** → main paths + legal.

## Iconography
- [ ] **Lucide/Feather exclusively** → Phosphor, Radix, Tabler, HugeIcons.
- [ ] **Cliche metaphors** (rocketship=Launch, shield=Security) → less obvious.
- [ ] **Inconsistent stroke widths** → standardize one weight.
- [ ] **Hand-rolled SVG paths** → use a library; missing glyph → install second or compose primitives.
- [ ] **Missing favicon** → always branded.

## Decoration
- [ ] **Scroll cues** ("Scroll", "↓ scroll", mouse-wheel icons).
- [ ] **Locale/city/time/weather strips** unless genuinely place-focused.
- [ ] **Version footers** (`v1.4.2`, `Build 0048`) on marketing/settings.
- [ ] **Decorative status dots** on every list/nav → real semantic state only, max 1/section.
- [ ] **Decoration text strip at hero bottom** (`BRAND. MOTION. SPATIAL.`).
- [ ] **Floating top-right sub-text in headings** / **pills overlaid on images** / **photo-credit as decoration**.
- [ ] **Scoring/progress bars with filled tracks as comparison**.
- [ ] **Middle-dot (`·`) overuse** → max 1/line, prefer line breaks/hairlines/columns.

## Motion
- [ ] **`linear`/`ease-in-out`** → `cubic-bezier(0.16, 1, 0.3, 1)`.
- [ ] **`scroll` event listener** → Motion `useScroll()`, GSAP ScrollTrigger, IntersectionObserver, CSS scroll-driven.
- [ ] **Animating `top/left/width/height`** → `transform` + `opacity` only.
- [ ] **`backdrop-blur` on scrolling containers** → fixed/sticky only.
- [ ] **Grain/noise on scrolling containers** → fixed `pointer-events-none` pseudo only.
- [ ] **Marquee > once per page** / **custom mouse cursors** / **neon outer glows by default** → inner borders/subtle tinted shadows.

## Image
- [ ] **Div-based fake screenshots** (fake terminal/dashboard/task list) → real screenshots, generated images, real component previews, or skip.
- [ ] **Broken Unsplash links** → `https://picsum.photos/seed/{desc-string}/w/h` or local assets.
