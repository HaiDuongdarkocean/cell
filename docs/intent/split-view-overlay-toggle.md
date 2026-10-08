# Intent: Player Mode — toggleable subtitle dock (hide / bottom)

> Slug: `split-view-overlay-toggle` · Mode: interactive · Source: user screenshots `brave_uHdxA6S76J.jpg`, `brave_FlCz3z2fln.png`, annotated `brave_i3wvgr6QLi.png`, `brave_4uQa0M5DPr.png`
> ui_surface: yes
> confidence: medium

## User statement (decoded from annotations)

- "player mode có thể hiển thị split view và tắt đi" — cue list open/close should exist in Player Mode (it does, via the dock `sidePanel` icon; keep).
- "có một icon ở đây để bấm vào để có bảng và toggle lại để tắt, nó chỉ có ở chế độ player mode" — a toolbar icon in Player Mode to show/hide the subtitle overlay dock.
- "subtitle overlay panel sẽ toggle hiển thị lên trên màn hình, còn cue list sẽ giống ở ngoài chế độ thường là có thể split view đóng mở" — the subtitle dock can overlay the video (bottom or top); the cue list keeps split-view open/close.
- "journey hiện tại mặc định là sẽ mở cuelist `player-mode-content` sẵn cố định, và panel (desktop) `overlay-player-action` cũng cố định ở dưới — người dùng muốn có tùy chọn để bật tắt chúng" — both PM surfaces are currently fixed; user wants toggles for both.
- "một vấn đề là translate không hiển thị ở dưới của cue list như ips ở trên" (screenshot `brave_4uQa0M5DPr.png`, arrow cue item ↔ dock block) — in the cue list, each token shows the reading/IPA cap **above** the word but the per-word native gloss is missing **below**; the PM dock's SubtitleBlock already renders that gloss lane. Code evidence: `CueList.tsx:146` hardcodes `js-cell-token--gloss-off`, `CueTokenText` never emits `data-gloss`, and `resolveCueListTokenMetadata` (`cueListTokens.ts:97-129`) has no gloss leg — deliberate v1 exclusion, named follow-up in `docs/specs/word-translation.md` (REQ-3 step 5, Boundaries, final note).

## Business Case

| Concept | Statement | Evidence | Confidence |
|---|---|---|---|
| Need | In Player Mode the bottom dock (`overlay-player-action`: NavCluster + SubtitleBlock + right toolbar) is permanently fixed — user cannot hide it for a clean view or move it off the bottom edge when it covers content | `PlayerModeOverlay.tsx:992-1039` renders dock unconditionally; `NavCluster collapsed={false}` hardcoded at :1000; user annotated screenshot | 90% |
| Change | Dock gains user-controlled visibility: shown-bottom (default, current) ↔ hidden — hidden state unmounts the dock band and re-renders nav/subtitle/tools as a floating overlay on the video stage + a restore handle | Normal-mode overlay composition (`SubtitlePanels` root: nav | block | toolbar) is the reference layout | 80% |
| Solution | Reuse existing collapse/expand mechanism + a dock-position state; persist choice per profile so PM opens the way the user left it | `contentPct` already persists via `chrome.storage.local` (`PlayerModeOverlay.tsx:179-181`) — same channel | 75% |
| Value | Unobstructed video in PM on demand; subtitle block readable when site UI/hard subs crowd the bottom edge | User request; bottom-dock overlap visible in screenshot 2 | 85% |
| Stakeholder | Language learner using Player Mode on desktop (persona incl. weak machines) | AGENTS.md persona | 90% |
| Context | PM layout = `split` row (video stage + cue list) + fixed bottom dock; mobile PM already routes through a separate `overlayMobile` branch | `PlayerModeOverlay.tsx:651` mobile branch vs :922 desktop | 90% |

## Needs

| ID | Need (statement) | FURPS+ | Evidence/`[assumption]` | Confidence |
|---|---|---|---|---|
| N1 | In Player Mode, user can hide the bottom dock band (`overlay-player-action`) — its content (NavCluster + SubtitleBlock + right toolbar) keeps rendering as a floating layer over the video stage, mirroring the normal-mode overlay composition | F/U | "dock ẩn thì phải hiển thị thế này" + reference screenshot `brave_KP73uahkBn.png` | 90% |
| N2 | Hidden dock is restorable without leaving PM — a circular restore handle (captions icon) stays at the bottom-left of the video stage, lifted above the host player's control row | U | `NavCluster.collapsedBtn` pattern; without it, hidden dock is unreachable | 90% |
| ~~N3~~ | ~~Dock at top~~ — **DESCOPED**: Anh confirmed bottom-only ("anh chỉ muốn dock ở dưới thôi") | — | — | — |
| N4 | Dock visibility + position persist across PM sessions (chrome.storage.local, same as `contentPct`) | P | `contentPct` persistence precedent | 75% |
| N5 | Cue list split open/close keeps working in PM (existing `cueListOpen` + `sidePanel` icon); when dock is hidden, cue list still reachable `[assumption: sidePanel icon moves to restore handle or stays via cue-list header]` | F | `PlayerModeOverlay.tsx:1033` | 80% |
| N6 | No layout thrash — hiding dock frees its layout space; video stage/geometry recompute via existing `resolvePlayerModeLayout` | P | `playerModeGeometry.ts` drives dock height | 80% |
| N7 | Toggle affordance lives in PM only — normal-mode overlay untouched | F | "nó chỉ có ở chế độ player mode" | 90% |
| N8 | **[scope pending]** Per-word gloss lane in cue list items (PM + split-view panel — same `CueList`), mirroring the reading cap above: reuse `Token.gloss` + `data-gloss` + `showWordTranslations` profile flag; needs a gloss leg in `resolveCueListTokenMetadata` gated on `subtitleOverlayNativeLanguage` | F/U | "translate không hiển thị ở dưới của cue list như ips ở trên"; word-translation spec named follow-up | 80% |

## Scope

**In**: desktop Player Mode dock show/hide + persistence; when hidden the dock's nav/subtitle/toolbar float over the video stage (overlay-style, like normal mode); restore handle; hide icon in PM dock toolbar. Mobile PM branch: same toggle in the `pm-more-menu` Sheet if cheap, else explicit non-goal.
**Out**: normal-mode overlay/split-view changes; ~~cue-list content changes~~ **(under review — N8 cue-list gloss lane may pull it in if Anh wants it bundled; default recommendation: ship as its own item right after this one)**; dock placement other than bottom (top/sides); auto-hide-on-idle.

N8 note — if bundled or done next: cue-list resolve hydrates **all** cues' unique terms in one wave (unlike the overlay's time-windowed preloader), so gloss volume is the real cost — mitigate by resolving glosses only for the rendered window or chunking like `fetchTermsChunked`; zero requests when `showWordTranslations` off or native lang unset.

## Risks

| Risk | Mitigation |
|---|---|
| Hidden dock removes the only home of the cue-list toggle + study-mode controls | Restore handle keeps a way back; cue-list toggle duplicated in restore handle or cue-list header |
| Top placement collides with site UI / browser chrome in fullscreen PM | Position applies to video stage edge inside PM layout, not page; verify in fullscreen |
| Layout recompute when dock hides/moves | `playerModeGeometry` already centralizes dock height — extend, don't fork |

## Decision

**GO** — pending Anh's confirmation on: (a) hide → circular restore button acceptable, (b) ~~top placement~~ resolved — bottom-only per Anh, (c) N8 cue-list gloss lane — bundle into this item or split off as `cue-list-glosses` right after.
