# Keyboard Shortcuts — Component Mapping

## Chosen concept
**Real panel (revised)** — the shipped keyboard-shortcuts card with the following interaction & layout changes:

- Label sits **above** the shortcut pill, not beside it.
- **1 column on mobile**, **2 columns on desktop** inside each group.
- Input pill stretches the **full width of its column/card**.
- A **red conflict dot** appears when two actions share the same key (same key + modifiers).
- Group headers, default data shape, and shortcut semantics are preserved.

This is the safest path: it keeps the existing `ShortcutInput` atom and the
settings persistence model, only updating the layout and adding conflict
feedback.

## Production components

| Production component | Decision | Notes |
|---|---|---|
| `Card` (`@/shared/ui/Card`) | **Reuse** | The `Keyboard Shortcuts` card already provides `cardHeader` and `cardBody` slots. |
| `Heading` / `Text` | **Reuse** | `Heading level={4}` for the card title, `Text` for the description. |
| `VStack` (`@/shared/ui/VStack`) | **Reuse** | `columns={2} responsive gap="2"` creates the mobile 1-col / desktop 2-col group grid. |
| `ShortcutInput` (`@/shared/ui/ShortcutInput`) | **Reuse** | No behavior changes; full width is achieved via CSS, not the atom. |
| `<label>` + `rowLabel` | **Reuse** | Native label, unchanged. |
| `ConflictDot` | **New local + optional shared later** | A small `<span>` with a tooltip. Inline in `SettingsDialogContent` for now; promote to `@/shared/ui` only if other settings surfaces need it. |
| `shortcutConflicts` utility | **New** | `src/entities/settings/lib/shortcutConflicts.ts` exposes `isShortcutConflict(shortcuts, action)` and `shortcutSignature(value)` for consistent conflict detection. |
| `SettingsDialog.module.css` | **Extend** | Adds vertical field layout, full-width pill, and conflict-dot styling. |

## Mockup to production mapping

- The mockup `RealPanel` in `src/entrypoints/mockup-keyboard-shortcuts/real.tsx` becomes the production `SettingsDialogContent.tsx` keyboard-shortcuts section.
- The `mksRealField`, `mksRealGrid`, and `mksConflictDot` CSS rules in `mockup.module.css` are translated to `.shortcutField`, `.shortcutSection`, and `.conflictDot` rules in `SettingsDialog.module.css`.
- `src/entrypoints/mockup-keyboard-shortcuts/mockData.ts` conflict helpers are moved to `src/entities/settings/lib/shortcutConflicts.ts` so production and tests can share them.

## Anti-patterns avoided

- No new settings data shape — `KeyboardShortcut` stays unchanged.
- No new shortcut event handler — the existing `subtitleShortcuts.ts` matching logic is unchanged.
- No duplicate component for `ShortcutInput` — the existing atom is reused.
- No hardcoded values — layout uses token CSS; only a small conflict utility is added.
