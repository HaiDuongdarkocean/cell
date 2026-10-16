# Design Brief — ai-bridge-dictionary

Slug: `ai-bridge-dictionary` · Mode: `all` · Spec: `docs/specs/ai-bridge-dictionary.md`

## Goal

Give the learner an AI answer inside the dictionary popup — word nuance, sentence breakdown, AI translation — without leaving the lookup flow, and let them control provider + prompts.

## Design variant (single, `all` mode)

**Variant A — "inline answer surface"**: AI lives as two new toolbar pills (`ai` at position 4, `breakdown` at 5) plus an engine toggle inside the existing translate tab. Chosen because:

- Matches the reference screenshots the user approved (pill toolbar + small action pills inside the answer view).
- Reuses the existing toolbar pill mechanism (feature-local) — zero new navigation concepts.
- Provider picking is a pill row inside the answer view (the user's screenshot pattern), not a dropdown — providers are few (4), pills are one-tap, and the pill doubles as the failover status indicator.

Rejected alternatives: single AI mega-tab with mode switch (hides breakdown behind a second click; the user explicitly asked for a separate tab); dropdown provider picker (extra click, hides failover state).

## Screens

### 1. AI tab (`dict.ai`) — word explanation

```
┌─────────────────────────────────────────────┐
│ [audio][image][translate][ai][breakdown][links][pronunciation] │  toolbar pills
├─────────────────────────────────────────────┤
│ "term"  ·  sentence context (1 line clamp)  │  Header caption
│ ┌─ providers ────────────────────────────┐  │
│ │ (●ChatGPT) ( Gemini ) ( DeepSeek ) ( Claude ) │  pill row — active=default/marked
│ └────────────────────────────────────────┘  │
│ ┌─ answer ───────────────────────────────┐  │
│ │ The word carries a nuance of ...        │  │  answer body (streaming skeleton → text)
│ │                                         │  │
│ │ ──────────────────────────────────────  │  │
│ │ sourced from ChatGPT        [↻ retry]   │  │  attribution + retry
│ └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
States: idle (auto-asks on open) → loading (Skeleton lines) → answered
       → error (EmptyState + retry Button) | provider-busy pill dimmed
```

### 2. Breakdown tab (`dict.breakdown`)

Same shell as the AI tab — provider pill row + answer body — body renders the numbered `#1 chunk / #2 meaning / #3 explanation` output verbatim (no structured parsing this iteration).

### 3. Translate tab — engine toggle

Inside the existing translate panel, above the translation block: a `SegmentedControl` with `Google | AI`. AI selection runs the translation prompt through the provider bridge and replaces the body; switching back restores the Google result from cache. The pick persists as the settings default.

### 4. Settings — "AI bridge" section

```
AI bridge ────────────────────────────────
Auto-explain on dictionary miss      [Toggle]
Translation engine             [Google|AI] SegmentedControl
Default provider               [ChatGPT ▾] Select
Failover order        ChatGPT ▸ Gemini ▸ DeepSeek ▸ Claude
                      (row of chips with ←/→ IconButton move)

Custom AI prompts ─────────────────────────
Feature   [Word explain|Breakdown|Translate] SegmentedControl
System prompt   [Textarea……………]
User prompt     [Textarea……………]
              [Reset to default] [Save]     Button outline/primary
```

Provider order editing: `MoveHorizontal` chips with left/right `IconButton`s — smallest control that expresses an ordered list without a drag library.

## Component mapping (canonical only)

| Surface | Component | Notes |
|---|---|---|
| Toolbar pills | feature-local toolbar + `Chip` pills | add `ai`, `breakdown` entries |
| Provider pill row | `Chip` (selected state) + `StatusDot` | status dot = ok/busy/error |
| Answer body | `Surface` + `Text` | mono-free, body-size token |
| Loading | `Skeleton` lines | mirrors TranslatePanel pattern |
| Error | `EmptyState` + `Button` retry | mirrors TranslatePanel error path |
| Retry | `IconButton` icon:`rotateCcw` + `Tooltip` | |
| Engine toggle | `SegmentedControl` | Google \| AI |
| Settings rows | `SettingsSection` + `SettingsRow` + `Toggle` + `Select` + `SegmentedControl` + `Textarea` + `Button` | canonical settings layout |
| Order editor | `Chip` + `IconButton` icons `chevronLeft`/`chevronRight` | no drag lib |
| Toast on all-fail | `Toast` | "all providers failed" |

## Icons (ICON_CATALOG)

- `ai` tab → icon: `atom`
- `breakdown` tab → icon: `scanText`
- retry → icon: `rotateCcw`
- provider status → `StatusDot` (no icon)
- settings section → icon: `zap` (optional header glyph)

## Tokens

- Answer surface bg → `color-surface-card`
- Attribution caption → `color-text-muted` + `component.button.font-size-sm`
- Provider pill selected → `component.button.bg` / `component.button.fg`
- Skeleton → `color-skeleton`
- Gap/radius → `component.button.radius`, `component.chip.height`

## Behavior notes

- Single-flight: provider pills + retry disabled while `awaitingReply`.
- Failover: failing provider pill flashes error status, chain continues; terminal = `EmptyState` + retry.
- Attribution always names the provider that answered (REQ-8 step 3).
- i18n: all strings via `t()` keys under `dict.ai.*`, `settings.ai.*`.

## Acceptance hooks

- SC-1/2 → screen 1 + auto-open wiring.
- SC-3 → screen 2.
- SC-4 → screen 3.
- SC-7/8/9 → provider pill row + retry + failover status.
- SC-6/10 → screen 4.
