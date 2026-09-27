# Component Mapping: User data sync

> Spec: `docs/specs/user-data-sync.md` · Brief: `docs/intent/user-data-sync-design-brief.md` · Direction: spec-derived Settings section (all metaphor concepts rejected by owner). Every element maps to existing `src/shared/ui` components — no new presentation primitives.

## Surface: Settings → Sync section

New Settings navigation item `sync` (`icon: languages`) → `features/sync/ui/SyncSettingsSection` mounted inside the existing Settings shell. Layout primitives: `Section`, `Stack`, `Separator`, `SettingsRow`, `Text`, `Heading`.

| Element (spec function) | Component | Notes |
|---|---|---|
| Overall status line + last synced | `SettingsRow` + `StatusDot` + `Timestamp` + `Text` | "Protected / Needs attention" + relative time; semantic color `--color-success-subtle`, `--color-warning-subtle`, `--color-error-subtle` |
| Sync now | `Button` (secondary) `icon: rotateCcw` | Joins running cycle; disabled-offline shows state, not spinner |
| Provider list (registry-driven) | `Stack` of connect rows | One row per registered provider; v1 = Google Drive only |
| Connect button | `Button` | Google sign-in branding per REQ-3; the "G" mark is a bundled brand asset, exempt from `ICON_CATALOG` |
| Connection row | `SettingsRow` + `Badge` + `StatusDot` + `Text` | Email, provider name, connection state; badge copy "System storage"; one labeled action per non-healthy state |
| Connection actions | `IconButton` `icon: ellipsisVertical` → `Popover` | Sign in again / Disconnect entries |
| System connection selector | `Select` | Visible when ≥2 connections; triggers REQ-6 rebind-global flow |
| Profile row | `SettingsRow` + `FlagIcon` + `Badge` + `Select` | Target language name, destination selector (connections + "Only on this device"), scope state |
| Per-scope state label | `Badge` + `Text` | `local-only`, `waiting-connection`, `syncing`, `synced`, `warning`, `local-storage-full`, `disconnect-pending` — plain-language copy via i18n |
| Rebind confirm | `Dialog` + `RadioGroup` + `Progress` | Copy-before-switch explanation; progress determinate when bytes known (`icon: checkDouble` on verified) |
| Delete-old-copy decision | `Dialog` | Keep (default, `icon: check`) / Delete (`icon: trash`); separate decision from rebind confirm |
| Disconnect confirm | `Dialog` + `ListItem` stack | Lists profiles that stop syncing; destructive confirm `Button` `icon: power` |
| Restore / rebind progress | `Progress` + `Spinner` `icon: loader` | "Restoring dictionary" per REQ-11; bounded, no fake realtime |
| Offline / quota / re-auth notices | `Alert` (warning/error) + `Button` | Exactly one labeled action: Try again / Sign in again / Connect account |
| waiting-connection row | `Alert` + `Button` `icon: link` | "Connect <provider> <email>" per REQ-16 |
| Privacy notice | `Alert` (info) `icon: info` + `Collapsible` | What is stored, where, subtitle API keys named, how to disconnect |
| Empty (no profiles) | `EmptyState` + `Button` `icon: plus` | Explains prerequisite, one "Create language profile" path |
| First use (no connection) | `EmptyState` + connect `Button` | Pre-consent privacy summary adjacent to branded button |

## Copy / i18n

All strings new under `sync.*` in `en.json` + `vi.json` (NFR-8). Status labels follow Shared Interaction Rules: `Protected`, `Only on this device`, `Last synced …`, never technical enum names.

## Accessibility contract (carried from the audited mockup)

- `Dialog` focus enter/trap/Escape/restore — restore falls back to the row's trigger control when the original target unmounts.
- Destination `Select`/`RadioGroup` are native semantics (the mockup's fake-radio ARIA issue must not recur).
- Status = `StatusDot` + text label + `role="status"` where the row announces; never color-only.
- 44px touch targets on mobile; the section is readable at 320px with no horizontal scroll.

## Explicitly not built

- Conflict log UI (debug seam only, REQ-18)
- Journal/file/quota-in-bytes displays for healthy state
- Any concept-specific presentation (beacon field, topology canvas, passport spread)
