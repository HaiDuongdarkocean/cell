# Design Brief — anki-known-seed

> Spec: `docs/specs/anki-known-seed.md` · Mode: all (single justified variant) · ui_surface: yes

## Function audit

| Function | Feature (surface) | REQ |
|---|---|---|
| Represent "learning" status | 5th token color + chip + status-dot in vocabulary/popup/legend | REQ-1, REQ-9 |
| Show/control sync | Settings `sync` section: Anki status sync group — enable toggle, write-back toggle (gated), addon port input, Sync now button, last-sync line, addon indicator | REQ-8 |
| Signal degraded state | Inline hint (Alert/info) when addon absent; warning after ≥3 failures | REQ-8 alt/exception |

No new panels, no new nav — everything lands in existing surfaces. The only genuinely new visual asset is the `learning` status color.

## Design decision — `learning` color

Existing: unknown `#FF0033` (red), tracking `#FF9500` (orange), known `#00C853` (green), ignore `#8E8E93` (gray). `learning` sits between tracking and known semantically → **amber-yellow `#FFC107` family is too close to tracking orange**; instead use **blue `#3D8BFD`-family** — blue reads as "in progress / system working" in the existing palette vocabulary (primary/info hues), clearly distinct from orange tracking and green known, and survives red-green color blindness when paired with orange/green neighbors.

- `--color-token-status-learning: #3D8BFD` (light), `#6BA5FF` (dark — lighter for contrast on dark bg)
- `--color-token-status-learning-bg`: `color-mix(...14%)` pattern identical to siblings
- `chip-status.learning-bg/-fg` entries mirroring tracking

## Layout — Settings → Sync section (new group)

Existing section card pattern (`sectionCard` + `SettingsRow dense`) inside `data-section="sync"`:

```
┌─ Anki status sync ─────────────────────────────┐
│ Enabled                                    [o] │
│ Write back 'known' to Anki                   [o] │  ← disabled + hint when Enabled off
│   ⓘ Marks matching Anki cards mature (ivl≥21). │
│     Review carefully — modifies your collection.│
│ Addon port        [ 8766 ]                     │
│ ────────────────────────────────────────────── │
│ Addon  ● connected / ○ not installed  [Sync now]│
│ Last sync 12:34 · 12 updated · 0 errors        │
│ ⓘ Addon not installed — sync runs via 5-min    │
│   poll. Install for near-realtime updates.     │
└────────────────────────────────────────────────┘
```

## Vocabulary/status surfaces

- Status chip/dots render `learning` with the blue token — no layout change, pure color addition.
- Vocabulary filter menu gains a `Learning` option between Tracking and Known.
- Dictionary popup footer status control cycles `… → tracking → learning → known → …`; status-key hint row adds `5`.

## i18n

New keys under `settings.ankiStatusSync.*` + `wordStatus.learning` label, en+vi.

## ASCII — status legend row (vocabulary chips)

```
[Unknown 12] [Tracking 8] [Learning 5] [Known 240] [Ignore 3]
   red          orange       blue        green        gray
```
