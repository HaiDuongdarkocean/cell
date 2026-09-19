# Todo — primer-tab-redesign (REQ-5 + REQ-6)

- [ ] T1 worktree `../cell-worktrees/primer-tab-redesign` + branch `feat/primer-tab-redesign` + junction node_modules
- [ ] T2 `crosshair` icon in catalog + `svg/crosshair.svg` (mirror main edit)
- [ ] T3 `cueList.syncToVideo` in en.json + vi.json
- [ ] T4 REQ-5: `SubtitlePanel.tsx` — strip iff ≥2 renderable tabs (AC: SC-11)
- [ ] T5 REQ-6: `CueList.tsx` + `.module.css` — desync + sync pill (AC: SC-12, SC-13, NFR-6)
- [ ] T6 unit tests: `SubtitlePanel.test.tsx` single-tab case; `CueList.test.tsx` desync/resync/seek-resync/filterEpoch
- [ ] T7 gates: `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] T8 fresh-context verify → `docs/reviews/primer-tab-redesign-verify.md` VERDICT: PASS
- [ ] T9 merge branch → main worktree; delete branch + worktree (Anh's instruction)
- [ ] T10 browser verify + sign-off → `transition --to shipped`; backlog row + wiki changelog
