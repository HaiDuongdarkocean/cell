# Todo — up-settings-subnav

- [x] Read spec, design brief, mapping, reviews; check git status
- [x] NavItem.module.css: unhide `.horizontal .label`, restore padding/gap, scope ellipsis to `.vertical`
- [x] Navigation.module.css: `.navWrap`, `.arrow`, `.fadeStart`/`.fadeEnd`, `overscroll-behavior-x`
- [x] Navigation.tsx: horizontal wrapper + edge state machine + chevron Buttons + fades
- [x] SettingsDialogContent.tsx: `<768px` cutoff via `SIDEBAR_LABEL_MIN_WIDTH`, drop BREAKPOINTS import
- [x] Navigation.test.tsx: overflow-affordance cases (5 new tests)
- [x] SettingsDialogContent.test.tsx: orientation cutoff cases (2 new tests)
- [x] typecheck + lint pass (0 errors; 4 pre-existing warnings in unrelated srs files)
- [x] test:unit pass — 682 suites / 8081 tests
- [x] build pass (incl. check-design-system-css:features — 0 violations, 44 files)
- [x] Chromium evidence: dialog 320/390/600/840 × en/vi + panel 390/840 × en/vi + interaction steps → `tmp/up-settings-subnav/`
- [x] docs/2-architechture-system.md + docs/0-wiki.md updates
- [x] Final report to coordinator (files touched, gate results, REQ/AC map)
