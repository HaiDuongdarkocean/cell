# ADR-072: Component reuse — media cards and settings dialog migrate to shared atoms

## Status

Accepted — implemented 2026-07-22.

## Context

`VideoCard`, `SubtitleCard`, and `DownloadCard` in `src/entrypoints/popup/components/media/` each implemented their own card surface (background, border, radius, hover, selected, and downloading states). `SettingsDialog` in `src/features/settings/ui/` also implemented its own overlay, popover, focus handling, and Escape behavior. This duplicated design-system logic already present in `src/shared/ui/Card` and `src/shared/ui/Dialog`.

## Decision

1. Wrap `VideoCard`, `SubtitleCard`, and `DownloadCard` with the shared `Card` atom from `@/shared/ui/Card`.
   - Use `variant="interactive"` for selectable cards and `variant="selected"` when selected.
   - Use `variant="default"` for `DownloadCard` and for non-interactive states.
   - Override `--card-bg` and `--card-padding` locally so each card keeps its internal layout without duplicating surface/radius/border logic.
2. Migrate `SettingsDialog` to the shared `Dialog` atom from `@/shared/ui/Dialog`.
   - Use `title`, `showCloseButton`, and `onOpenChange` props.
   - Remove the custom overlay, popover, Escape listener, and close-button focus logic; `Dialog` already provides focus trap, overlay click, and Escape handling.

## Consequences

- Surface, border, radius, and shadow now come from one source (`Card.module.css` / `Dialog.module.css`).
- Card state variants (selected, interactive, error, queued) are expressed as token overrides and local state classes instead of duplicating base card styles.
- Settings dialog gains built-in focus trap and consistent close behavior.
- Future card/dialog design changes apply to all consumers automatically.
