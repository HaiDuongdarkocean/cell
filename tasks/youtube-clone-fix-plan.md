# YouTube 1:1 Clone — Gap Fix Plan

> Target: fix all 9 major gaps (from screenshot comparison) between the mock and real YouTube.
> Source files under `src/entrypoints/mock-youtube/`:
> - `YouTubeWatchPage.tsx` (708 lines) — main page component
> - `YouTubeWatchPage.module.css` (1323 lines) — styles
> - `YouTubePlayer.tsx` (275 lines) — custom video player
> - `YouTubePlayer.module.css` (208 lines) — player styles
> - `YouTubeComments.tsx` (346 lines) — comments section
> - `YouTubeComments.module.css` (433 lines) — comments styles
> - `YouTubeIcons.tsx` (318 lines) — icon components
>
> Constraints: React + CSS modules only (no new deps), dark theme, keep multi-video + subtitle functionality, keep build passing.

---

## 0. Key findings from codebase read

- `view === 'watch'` is the condition used to render the watch page (vs home).
- The sidebar (`<aside className={styles.guide}>`) is ALWAYS rendered — there is no per-view hiding. It is controlled only by `sidebarCollapsed` (240px ↔ 72px).
- `.content` always has `margin-left: 240px` (or 72px when collapsed). There is NO watch-page-specific override — this is the root cause of GAP 1 & GAP 4.
- The masthead end (`.mastheadEnd`) always renders Create + Notifications(9+) + Avatar — no per-view swap. Root cause of GAP 2.
- `YouTubePlayer.tsx` uses its OWN `.playerContainer` (from `YouTubePlayer.module.css`) with `aspect-ratio: 16/9` and `object-fit: contain`. There is ALSO a `.playerContainer` in `YouTubeWatchPage.module.css` (lines 518–525) that is UNUSED by the player component but may confuse. The black band (GAP 3) is likely from the `aspect-ratio: 16/9` container + `object-fit: contain` on a video whose intrinsic ratio differs, OR from the container being taller than the video. Real YouTube uses `object-fit: contain` too, so the band is likely a sizing/letterbox issue — needs verification, but the safe fix is to ensure the `<video>` fills the container exactly and the container has no extra height.
- Action bar (lines 566–604) renders Like/Dislike/Share/Save/Download/Thanks/Clip/Report. GAP 6 wants Thanks/Clip/Report removed and a 3-dot overflow menu added.
- `YouTubeLogo` (YouTubeIcons.tsx lines 308–318) renders the red play SVG + "YouTube" text span. No country suffix. GAP 9.
- `.ownerAvatar` is 48px (CSS line 562). GAP 8 wants 36px.
- `.watchTitle` is `font-size: 20px; font-weight: 700; line-height: 28px` (CSS line 539). GAP 7 wants `font-weight: 400`.
- `.secondary` is already 402px (CSS line 498) and `.relatedThumbWrap` is already 168px (CSS line 969) — GAP 5's "too small" is likely a visual consequence of GAP 4 (content pushed right by 240px sidebar leaves less room). Fixing GAP 4 will restore the intended column width. Verify after GAP 4.
- Sidebar items already match spec (40px height, 12px padding, 10px radius, 14px font) — CSS lines 349–364. No change needed.
- Search bar already uses `#0f0f0f` bg via `var(--yt-bg)`, `1px solid var(--yt-border)` (rgba 0.1), 40px height, 40px radius — close to spec. Real YouTube uses `1px solid #303030`; minor tweak.
- Comments already use 40px avatars, 13px author, 14px text — matches spec. No change needed.

---

## 1. Ordered task list

Tasks are grouped by FILE to avoid merge conflicts. Within a file, ordered by dependency. Priority: P0 (critical layout) → P1 (major) → P2 (minor polish).

### File: `YouTubeWatchPage.module.css`

#### T1 (P0, GAP 1+4) — Hide sidebar + zero left margin on watch page
- **Root cause**: `.content` always has `margin-left: 240px` (line 404) / `72px` (line 411). Sidebar always visible.
- **Change**: Add a watch-page modifier class and hide the guide on watch.
  - In `.content` block (line 403): keep as-is for home.
  - Add new rule after `.contentCollapsed` (line 412):
    ```css
    .contentWatch {
      margin-left: 0;
      padding: 80px 24px 24px;
      max-width: 1280px;
    }
    ```
  - Add rule to hide the full guide on watch (after line 311):
    ```css
    .guideHidden {
      display: none;
    }
    ```
  - Note: real YouTube watch page has NO sidebar (not even mini-guide) at default zoom — content starts ~13px from left. We hide the guide entirely on watch.
- **Complexity**: S
- **Depends on**: T2 (TSX must apply the new classes)

#### T2 (P0, GAP 1+4) — Apply watch-page classes in TSX
- **File**: `YouTubeWatchPage.tsx`
- **Change**:
  - Line 385 `<aside className={`${styles.guide} ${sidebarCollapsed ? styles.guideCollapsed : ''}`}>` →
    `<aside className={`${styles.guide} ${sidebarCollapsed ? styles.guideCollapsed : ''} ${view === 'watch' ? styles.guideHidden : ''}`}>`
  - Line 484 `<div className={`${styles.content} ${sidebarCollapsed ? styles.contentCollapsed : ''}`}>` →
    `<div className={`${styles.content} ${view === 'watch' ? styles.contentWatch : sidebarCollapsed ? styles.contentCollapsed : ''}`}>`
- **Complexity**: S
- **Depends on**: T1

#### T3 (P0, GAP 2) — Header right side: kebab + Sign in on watch page
- **File**: `YouTubeWatchPage.tsx` (lines 370–381) + `YouTubeWatchPage.module.css`
- **Change TSX**: Wrap the existing mastheadEnd content in a view conditional. On `view === 'watch'`, render:
  ```tsx
  <div className={styles.mastheadEnd}>
    <button className={styles.iconButton} aria-label="More">
      <MoreIcon size={24} />
    </button>
    <button className={styles.signInBtn} type="button">
      <span className={styles.signInAvatar} aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
      </span>
      Sign in
    </button>
  </div>
  ```
  On home, keep existing Create/Notifications/Avatar.
  `MoreIcon` already imported (line 25).
- **Change CSS**: Add after `.avatarButton img` (line 296):
  ```css
  .signInBtn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid #303030;
    background: rgba(255,255,255,0.1);
    color: #3ea6ff;
    font-family: var(--yt-font);
    font-size: 14px;
    font-weight: 500;
    height: 36px;
    padding: 0 16px;
    border-radius: 18px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .signInBtn:hover { background: rgba(62,166,255,0.1); }
  .signInAvatar {
    display: inline-flex;
    color: #aaa;
  }
  ```
- **Complexity**: S
- **Depends on**: none

#### T4 (P1, GAP 3) — Remove player black band
- **File**: `YouTubePlayer.module.css` (lines 1–19)
- **Change**: The container uses `aspect-ratio: 16/9` and the video uses `object-fit: contain`. The black band appears when the video's intrinsic aspect ratio is narrower than 16:9 (letterboxing top/bottom) OR when the container has extra height. Real YouTube's player container matches the video's aspect ratio exactly.
  - Ensure the `<video>` fills the container with no gaps:
    ```css
    .playerVideo {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
    }
    ```
  - Add `position: relative` already present (line 2). Keep `aspect-ratio: 16/9` on container.
  - If the source videos are not 16:9, `contain` will letterbox — that's correct YouTube behavior. The "large black band" in the mock is more likely caused by the container being taller than the video because the video had no explicit fill. The `position: absolute; inset: 0` guarantees the video fills the container.
  - Also remove the DUPLICATE `.playerContainer` + `.playerVideo` rules in `YouTubeWatchPage.module.css` (lines 518–532) — they are dead code (the player component imports its own CSS module) and could cause confusion. Verify they're unused first (grep shows `styles.playerContainer` is NOT referenced in TSX — the player uses its own module). Safe to delete lines 517–532.
- **Complexity**: S
- **Depends on**: none

#### T5 (P1, GAP 5) — Verify recommendation column width after T1
- **File**: `YouTubeWatchPage.module.css`
- **Change**: `.secondary` is already 402px (line 498) and `.relatedThumbWrap` already 168px (line 969). After T1 removes the 240px left margin, the primary+secondary will have full viewport width, restoring the intended ~5 visible items. NO CSS change expected — this is a verification task.
  - If after T1 the column still looks narrow, increase `.secondary` to `402px` (already is) and confirm `.watchRow` gap is `24px` (line 488, already correct).
  - Optional: reduce `.relatedList` gap from 8px to 8px (already correct).
- **Complexity**: XS (verify only)
- **Depends on**: T1, T2

#### T6 (P1, GAP 6) — Action bar: remove Thanks/Clip/Report, add overflow 3-dot menu
- **File**: `YouTubeWatchPage.tsx` (lines 566–604) + `YouTubeWatchPage.module.css`
- **Change TSX**: Replace the action bar block. Keep Like/Dislike group (lines 567–580). Keep Share (581–584). Keep Save (585–588). Keep Download (589–591) but add "Download" label. Remove Thanks (592–595), Clip (596–599), Report (600–603). Add overflow button at the end:
  ```tsx
  <button className={styles.actionBtn} aria-label="Download">
    <span className={styles.actionBtnIcon}><DownloadIcon size={18} /></span>
    Download
  </button>
  <button
    className={styles.actionBtn}
    aria-label="More actions"
    onClick={(e) => { e.stopPropagation(); setOverflowOpen(o => !o); }}
  >
    <span className={styles.actionBtnIcon}><MoreIcon size={18} /></span>
  </button>
  {overflowOpen && (
    <div className={styles.overflowMenu} onClick={(e) => e.stopPropagation()}>
      <button className={styles.overflowRow}><ReportIcon size={18} /> Report</button>
      <button className={styles.overflowRow}>Show transcript</button>
    </div>
  )}
  ```
  Add state: `const [overflowOpen, setOverflowOpen] = useState(false);` near other useState (line 263).
  Add outside-click close (reuse pattern from searchWrapRef or a simple document listener).
- **Change CSS**: Add after `.actionBtnIcon` (line 724):
  ```css
  .overflowMenu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 8px;
    background: #212121;
    border-radius: 12px;
    padding: 8px 0;
    min-width: 200px;
    z-index: 100;
    box-shadow: 0 4px 32px rgba(0,0,0,0.5);
  }
  .overflowRow {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    background: none;
    border: none;
    color: #f1f1f1;
    font-family: var(--yt-font);
    font-size: 14px;
    padding: 10px 16px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .overflowRow:hover { background: rgba(255,255,255,0.08); }
  ```
  Add `position: relative` to `.actionBar` (line 624) so the absolute menu anchors correctly.
- **Complexity**: M
- **Depends on**: none (independent of layout tasks)

#### T7 (P2, GAP 7) — Title styling
- **File**: `YouTubeWatchPage.module.css` (line 539–545)
- **Change**:
  ```css
  .watchTitle {
    font-size: 18px;
    font-weight: 400;
    line-height: 26px;
    color: var(--yt-text);
    margin: 0 0 8px;
  }
  ```
  (font-weight 700 → 400, font-size 20 → 18, line-height 28 → 26)
- **Complexity**: XS
- **Depends on**: none

#### T8 (P2, GAP 8) — Channel avatar 36px
- **File**: `YouTubeWatchPage.module.css` (line 562–567)
- **Change**: `.ownerAvatar` width/height `48px` → `36px`.
- **Complexity**: XS
- **Depends on**: none

#### T9 (P2, GAP 9) — Logo country suffix
- **File**: `YouTubeIcons.tsx` (lines 308–318)
- **Change**: Add a country code span after "YouTube":
  ```tsx
  <span style={{ fontFamily: "'Roboto', Arial, sans-serif", fontSize: '20px', fontWeight: 700, color: '#fff', letterSpacing: '-0.05em', lineHeight: 1 }}>YouTube</span>
  <span style={{ fontFamily: "'Roboto', Arial, sans-serif", fontSize: '10px', color: '#aaa', lineHeight: 1, marginLeft: '2px', alignSelf: 'flex-start', marginTop: '1px' }}>US</span>
  ```
  Make the country code configurable via prop (default 'US'):
  ```tsx
  export function YouTubeLogo({ className, countryCode = 'US' }: { readonly className?: string; readonly countryCode?: string }): ReactElement {
  ```
- **Complexity**: XS
- **Depends on**: none

#### T10 (P2, additional) — Search bar border color tweak
- **File**: `YouTubeWatchPage.module.css` (line 160)
- **Change**: `.searchInput` border `1px solid var(--yt-border)` → `1px solid #303030` to match real YouTube exactly. `var(--yt-border)` is `rgba(255,255,255,0.1)` which is close but not identical.
- **Complexity**: XS
- **Depends on**: none

#### T11 (P2, additional) — Owner name font-weight
- **File**: `YouTubeWatchPage.module.css` (line 576–580)
- **Change**: `.ownerName` `font-weight: 500` → `font-weight: 400` (real YouTube uses 400 for channel name on watch page).
- **Complexity**: XS
- **Depends on**: none

---

## 2. Dependency graph

```
T1 (CSS hide sidebar) ──┬── T2 (TSX apply classes) ── T5 (verify column width)
                        │
T3 (header kebab+signin) ── (independent)
T4 (player black band)   ── (independent)
T6 (action bar overflow) ── (independent)
T7 (title)               ── (independent)
T8 (avatar)              ── (independent)
T9 (logo country)        ── (independent)
T10 (search border)      ── (independent)
T11 (owner name weight)  ── (independent)
```

Critical path: T1 → T2 → T5 (the only chain). Everything else is parallelizable.

---

## 3. Execution order (recommended)

1. **T1 + T2** (together — CSS + TSX for sidebar/margin) — P0, fixes GAP 1 & 4
2. **T3** (header right side) — P0, fixes GAP 2
3. **T4** (player black band) — P1, fixes GAP 3
4. **T5** (verify recommendations) — P1, fixes GAP 5
5. **T6** (action bar overflow) — P1, fixes GAP 6
6. **T7, T8, T9, T10, T11** (batch of minor CSS/icon tweaks) — P2

All tasks touch `YouTubeWatchPage.module.css` and/or `YouTubeWatchPage.tsx` except T4 (player CSS), T9 (icons). To avoid conflicts, apply in the order above; the CSS edits are in different regions of the file.

---

## 4. Verification checklist

Run after all tasks complete:

- [ ] `npm run build` passes (no type errors, no Vite errors)
- [ ] `npm run typecheck` passes
- [ ] Home page (`view === 'home'`): full 240px sidebar visible, content has `margin-left: 240px`, header shows Create + Notifications(9+) + Avatar
- [ ] Watch page (`view === 'watch'`):
  - [ ] GAP 1: NO sidebar visible (guide `display: none`)
  - [ ] GAP 4: content `margin-left: 0`, player starts ~24px from left edge
  - [ ] GAP 2: header right shows 3-dot kebab + blue-outline "Sign in" button (no Create/Notifications/Avatar)
  - [ ] GAP 3: video fills player container, no large black band (video `position: absolute; inset: 0`)
  - [ ] GAP 5: secondary column 402px, 168px thumbnails, ~5 items visible
  - [ ] GAP 6: action bar shows Like/Dislike (segmented) + Share + Download + Save + 3-dot overflow; NO Thanks/Clip/Report buttons; overflow menu opens with Report + Show transcript
  - [ ] GAP 7: title `font-size: 18px`, `font-weight: 400`, `line-height: 26px`
  - [ ] GAP 8: channel avatar 36px
  - [ ] GAP 9: logo shows "YouTube" + small gray "US" suffix
- [ ] Player still plays video, subtitles toggle works, fullscreen works, keyboard shortcuts work
- [ ] Comments section renders, sort dropdown works, add-comment works, like bounce works
- [ ] Mobile (<792px): bottom nav shows, sidebar hidden, single column (unchanged behavior)
- [ ] No console errors
- [ ] Visual diff vs real YouTube screenshot: left edge alignment, header right side, player fill, action bar buttons match

---

## 5. Risk notes

- **T4 (black band)**: The fix assumes the band is a container/video sizing mismatch. If after applying `position: absolute; inset: 0` the band persists, the source MP4s may have non-16:9 intrinsic ratios and `object-fit: contain` is correctly letterboxing — in that case the "band" is expected YouTube behavior and the screenshot gap was misread. Verify by checking `videoRef.current.videoWidth/videoHeight` in devtools.
- **T1/T2 (hiding sidebar)**: Real YouTube watch page at default state shows NO sidebar but the hamburger still toggles an overlay mini-guide on click. This plan hides the sidebar entirely on watch for simplicity. If the toggle is expected to work on watch, a follow-up task would add an overlay mini-guide on watch-page hamburger click. Out of scope for this fix pass.
- **T6 (overflow menu)**: Outside-click close needs a document mousedown listener (mirror the searchWrapRef pattern at lines 272–280). Don't forget to clean up the listener.
- **Dead code deletion (T4)**: Confirm `styles.playerContainer` / `styles.playerVideo` in `YouTubeWatchPage.module.css` are truly unreferenced before deleting (grep TSX). The player component imports its own `YouTubePlayer.module.css`.
