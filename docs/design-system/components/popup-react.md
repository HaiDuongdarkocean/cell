# Popup React Components — Cell Extension

> Location: `src/shared/ui/` + `src/features/settings/ui/`

## Inventory

| Component | File | Status | Since | Variants | States | a11y | Used in |
|---|---|---|---|---|---|---|---|
| IconButton | `src/shared/ui/IconButton.tsx` | stable | 1.0.0 | variant, size | default/hover/focus/disabled | aria-label required | Header, SelectionBar |
| MultiSelect | `src/features/settings/ui/MultiSelect.tsx` | stable | 1.1.0 | — | open/closed | role=listbox, aria-selected | SettingsDialog |
| SettingsDialog | `src/features/settings/ui/SettingsDialog.tsx` | stable | 1.0.0 | — | open/closed | role=dialog, focus trap | App |
| SubtitlePreview | `src/features/settings/ui/SubtitlePreview.tsx` | stable | 1.1.0 | role: target/native | — | aria-label | SubtitleStylePanel |
| SubtitleStylePanel | `src/features/settings/ui/SubtitleStylePanel.tsx` | stable | 1.1.0 | — | — | label htmlFor | SettingsDialog |
| NavClusterSettingsPanel | `src/features/settings/ui/NavClusterSettingsPanel.tsx` | stable | 1.2.0 | — | — | label htmlFor | SettingsDialog |

---

## Usage guide — do/don't + code examples

### IconButton (`src/shared/ui/IconButton.tsx`)

| Do | Don't |
|---|---|
| Always pass `aria-label` (icon-only) or visible text | Use without `aria-label` when icon-only — screen reader gets no name |
| Use `variant` + `size` props for visual variants | Override styles with inline `style` to "customize" — breaks token contract |
| Use for icon-triggered actions (toggle, open, close) | Use for primary navigation CTA — use a real `<Button>` with text instead |

```tsx
<IconButton
  icon={<CloseIcon />}
  aria-label="Close dialog"
  variant="default"
  size="md"
  onClick={onClose}
/>
```

### MultiSelect (`src/features/settings/ui/MultiSelect.tsx`)

| Do | Don't |
|---|---|
| Pass `options` as `{ value: string; label: string }[]` | Pass raw string array — loses label/value distinction |
| Handle `onChange` returning `string[]` (selected values) | Read DOM state directly — bypasses controlled component contract |
| Use inside a labeled field container (`<label>` + `id`) | Use without label — screen reader cannot associate the listbox |

```tsx
<label id="lang-label">Subtitle languages</label>
<MultiSelect
  options={[{ value: 'en', label: 'English' }, { value: 'vi', label: 'Vietnamese' }]}
  value={selected}
  onChange={setSelected}
  aria-labelledby="lang-label"
/>
```

### SettingsDialog (`src/features/settings/ui/SettingsDialog.tsx`)

| Do | Don't |
|---|---|
| Use as the single settings entry (modal overlay) | Nest a second SettingsDialog inside — use a sub-panel instead |
| Let it own focus trap + Escape-to-close (built-in) | Re-implement focus management outside — double trap breaks keyboard nav |
| Compose content via children (SubtitleStylePanel, NavClusterSettingsPanel) | Pass content via props string — loses React composition |

```tsx
<SettingsDialog open={isOpen} onClose={() => setOpen(false)}>
  <SubtitleStylePanel />
  <NavClusterSettingsPanel />
</SettingsDialog>
```
