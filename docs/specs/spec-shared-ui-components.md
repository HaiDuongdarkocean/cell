# Spec: Shared UI Components (Phase 2)

## Objective

Complete the shared UI component library in `src/shared/ui/` and migrate all existing UI surfaces to use it. The goal is one visual language across popup, options, sidepanel, settings dialog, and theme panels: one `Button`, one `Input`, one `Card`, etc. No custom button styles per feature, no GitHub-dark tokens, no raw hex values outside token definitions.

**User impact:** UI looks and behaves consistently across the extension; new screens can be built by composing `src/shared/ui` components.

**Success criteria:**
- Every interactive element in `OptionsApp`, `ThemePanel`, `ResourcesPanel`, `SettingsDialog`, `App.redesigned`, `VideoCard`, `SubtitleCard`, `DownloadCard`, and `MediaEmpty` uses a shared component or semantic token.
- No `--color-snow`, `--color-slate-edge`, `--font-mona-sans`, `--text-*`, `--spacing-*` legacy tokens in `src/` (except ADR-022 reference files).
- `npm run typecheck` and `npx jest --selectProjects unit` pass.
- New components have colocated `.test.tsx` files.

## Tech Stack

- React 19 + TypeScript strict
- CSS Modules (Vite)
- Vite + CRXJS
- Jest + React Testing Library
- Design tokens from `src/entrypoints/popup/styles/theme.css` and `themeManager.ts`

## Commands

```bash
# Dev
npm run dev

# Unit tests
npx jest --selectProjects unit --passWithNoTests

# Typecheck
npm run typecheck

# Lint on affected src
npx eslint src/shared/ui/ src/entrypoints/ src/features/theme/ src/features/dictionary/ src/features/settings/
```

## Project Structure

```
src/shared/ui/
├── index.ts
├── Button.tsx + .module.css + .test.tsx        # Existing
├── Card.tsx + .module.css + .test.tsx          # Existing
├── Dialog.tsx + .module.css + .test.tsx        # Existing
├── Input.tsx + .module.css + .test.tsx         # Existing
├── IconButton.tsx + .module.css + .test.tsx    # Existing
├── Toggle.tsx + .module.css + .test.tsx        # Existing
├── Slider.tsx + .module.css + .test.tsx        # Existing
├── SearchableSelect.tsx + .module.css + .test.tsx  # Existing
├── HintIcon.tsx + .module.css + .test.tsx      # Existing
├── ShortcutInput.tsx + .module.css + .test.tsx # Existing
└── [new components below]
    ├── Checkbox.tsx + .module.css + .test.tsx
    ├── Radio.tsx + .module.css + .test.tsx
    ├── Textarea.tsx + .module.css + .test.tsx
    ├── Select.tsx + .module.css + .test.tsx
    ├── Badge.tsx + .module.css + .test.tsx
    ├── Label.tsx + .module.css + .test.tsx
    ├── Spinner.tsx + .module.css + .test.tsx
    ├── Skeleton.tsx + .module.css + .test.tsx
    ├── Progress.tsx + .module.css + .test.tsx
    ├── Tooltip.tsx + .module.css + .test.tsx
    ├── InputField.tsx + .module.css + .test.tsx
    ├── FormGroup.tsx + .module.css + .test.tsx
    ├── CheckboxGroup.tsx + .module.css + .test.tsx
    ├── RadioGroup.tsx + .module.css + .test.tsx
    ├── SearchField.tsx + .module.css + .test.tsx
    ├── Alert.tsx + .module.css + .test.tsx
    ├── EmptyState.tsx + .module.css + .test.tsx
    ├── ListItem.tsx + .module.css + .test.tsx
    ├── NavItem.tsx + .module.css + .test.tsx
    ├── Tabs.tsx + .module.css + .test.tsx
    ├── Accordion.tsx + .module.css + .test.tsx
    ├── Header.tsx + .module.css + .test.tsx
    ├── Sidebar.tsx + .module.css + .test.tsx
    └── Drawer.tsx + .module.css + .test.tsx
```

## Code Style

```tsx
// Named export, function component, forwardRef when needed
export function InputField({ id, label, error, ...rest }: InputFieldProps): React.JSX.Element {
  return (
    <div className={styles.root}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} error={!!error} aria-describedby={error ? `${id}-error` : undefined} {...rest} />
      {error && <span id={`${id}-error`} className={styles.error} role="alert">{error}</span>}
    </div>
  );
}
```

- Use semantic tokens only: `var(--color-primary)`, `var(--color-surface)`, `var(--space-3)`, `var(--radius-md)`, etc.
- No raw hex, rgba, or hardcoded font values in feature CSS.
- Colocate tests: `Component.tsx` → `Component.test.tsx`.
- Default export forbidden; use named exports.
- Compound components are allowed when they improve DX (e.g. `Tabs.List`, `Tabs.Trigger`, `Tabs.Content`).

## Testing Strategy

- **Unit:** each component has `*.test.tsx` using React Testing Library.
- **Integration:** `tests/unit/entrypoints/options/OptionsApp.test.tsx` and `tests/unit/features/settings/ui/SettingsDialogShortcuts.test.tsx` are updated to verify shared UI usage.
- **Visual regression:** manual browser check via `npm run dev` + Chrome for popup/options/sidepanel.
- **Token audit:** `grep -R "rgba(255,255,255" src/` and `grep -R "#0d1117\|#151a22\|#21262d" src/` must return 0 after migration.

## Boundaries

- **Always:** run `npx jest --selectProjects unit --passWithNoTests` and `npm run typecheck` before finishing a task.
- **Always:** update `docs/2-architechture-system.md` tree when adding/removing files.
- **Ask first:** adding new dependencies (this phase adds none).
- **Never:** commit raw hex values, use custom per-feature button styles, or remove existing tests without approval.

## Data Contract

Components are presentational; props are typed inline. No runtime Zod needed unless a component accepts serialized data. Example:

```typescript
interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  error?: boolean;
  helperText?: ReactNode;
}
```

## Current State

- Built: `Button`, `Card`, `Dialog`, `Input`, `IconButton`, `Toggle`, `Slider`, `SearchableSelect`, `HintIcon`, `ShortcutInput`.
- Migrated: `OptionsApp`, `SidebarItem`, `ResourceCard`, `Dropzone`, `ImportProgress`, `DeleteConfirmModal`, `ResourcesPanel`, `ThemePanel`, `App.redesigned` (Select/Download buttons).
- Not yet migrated: `ColorCustomization`, `ThemePreview`, `ModeCards`, `ContrastBadges`, `ThemeImportExport`, `SettingsDialog`, `MediaEmpty`, `Header`, `VideoCard`, `SubtitleCard`, `DownloadCard`.
- Not yet built: all remaining atoms/molecules/organisms listed in Project Structure.

## Open Questions

- Should `Header`/`Sidebar` be generic layout primitives or extension-specific chrome (logo, back button)?
- Should `Select` be a plain `<select>` wrapper or the existing `SearchableSelect` renamed?
- Do we need `DataTable` now, or can it wait until a list/table feature is required?
