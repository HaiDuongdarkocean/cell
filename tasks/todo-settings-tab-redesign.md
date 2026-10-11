# Todo — settings-tab-redesign

- [ ] S1 shell: 13 × Card.sectionCard → SettingsSection (refs/data-section preserved)
- [ ] S1 rows: toggle/select rows → canonical SettingsRow (title/description/labelFor); hints → visible descriptions
- [ ] S1 groups: download groups + childField → SettingsGroup + child; shortcuts → SettingsGroup
- [ ] S1 css: mainCol gap→0; drop cardHeader/cardTitle/cardDesc/cardBody/sectionCard/rowLabel/download*/childField/groupLabel dead styles
- [ ] S2 panels: LanguageProfilePanel (banner + selectable rows stay; labels/links → tokens + SettingsGroup + Button link)
- [ ] S2 panels: ResourcesPanel (group labels → SettingsGroup; gap normalize; keep draggable Cards)
- [ ] S2 panels: DictionaryPopupSettingsPanel + DictLinksManager (timeline labels → SettingsGroup; nested boxes → detail recipe)
- [ ] S2 panels: WordBadgeSettingsPanel (preview → shared detail-box recipe)
- [ ] S2 panels: AudioPanel + TtsLanguagePanel (group labels → SettingsGroup; source detail box normalize)
- [ ] S2 panels: SyncPanel (fix missing body wrapper; rows → SettingsRow) + AnkiStatusSyncPanel + ThemePanel (h2 → group label)
- [ ] S3 css: purge dead styles in touched panel CSS; hardcoded literals → tokens
- [ ] S4 i18n: any new visible-description keys (en + vi)
- [ ] S5 gates: check-design-system-css + typecheck + lint + test:unit + build
- [ ] S5 verify: live panel <600px + desktop + dialog ≥768px, light/dark, after-shots vs baseline
- [ ] S5 review: fresh-context verify artifact → VERDICT
- [ ] S5 ship: delete mockup dir, update docs (2-architechture-system, 0-wiki), commit, transition → shipped
