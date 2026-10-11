# Plan — settings-tab-redesign (deliver)

Spec: `docs/specs/settings-tab-redesign.md` · Brief: `docs/intent/settings-tab-redesign-design-brief.md` · Mapping: `docs/intent/settings-tab-redesign-component-mapping.md` · Design review: `docs/reviews/settings-tab-redesign-design.md` (PASS)

Direction: "Flat bands, labeled groups". One section anatomy (`SettingsSection`), one group recipe (`SettingsGroup`), canonical `SettingsRow` (title + visible description + control edge, `child` for conditional fields). Hints promote to visible descriptions where the text explains the setting; ⓘ stays for tangential cross-references (section-level saveHint, wordBadge hint).

## Slices (thin, verified)

1. **Shell** — `SettingsDialogContent.tsx`: all 13 `Card.sectionCard` → `SettingsSection` (forwarded ref → `sectionRefs`, `data-section`, `headingLevel={4}`, title/description/hint props). `.mainCol` gap → 0 so `.section + .section` hairline owns rhythm. Toggle rows → canonical `SettingsRow` props; hint text → `description`. Download groups → `SettingsGroup`; `.childField` → `child` prop. Shortcut groups → `SettingsGroup` + keep 2-col responsive grid.
2. **Embedded panels** — LanguageProfilePanel, ResourcesPanel, DictionaryPopupSettingsPanel, DictLinksManager, WordBadgeSettingsPanel, AudioPanel, TtsLanguagePanel, SyncPanel, AnkiStatusSyncPanel, ThemePanel: label dialects (`downloadGroupTitle`, `groupLabel`, `SectionHeader`, raw `h2`, `sectionTitle`, `timelineLabel`) → `SettingsGroup`; ad-hoc rows → `SettingsRow`; nested-box chrome → field-surface detail recipe; fix `SyncPanel` missing body wrapper; token violations → tokens.
3. **CSS cleanup** — delete dead classes in `SettingsDialog.module.css` + panel CSS (`rowLabel`, `cardHeader/cardTitle/cardDesc/cardBody`, `downloadCardBody/downloadGroup/downloadGroupTitle`, `childField`, `groupLabel`, `shortcut*` leftovers); remove hardcoded literals in touched files.
4. **i18n** — reuse existing `.hint` strings as descriptions; add keys only where a visible description has no existing string (en + vi).
5. **Gates + verify** — `check-design-system-css`, typecheck, lint, `test:unit`, build → live verify (panel <600px, desktop, dialog ≥768px sidebar, light/dark) with after-shots → fresh-context verify artifact → ship.

## Invariants (AC-traced)

- 13 sections, same order/IDs/`data-section`/`sectionRefs`/scroll-sync; Navigation untouched.
- Both surfaces: `SettingsTab` (panel, horizontal nav) + `SettingsDialogContent` standalone (sidebar ≥768px).
- No behavior/storage/persistence changes; all strings i18n; tokens only; reduced-motion respected.
