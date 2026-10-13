# Todo — up-tab-layout-contract (item 28)

- [x] REQ-1: recap pane mounts via `.tabPane` + `visitedTabs` identical to siblings (`UniversalPanel.tsx`)
- [x] REQ-2: `.scrollport` in `Scrollable.module.css`; composed by playlist `.list`, recap `.body`, vocabulary `.list`, studyModes `.tab`; settings `.mainCol` + dictionary internal scrollers verified conformant
- [x] REQ-3: `.content` flush (padding + `[data-tihoka-id]` carve-out + media-query padding removed); `--universal-panel-tab-gutter` on `.body`; per-tab `padding:` consumes the var
- [x] REQ-4: `padding-block-end: var(--universal-panel-tab-scroll-inset)` on scrollports/page containers; dictionary `.integratedMode` inset covers the collapsed MobileSheet peek
- [x] REQ-5: `isActive` prop bound at `mountUniversalPanel` render fns (`open && currentTab === tab`)
- [x] REQ-6: playlist teardown effect `[isActive, previewUrl]` — unmount audio + revoke URL, incl. mid-read resolution
- [x] REQ-7: recap `load()` on every activation; `failed && sessions === null` keeps stale list on failed refresh
- [x] REQ-8: card remap hoisted to `.body`; three per-tab copies deleted; `.modeCard` override preserved
- [x] REQ-9: `EmptyState .root{flex:1 1 auto}` + `.bordered{flex:none}`; recap/playlist/settings empty+loading hosts fill+center
- [x] REQ-10: `container-type:inline-size` on playlist `.list` activates the ≤480px wrap
- [x] Tests: flipped recap keep-alive test; new `PlaylistTab.test.tsx`, `RecapTab.test.tsx`; `isActive` binding test in `mountUniversalPanel.test.tsx`
- [x] `docs/2-architechture-system.md` + `docs/0-wiki.md` updated
- [ ] Gates: `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build`
- [ ] Verify: real-Chromium pass + before/after captures (verify-stage reviewer)
