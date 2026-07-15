# Todo — Align src components to DS showcase

## Phase 1: Token foundation + core form components
- [x] 1. Fix theme.css tokens (radius md 8→18, lg 12→10, add xl/2xl, shadow→none, add primary-active/success-subtle/warning-subtle, fix error-subtle alpha)
- [x] 2. Button.module.css — radius var, focus→outline, remove box-shadow transition
- [x] 3. Input + Textarea — focus→outline, radius var

## Phase 2: Rest of shared/ui form components
- [x] 4. Select + SearchableSelect — focus→outline, shadow→none
- [x] 5. Checkbox + Radio + Toggle — focus→outline
- [x] 6. Slider + ShortcutInput — shadow→none, focus→outline

## Phase 3: shared/ui display/container components
- [x] 7. Card — shadow→none, radius var
- [x] 8. Dialog + Drawer + BottomSheet — shadow→none, radius var
- [x] 9. Accordion + Tabs + NavItem + ListItem — focus→outline
- [x] 10. Badge + Alert + Tooltip + Header + HintIcon — shadow→none, radius var
- [x] 11. Progress + Spinner + Skeleton + EmptyState + Sidebar — shadow→none

## Phase 4: Feature components part 1
- [x] 12. CardCreatorDialog + FieldRow + MediaList + PreviewBlock
- [x] 13. DeleteConfirmModal + Dropzone + ImportProgress + ResourceCard + ResourcesPanel

## Phase 5: Feature components part 2
- [x] 14. SettingsDialog + MultiSelect + CardCreatorSettingsPanel + NavClusterSettingsPanel
- [x] 15. SubtitleBlockSettingsPanel + SubtitlePreview + SubtitleStylePanel
- [x] 16. ThemePanel + ColorCustomization + ContrastBadges + ModeCards + ThemeImportExport + ThemePreview
- [x] 17. App.redesigned + SelectionBar + Header + DownloadCard + MediaEmpty + SubtitleCard + VideoCard
- [x] 18. OptionsApp + SidebarItem + sidepanel App + CueList

## Phase 6: Final audit + report
- [x] 19. Token audit — grep hardcode→0
- [x] 20. Browser verify (dark + light)
- [x] 21. Báo cáo component DS không cover → xem `tasks/report.md`
