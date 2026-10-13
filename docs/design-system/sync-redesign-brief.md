# Sync area redesign — brief

Mockup: `src/entrypoints/mockup-sync-redesign/` → served by `npm run dev` at
`/src/entrypoints/mockup-sync-redesign/index.html`
(query params: `?layout=split|single&drive=empty|connected|syncing|reauth|offline|full|error&anki=off|never|idle|syncing|error&w=settings|narrow&theme=light|dark`).

## Problem

The settings nav has one "Sync" item that renders two unrelated systems stacked
in a single `SettingsSection`:

1. **Google Drive sync** — cloud backup of user data (`SyncPanel`).
2. **Anki status sync** — a live bridge mirroring word statuses between the
   extension, Tihoka SRS and Anki (`AnkiStatusSyncPanel`).

There is no visible divider between them, so a first-time user reads them as
one system. The Anki block also inverts its information hierarchy: the toggles
("Sync word status", "Write back to Anki") and the bridge port come first,
while the answer to "what happened?" (last sync summary, errors) sits at the
bottom. Statistics are text-only — no visual sense of volume or failures.
A global `text-align: center` leak also centers group labels.

## Chosen layout — two nav pages (recommended)

**Option A (recommended): split into two nav items.** "Cloud backup" (icon
`repeat`) and "Anki sync" (icon `windowPage`) become separate settings
sections/pages. Rationale:

- They are different systems with different mental models — backup ("my data
  is safe") vs. a live bridge ("my decks stay in step"). Two names in the nav
  teach the difference before the user opens either page.
- Each page gets its own status hero and its own failure modes; errors for one
  system never sit next to controls of the other.
- The sidebar already scroll-syncs sections; adding a nav entry is a small
  change to `SettingsDialogContent` (one more `SettingsSection` + nav item).

**Option B (shown for comparison): one "Sync" page** that renders two separate
`SettingsSection` cards with an explicit full-width hairline divider
(`.msrDivider`) between them — each card titled "Cloud backup — Google Drive"
and "Anki sync". This is the minimal fix: the card boundary + rule + distinct
titles make the separation unmistakable, but the page is long and both systems'
errors compete for attention.

Toggle between A and B in the mockup header. A is the recommendation.

## Information hierarchy per block

### Cloud backup (Drive)

1. **Status hero** — always first: `StatusDot` + one-word state ("Protected",
   "Syncing…", "Sign-in needed", "Offline", "Cloud storage full") + a
   plain-language line answering *what it does and what to do next* + the
   single primary action on the right (Connect / Sync now / Sign in / Try
   again). Warning/error heroes get a subtle tinted surface
   (`--color-warning-subtle` / `--color-error-subtle`), not banners.
2. **Activity chart** — "Backup activity — last 14 days" bar chart with totals
   ("N items synced · 0 errors").
3. **Connected accounts** — group list with system badge + actions.
4. **Advanced** (muted disclosure) — per-language-profile sync destination
   selects, the least-frequently-touched config.
5. **Empty state** — numbered 3-step "how it works" (Connect → private copy →
   protected) so a new user knows where they are before connecting.

### Anki sync

Info first, config last — because config only matters before the first run:

1. **Status hero** — `StatusDot` + state ("Up to date", "Ready to sync",
   "Syncing…", "Sync failed", "Anki sync is off") + what was synced / what is
   syncing / what went wrong and what to do + Sync now / Try again / Turn on.
   Syncing shows an inline progress bar.
2. **Bridge status line** — small `StatusDot` row: "Tihoka Bridge add-on
   connected / not detected — using slower polling" + last-synced time. This
   is sync *info*, so it stays above the fold, not inside the accordion.
3. **Stats charts** — donut for the last run (unchanged / updated / errors)
   with legend, plus a sparkline of "words updated per sync" (and an error
   sparkline in the error state).
4. **"Setup & advanced"** disclosure — the three config rows from production
   ("Sync word status", "Write back to Anki", bridge port + fallback note)
   live here, collapsed by default once sync works. The trigger line carries a
   status summary ("Sync is on · port 8766") so users can verify config
   without opening it.
5. **Off state** — hero offers "Turn on sync" as the only action; charts are
   replaced by a dashed placeholder telling users charts appear after the
   first sync.

## Chart choices (hand-rolled, zero dependencies)

All charts are inline SVG in `Charts.tsx`, colored exclusively with tokens
(`--color-primary`, `--color-error`, `--color-data-neutral`, `--color-field`):

- **Bars** — daily backup volume; small multiples, last bar accented. Chosen
  over a line because daily counts are discrete events.
- **Donut** (42×42 viewBox, `stroke-dasharray` segments) — last Anki run
  breakdown; the center carries the card count so the number doubles as the
  headline stat.
- **Sparkline** (polyline + subtle area fill + end dot) — per-sync trend;
  compact enough to sit beside the donut. A second error-tone sparkline
  appears only when errors exist.
- Every chart has `role="img"` + `aria-label` summarizing the data.

## States covered

| System | States |
|---|---|
| Drive | `empty` (steps + connect), `connected`, `syncing`, `reauth` (sign-in CTA), `offline`, `full` (storage), `error` (load failure) |
| Anki | `off` (turn-on CTA), `never` (first-run guidance), `idle` (stats), `syncing` (progress), `error` (failing + add-on absent) |

Connect/Sync-now buttons simulate the real flow (`empty → syncing → connected`,
`idle → syncing → idle`) so the mockup is interactive end-to-end.

## Style constraints honored

- Tokens only — no hardcoded colors/spacing.
- Flat disclosure triggers via the same override recipe production uses
  (`SyncPanel.module.css` `.flat` → `.msrFlat`): transparent background, no
  border, no ripple, secondary color, left-aligned.
- No heavy solid blocks: status heroes are bordered cards with subtle tinted
  backgrounds only for warn/error/info.
- `text-align: start` applied to labels/rows/heroes — models the fix for the
  global `text-align: center` leak.
- Responsive: at ~360px the sidebar collapses to an icon rail, the stats grid
  stacks, and the hero action wraps below the text — no clipping.
- Transient notifications (sync failures from actions) stay on `Toast` — the
  sections themselves hold no inline banners.

## File map to real implementation

| Mockup | Production touch points |
|---|---|
| `DriveSyncBlock.tsx` | `src/features/sync/ui/SyncPanel.tsx` (+ `.module.css`) — reorder into hero → chart → accounts → Advanced |
| `AnkiSyncBlock.tsx` | `src/features/ankiStatusSync/ui/AnkiStatusSyncPanel.tsx` (+ `.module.css`) — move `lastSyncAt` summary + addon status to top, toggles/port into "Setup & advanced" accordion |
| `Charts.tsx` | new `src/features/*/ui/charts/` or `src/shared/ui/` primitives (Sparkline/Donut/Bars) — hand-rolled SVG, no deps |
| `main.tsx` nav simulation | `SettingsDialogContent.tsx` — split `nav 'sync'` into `'cloud-backup'` + `'anki-sync'` (Option A) or add `.msrDivider` between the two panels (Option B) |
| `mockData.ts` | mirrors `SyncStatusView` / `AnkiStatusSyncState` fields (`lastSyncAt`, `changed`, `errors`, `addonOnline`, `consecutiveFailures`) |

## Open constraints / needs

- No `cloud`/`database` icon in `ICON_CATALOG` — mockup reuses `repeat` for
  cloud backup and `windowPage` for Anki (both already used for these blocks).
  A dedicated cloud icon would need a catalog addition.
- Stats need a small per-day/per-run history store; current entities only keep
  last-run counters (`changed`, `errors`, `cardsSeen`). Implementation would
  persist a ring buffer (~14–30 entries) alongside `AnkiStatusSyncState`.
- `Text` has no `error`/`warning` color variants — mockup colors status text
  via CSS classes (same approach as production `.statusWarn`).
