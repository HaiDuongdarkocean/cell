# YouTube 1:1 Clone — Improvement Plan

> Target: pixel-perfect clone of real YouTube watch page (`youtube.com/watch?v=nADTbWQof7Y`) and home page.
> Source files: `src/entrypoints/mock-youtube/YouTubeWatchPage.tsx` (450 lines), `YouTubeWatchPage.module.css` (872 lines), `YouTubeIcons.tsx` (163 lines).
> Constraints: React + CSS only (no new deps), CSS modules, dark theme (#0f0f0f / #f1f1f1 / #212121), keep multi-video + subtitle functionality, keep build passing.

---

## 1. Gap Analysis

| Component | Current State | Real YouTube | Gap | Priority |
|---|---|---|---|---|
| **Header / Masthead** | Hamburger, logo, search input, voice, create, notif (9+ badge), avatar. 56px fixed. | Same elements + search dropdown suggestions on focus, voice search popup modal, tooltip on icon hover, frosted-glass blur on scroll, "Create" dropdown menu (Upload video / Go live). | No search suggestions dropdown, no voice popup, no tooltips, no create dropdown. Hover bg slightly off (real uses `rgba(255,255,255,0.1)` OK but lacks active/press state). | P1 |
| **Search bar** | Pill input + 64px search button. Focus adds left padding (52px) but no search icon inside on focus. | On focus: left search icon appears inside input, border turns `#1c62b9` (blue), suggestions dropdown below with history + trending, "Search" placeholder. | Missing focus-state search icon, suggestions dropdown, exact blue `#1c62b9`. | P1 |
| **Sidebar (expanded)** | 240px, 3 sections: guide items, library/history, subscriptions. Active state = bg `rgba(255,255,255,0.12)`. | 240px. Section 1: Home/Shorts/Subscriptions/You. Section 2: History/Playlists/Your videos/Later/Liked. Section 3: Subscriptions (avatar + name + live dot). Section 4: Explore (Trending/Music/Movies/Gaming/News/Sport/Learning/Settings). Section 5: footer links. "Show more" toggle on subscriptions. Hover `rgba(255,255,255,0.08)` rounded 10px. Active = `rgba(255,255,255,0.12)` + font-weight 500. | Missing "You" section, Explore section, footer, "Show more" toggle, live red dot on subscription avatars. Section structure differs. | P1 |
| **Sidebar (collapsed / mini-guide)** | 72px, icons stack vertically with labels under. | 72px mini-guide: icon (24px) + label (10px) below, 4px gap, 16px vertical padding, rounded 10px, hover bg. Only shows Home/Shorts/Subscriptions/You (4 items). | Shows all items collapsed (should only show 4 main). Label font-size wrong (14px vs 10px). Padding wrong (16px vs 12px). | P1 |
| **Home: chips/filters bar** | MISSING entirely. | Horizontal scrollable chips below header: "All, Music, Gaming, Live, Mixes, Podcasts, News, Computer programming, Recently uploaded, New to you". Active chip = bg `#f1f1f1` text `#0f0f0f`. Inactive = `rgba(255,255,255,0.1)` text `#f1f1f1`. Rounded 8px, height 32px, padding 0 12px. Horizontal scroll with fade edges. | Completely missing. | P0 |
| **Home: video grid** | `auto-fill minmax(310px,1fr)`, gap 16px 40px. Card = thumb + meta (avatar + title + channel + stats). Hover = thumb radius 12px to 0 top. | Grid `auto-fill minmax(310px,1fr)`, gap 16px 16px (row gap smaller). Card hover: thumb radius 12px to 0 (OK), 3-dot menu appears on meta hover, channel name clickable, "dot" separator. Thumbnail has duration badge (bottom-right, bg `rgba(0,0,0,0.8)`, text white, rounded 4px). | Missing duration badge, 3-dot menu, channel click. Row gap 40px too large (should be 16px). | P1 |
| **Player** | Native `<video controls>` — browser default controls. | Custom controls overlay: bottom gradient bar with play/pause (left), timeline/seekbar (full width, red progress `#ff0033`), volume (slider popup), settings gear (speed/quality menu), CC toggle, miniplayer, theater, fullscreen (right). Auto-hide after 3s. Big center play button when paused. Double-click fullscreen. | Massive gap — no custom controls at all. | P0 |
| **Watch: title** | 20px bold, margin 0 0 8px. | h1: 20px (<=1280px) / 18px (mobile), font-weight 400 (not 700!), line-height 2.6rem. Title is NOT bold on real YT — it's regular weight. | Font-weight wrong (700 vs 400). Line-height wrong. | P1 |
| **Watch: channel info** | Avatar 48px + name 16px/500 + subs 12px + Subscribe button (white bg, black text, rounded 20px, 36px height). | Avatar 48px, name 16px/400 (not 500), subs 12px/400 `#aaa`. Subscribe: bg `#f1f1f1`, text `#0f0f0f`, rounded 18px (pill), height 36px, font 14px/500. Hover: `#c5c5c5`. Subscribed state: bg `rgba(255,255,255,0.1)`, text `#f1f1f1`, shows bell icon. | Name font-weight 500 to 400. Subscribe radius 20 to 18px. No subscribed/bell state. No hover color `#c5c5c5`. | P1 |
| **Action bar** | Like/dislike pill (joined, bg `rgba(255,255,255,0.1)`, 36px, radius 20px) + Share/Save/Download (separate pills). | Segmented like/dislike button (joined pill, bg `rgba(255,255,255,0.1)`, 36px, radius 18px). Like shows count. Dislike no count. Share/Download/Save/Report separate pills, 36px, radius 18px, bg `rgba(255,255,255,0.1)`, hover `rgba(255,255,255,0.15)`. Like pressed = icon+text turn `#3ea6ff` (blue). | Radius 20 to 18px. Like pressed state missing blue color. Download has no label (icon only OK). Missing "Report" / "Thanks" / "Clip" buttons. Like count doesn't increment on click. | P1 |
| **Description** | Bg `#212121`, radius 12px, padding 12px, click to expand. Info row: views + date. Text 2-line clamp, expand removes clamp. Tags as blue spans. | Bg `#212121`, radius 12px, padding 12px. Collapsed: views + date + first line + "...more". Expanded: full text, hashtags `#3ea6ff`, links `#3ea6ff` underlined, "Show less" button. Smooth height animation. Channel name bold at start. | No "...more"/"Show less" text. No smooth expand animation (instant). No link styling. No channel name prefix. | P1 |
| **Comments: header** | "N Comments" (20px/700) + sort button (MenuIcon + "Sort by"). | "N Comments" (20px/700 OK). Sort: dropdown icon + "Sort by" then opens menu (Top comments / Newest). | Sort dropdown non-functional. | P2 |
| **Comments: input** | Avatar 40px + input (border-bottom only). | Avatar 40px + input. Focus: border-bottom `#f1f1f1`, shows Cancel + Comment buttons. Unfocused: single line "Add a comment..." with border-bottom `#303030`. | No Cancel/Comment buttons on focus. No focus border color change to `#f1f1f1`. | P2 |
| **Comments: item** | Avatar 40px + author 13px/500 + time 12px + text 14px + like/dislike/reply buttons. | Avatar 40px + author 13px/500 + time 12px `#aaa` + text 14px/20px + like (icon + count) / dislike (icon) / Reply (12px `#aaa`). Pinned comment has pin icon + "Pinned by" label. Heart from creator on like. | Reply button color. No pinned comment. No creator heart. Like count format. | P2 |
| **Related videos** | 168px thumb + title (2-line clamp) + channel + meta. Hover bg `rgba(255,255,255,0.05)`. | 168px thumb (<=1280px) / 120px (mobile). Title 14px/500 2-clamp. Channel 12px `#aaa`. Meta 12px `#aaa`. 3-dot menu on hover (right side). Hover: bg `rgba(255,255,255,0.05)` OK. Duration badge on thumb. | Missing 3-dot menu, duration badge. | P2 |
| **Animations** | `fadeIn` on watch row (0.3s translateY). `pulse` for loading. | Page transitions, sidebar slide (0.2s OK), description expand (smooth height), like button bounce, comment loading skeleton, chip slide, button press scale (0.97). | Missing: description smooth expand, like bounce, button press scale, skeleton loaders, chip slide. | P2 |
| **Responsive** | 792px: hide guide, hide search, 1-col grid, 120px related thumb. 1024px: watch row stacks. 1280px: secondary 360px. | Mobile (<792px): bottom nav bar (Home/Shorts/+) instead of sidebar, search becomes icon, single column. Tablet: sidebar auto-collapse. Desktop: full sidebar. | No mobile bottom nav bar. No tablet auto-collapse. | P1 |

---

## 2. Task Breakdown — 3 Parallel Streams

### Stream A: Header + Sidebar + Home Page

#### A1. Search bar focus state + suggestions dropdown
- **Description**: On search input focus, show a left-aligned search icon inside the input, change border to `#1c62b9`, and render a suggestions dropdown below with mock search history + trending queries. Dropdown: bg `#212121`, rounded 12px (bottom), each row 40px with search icon + text, hover `rgba(255,255,255,0.08)`.
- **Acceptance criteria**:
  - Focus input then border `#1c62b9`, search icon (16px) appears at left padding 16px, input text shifts right.
  - Dropdown appears below search container with 6+ mock suggestions.
  - Click suggestion then fills input + closes dropdown.
  - Click outside then closes dropdown.
  - Blur then border reverts to `#303030`, icon hides.
- **Files**: `YouTubeWatchPage.tsx` (search section), `YouTubeWatchPage.module.css` (`.searchInput`, new `.searchDropdown`, `.searchSuggestion`), `YouTubeIcons.tsx` (reuse `SearchIcon`).
- **Complexity**: M

#### A2. Voice search popup modal
- **Description**: Click voice button then centered modal overlay (bg `rgba(0,0,0,0.6)`), modal card `#212121` rounded 12px, microphone icon (red, pulsing animation), "Listening..." text, Cancel button. Click overlay/Cancel then close.
- **Acceptance criteria**:
  - Voice button click then modal appears with fade-in.
  - Mic icon pulses (scale 1 to 1.1, 1.5s infinite).
  - "Listening..." text + "Cancel" button.
  - Esc key / overlay click / Cancel then modal fades out.
  - Modal traps focus.
- **Files**: `YouTubeWatchPage.tsx` (voice button + modal), `.module.css` (`.voiceModal`, `.voiceOverlay`, `.voiceCard`, `@keyframes micPulse`).
- **Complexity**: S

#### A3. Create button dropdown menu
- **Description**: Click Create icon then dropdown menu below: "Upload video" + "Go live" rows with icons. Bg `#212121`, rounded 12px, shadow, each row 40px hover `rgba(255,255,255,0.08)`. Click outside closes.
- **Acceptance criteria**:
  - Create click then dropdown appears anchored bottom-right of button.
  - Two rows with upload/live icons + labels.
  - Hover row then bg `rgba(255,255,255,0.08)`.
  - Click outside / Esc then closes.
- **Files**: `YouTubeWatchPage.tsx`, `.module.css` (`.createMenu`), `YouTubeIcons.tsx` (new `UploadVideoIcon`, `LiveIcon`).
- **Complexity**: S

#### A4. Sidebar structure + sections
- **Description**: Rebuild sidebar to match real YT: Section 1 (Home/Shorts/Subscriptions/You), Section 2 (History/Playlists/Your videos/Watch later/Liked videos), Section 3 (Subscriptions with live red dot), Section 4 (Explore: Trending/Music/Movies&TV/Gaming/Live/Settings), Section 5 (footer: About/Press/Copyright/Contact/Creators/Advertise/Developers/Terms/Privacy/Policy). Add "Show more" toggle on subscriptions (collapses to 4, expands all).
- **Acceptance criteria**:
  - 5 sections with `1px solid #303030` dividers between.
  - "You" item with chevron-right icon.
  - Live subscriptions show red dot (8px, `#ff0033`, bottom-right of avatar).
  - "Show more"/"Show less" toggle on subscriptions section.
  - Footer links section at bottom (12px `#aaa`, 2-column).
  - Active state: bg `rgba(255,255,255,0.12)`, font-weight 500.
  - Hover: bg `rgba(255,255,255,0.08)`, 10px radius.
- **Files**: `YouTubeWatchPage.tsx` (sidebar data + render), `.module.css` (`.guideSection`, `.guideDivider`, `.liveDot`, `.guideFooter`), `YouTubeIcons.tsx` (new: `YouIcon`, `TrendingIcon`, `MusicIcon`, `MoviesIcon`, `GamingIcon`, `LiveIcon`, `SettingsIcon`, `PlaylistsIcon`, `WatchLaterIcon`, `LikedIcon`, `ChevronRightIcon`).
- **Complexity**: M

#### A5. Mini-guide (collapsed sidebar) fix
- **Description**: When collapsed, show only 4 main items (Home/Shorts/Subscriptions/You) in mini-guide layout: icon 24px + label 10px below, 4px gap, 12px vertical padding, rounded 10px. Hide all other sections.
- **Acceptance criteria**:
  - Collapsed then only 4 items visible.
  - Label font-size 10px, color `#f1f1f1`.
  - Icon 24px centered, 12px vertical padding.
  - Hover bg `rgba(255,255,255,0.08)` rounded 10px.
  - Active item: bg `rgba(255,255,255,0.12)`.
- **Files**: `YouTubeWatchPage.tsx` (conditional render when collapsed), `.module.css` (`.guideCollapsed .guideItem` overrides).
- **Complexity**: S

#### A6. Home page chips/filters bar
- **Description**: Add horizontal scrollable chips bar below header (above video grid): "All, Music, Gaming, Live, Mixes, Podcasts, News, Computer programming, Recently uploaded, New to you, Action-adventure games, Comedy". Active chip: bg `#f1f1f1` text `#0f0f0f`. Inactive: bg `rgba(255,255,255,0.1)` text `#f1f1f1`. Rounded 8px, height 32px, padding 0 12px, font 14px/400. Horizontal scroll with hidden scrollbar + left/right fade gradients. Sticky below header (top 56px).
- **Acceptance criteria**:
  - Chips bar appears on home page only, sticky top 56px, bg `#0f0f0f`.
  - First chip "All" is active (white bg, black text).
  - Click chip then active state moves.
  - Horizontal scroll works (mouse wheel + drag), scrollbar hidden.
  - Left/right fade gradient when overflow.
  - Chips do NOT filter videos (visual only — keep simple).
- **Files**: `YouTubeWatchPage.tsx` (chips data + render in home view), `.module.css` (`.chipsBar`, `.chip`, `.chipActive`, `.chipsFadeLeft`, `.chipsFadeRight`).
- **Complexity**: M

#### A7. Home video card improvements
- **Description**: Add duration badge to thumbnail (bottom-right, bg `rgba(0,0,0,0.8)`, text white, rounded 4px, padding 0 4px, font 12px/500). Add 3-dot menu button (appears on card meta hover, top-right of meta area). Fix grid row gap 40px to 16px. Make channel name hover `#f1f1f1` (underline). Add "dot" separator between views and date.
- **Acceptance criteria**:
  - Duration badge on every thumbnail (mock: "3:45", "4:12", etc.).
  - 3-dot menu appears on meta hover (right side, 24px button).
  - Grid gap: 16px row, 16px column.
  - Channel name hover then color `#f1f1f1`.
  - Views and date separated by "dot" character.
- **Files**: `YouTubeWatchPage.tsx` (add duration to MockVideo, render badge + menu), `.module.css` (`.durationBadge`, `.videoMenu`, `.videoGrid` gap fix).
- **Complexity**: S

#### A8. Mobile bottom nav bar
- **Description**: On screens <792px, replace hidden sidebar with a fixed bottom nav bar: Home / Shorts / (+) / Subscriptions / You. 56px height, bg `#0f0f0f`, top border `#303030`. Icons 24px + labels 10px. Active = white, inactive = `#aaa`.
- **Acceptance criteria**:
  - <792px then bottom nav visible, sidebar hidden.
  - 5 items: Home, Shorts, Create (+, centered, circular bg `rgba(255,255,255,0.1)`), Subscriptions, You.
  - Active item icon+label white; inactive `#aaa`.
  - Fixed bottom, z-index 2000.
  - Click Home then navigates home.
- **Files**: `YouTubeWatchPage.tsx` (bottom nav render), `.module.css` (`.bottomNav`, `.bottomNavItem`, `.bottomNavActive`, media query).
- **Complexity**: M

#### A9. Header tooltip on icon hover
- **Description**: Add CSS tooltips on header icon buttons (Guide, Create, Notifications): appear on hover after 0.5s delay, bg `#717171`, text white, 12px, rounded 2px, padding 4px 8px, positioned below button.
- **Acceptance criteria**:
  - Hover icon button then tooltip appears 0.5s later.
  - Tooltip text: "Guide", "Create", "Notifications".
  - Tooltip bg `#717171`, white text, 12px, below button.
  - Mouse leave then tooltip hides.
- **Files**: `.module.css` (`.iconButtonTooltip`, `::after` pseudo-element), `YouTubeWatchPage.tsx` (add `aria-label` + `title` or data-tooltip).
- **Complexity**: S

---

### Stream B: Player + Watch Metadata + Actions

#### B1. Custom player controls — play/pause + center button
- **Description**: Remove native `controls` attribute. Build custom overlay: big center play button (when paused, 64px circle, bg `rgba(0,0,0,0.6)`, white play icon, fades out when playing). Bottom-left: play/pause toggle (24px). Click video toggles play/pause. Spacebar toggles.
- **Acceptance criteria**:
  - No native browser controls visible.
  - Paused then big center play button visible; playing then hidden (fade 0.3s).
  - Bottom bar play/pause icon swaps (play triangle / pause bars).
  - Click video area toggles play/pause.
  - Spacebar toggles play/pause.
  - Bottom control bar auto-hides after 3s of playing + no mouse move; reappears on mouse move.
- **Files**: `YouTubeWatchPage.tsx` (player state: isPlaying, showControls; event handlers), `.module.css` (`.playerOverlay`, `.centerPlayBtn`, `.controlBar`, `.playPauseBtn`, `@keyframes`), `YouTubeIcons.tsx` (new `PlayIcon`, `PauseIcon`).
- **Complexity**: L

#### B2. Custom player controls — seekbar/timeline
- **Description**: Full-width seekbar at bottom of control bar. Track: bg `rgba(255,255,255,0.3)`, height 4px (expands to 8px on hover). Buffered: bg `rgba(255,255,255,0.5)`. Played: bg `#ff0033` (red). Draggable thumb (12px circle, white) appears on hover. Click to seek. Drag to scrub. Time display: current / duration (format mm:ss or h:mm:ss). Hover on seekbar shows preview tooltip with time.
- **Acceptance criteria**:
  - Seekbar fills red proportionally to currentTime/duration.
  - Buffered portion shows lighter gray.
  - Hover then track expands 4px to 8px, thumb appears.
  - Click any point then video seeks to that time.
  - Drag thumb then scrubs video (updates currentTime).
  - Time display "0:00 / 3:45" format updates live.
  - Hover on track then time tooltip appears above cursor.
- **Files**: `YouTubeWatchPage.tsx` (seekbar state: currentTime, duration, buffered, dragging; mouse handlers), `.module.css` (`.seekbar`, `.seekTrack`, `.seekPlayed`, `.seekBuffered`, `.seekThumb`, `.timeDisplay`, `.seekTooltip`).
- **Complexity**: L

#### B3. Custom player controls — volume
- **Description**: Volume button (speaker icon) bottom-left next to play. Click toggles mute. Hover reveals vertical volume slider popup (to the right of button): track 4px wide, 40px tall, bg `rgba(255,255,255,0.3)`, filled `#f1f1f1`, thumb 12px. Mouse wheel over player adjusts volume. Icon changes: volume-high / volume-low / muted.
- **Acceptance criteria**:
  - Volume button shows current state icon (high/low/muted).
  - Click then mutes/unmutes.
  - Hover then vertical slider popup appears (fade 0.2s).
  - Drag slider then volume changes 0-1.
  - Mouse wheel over player then volume +/- 0.1.
  - Mute then icon shows muted speaker.
- **Files**: `YouTubeWatchPage.tsx` (volume state: volume, muted), `.module.css` (`.volumeBtn`, `.volumeSlider`, `.volumePopup`), `YouTubeIcons.tsx` (new `VolumeHighIcon`, `VolumeLowIcon`, `VolumeMutedIcon`).
- **Complexity**: M

#### B4. Custom player controls — settings menu (speed + quality)
- **Description**: Settings gear icon bottom-right. Click opens menu above: "Playback speed" (0.25, 0.5, 0.75, Normal, 1.25, 1.5, 1.75, 2) + "Quality" (Auto, 1080p, 720p, 480p, 360p — visual only). Menu: bg `rgba(0,0,0,0.8)`, rounded 12px, each row 36px, hover `rgba(255,255,255,0.1)`, checkmark on selected.
- **Acceptance criteria**:
  - Gear click then menu appears above button.
  - Playback speed submenu: list of speeds, current has checkmark.
  - Select speed then `video.playbackRate` updates + menu closes.
  - Quality submenu: visual only (no real change).
  - Click outside then closes.
  - Menu bg `rgba(0,0,0,0.8)`, rounded 12px.
- **Files**: `YouTubeWatchPage.tsx` (settings state: menuOpen, currentRate, submenu), `.module.css` (`.settingsMenu`, `.settingsRow`, `.settingsCheck`), `YouTubeIcons.tsx` (new `SettingsIcon`, `CheckIcon`).
- **Complexity**: M

#### B5. Custom player controls — CC toggle + subtitles
- **Description**: CC (closed captions) toggle button bottom-right. Click toggles subtitle track on/off. When on: icon highlighted (white underline), VTT track enabled. When off: icon dimmed. Keep existing `<track>` VTT functionality. Style subtitle text: white, bg `rgba(0,0,0,0.8)`, rounded 2px, padding 2px 4px, font 16px, bottom 8% centered.
- **Acceptance criteria**:
  - CC button toggles `textTrack.mode` between 'showing' and 'hidden'.
  - On: icon has white underline indicator.
  - Off: icon dimmed (`#aaa`).
  - Subtitles display with custom styling (white text, dark bg, bottom centered).
  - Subtitle state persists across video switches.
- **Files**: `YouTubeWatchPage.tsx` (CC state, track ref manipulation), `.module.css` (`::cue` styles, `.ccBtn`, `.ccActive`), `YouTubeIcons.tsx` (new `CcIcon`).
- **Complexity**: M

#### B6. Custom player controls — fullscreen + theater + miniplayer
- **Description**: Fullscreen button (bottom-right): toggles fullscreen on player container. Theater button: toggles player to full-width (hides sidebar, secondary moves below). Miniplayer button: shrinks player to bottom-right floating 400x225 (stays on scroll). Double-click video toggles fullscreen.
- **Acceptance criteria**:
  - Fullscreen button then `requestFullscreen()` on container; icon swaps to exit.
  - Esc then exits fullscreen.
  - Double-click video then toggles fullscreen.
  - Theater button then player full-width, sidebar hidden, related videos below.
  - Miniplayer button then player floats bottom-right 400x225, page scrolls behind.
  - Miniplayer has close (X) + expand (restore) buttons.
- **Files**: `YouTubeWatchPage.tsx` (fullscreen/theater/miniplayer state), `.module.css` (`.fullscreen`, `.theaterMode`, `.miniplayer`, `.miniplayerClose`), `YouTubeIcons.tsx` (new `FullscreenIcon`, `ExitFullscreenIcon`, `TheaterIcon`, `MiniplayerIcon`, `CloseIcon`).
- **Complexity**: L

#### B7. Watch title + channel info fixes
- **Description**: Fix title font-weight 700 to 400, line-height to 2.6rem. Fix channel name font-weight 500 to 400. Subscribe button radius 20 to 18px, hover `#c5c5c5`. Add subscribed toggle state: click Subscribe then button becomes "Subscribed" with bell icon, bg `rgba(255,255,255,0.1)`, text `#f1f1f1`. Click again reverts.
- **Acceptance criteria**:
  - Title: font-weight 400, line-height 2.6rem (26px), font-size 20px.
  - Channel name: font-weight 400.
  - Subscribe: radius 18px, hover bg `#c5c5c5`.
  - Click Subscribe then text "Subscribed", bell icon appears, bg `rgba(255,255,255,0.1)`.
  - Click Subscribed then reverts to "Subscribe" white bg.
- **Files**: `YouTubeWatchPage.tsx` (subscribed state), `.module.css` (`.watchTitle`, `.ownerName`, `.subscribeBtn`, `.subscribeBtnActive`), `YouTubeIcons.tsx` (new `BellIcon`).
- **Complexity**: S

#### B8. Action bar fixes + like animation
- **Description**: Fix pill radius 20 to 18px. Like button: click then icon + count turn `#3ea6ff` (blue), count increments by 1, bounce animation on icon (scale 1 to 1.2 to 1, 0.3s). Dislike: click then icon turns `#3ea6ff`? no — dislike has no active color, just toggles. Add "Thanks" and "Clip" and "Report" buttons (visual only, icon + label pills). Download keeps icon-only.
- **Acceptance criteria**:
  - All pills radius 18px.
  - Like click then icon+count `#3ea6ff`, count +1, icon bounce.
  - Like click again then reverts (count -1, color back).
  - Dislike click then toggles pressed state (no color).
  - "Thanks", "Clip", "Report" pills appear (icon + label).
  - Action bar wraps on narrow widths.
- **Files**: `YouTubeWatchPage.tsx` (like count state, dislike state), `.module.css` (`.likeBtn`, `.likeActive`, `@keyframes likeBounce`, `.actionBtn` radius), `YouTubeIcons.tsx` (new `ThanksIcon`, `ClipIcon`, `ReportIcon`).
- **Complexity**: M

#### B9. Description expand/collapse animation + content
- **Description**: Add "...more" text at end of collapsed description (2-line clamp). Click then smooth height animation (max-height transition 0.3s ease) to full text. Add "Show less" button at bottom when expanded. Channel name bold prefix. Hashtags `#3ea6ff`. Links `#3ea6ff` underlined. Render description with line breaks preserved.
- **Acceptance criteria**:
  - Collapsed: 2-line clamp + "...more" visible.
  - Click then smooth height transition (0.3s) to full text.
  - Expanded: "Show less" button at bottom-right.
  - Click "Show less" then collapses with animation.
  - Channel name bold at start of description.
  - Hashtags blue `#3ea6ff`.
  - Links blue + underlined.
  - Line breaks (`\n`) render as new lines.
- **Files**: `YouTubeWatchPage.tsx` (descExpanded state, "...more"/"Show less" buttons), `.module.css` (`.descText` transition, `.descMore`, `.descLess`, `.descTag`, `.descLink`).
- **Complexity**: M

#### B10. Share popup modal
- **Description**: Click Share then modal overlay: card `#212121` rounded 12px, title "Share", row of social icons (Copy link, Facebook, X, WhatsApp, Reddit, Email), input with video URL + "Copy" button, "Embed" + "Cancel" buttons. Copy then shows "Copied!" feedback.
- **Acceptance criteria**:
  - Share click then modal appears (fade-in).
  - Social icon row (6 icons, 48px circles, hover bg).
  - URL input + Copy button.
  - Copy click then button text "Copied!" for 2s.
  - Cancel / overlay click / Esc then closes.
- **Files**: `YouTubeWatchPage.tsx` (share modal state), `.module.css` (`.shareModal`, `.shareCard`, `.shareSocial`, `.shareInput`), `YouTubeIcons.tsx` (new social icons or use generic).
- **Complexity**: M

---

### Stream C: Comments + Related Videos + Animations

#### C1. Comments sort dropdown
- **Description**: Click "Sort by" then dropdown menu: "Top comments" (default, checked) + "Newest first". Bg `#212121`, rounded 12px, each row 36px, hover `rgba(255,255,255,0.08)`, checkmark on selected. Select then reorders COMMENTS array (by likes desc for Top, by index reverse for Newest — mock logic).
- **Acceptance criteria**:
  - Sort button click then dropdown appears below.
  - Two options with checkmark on current.
  - Select "Newest first" then comments reverse order.
  - Select "Top comments" then comments sort by likes desc.
  - Click outside then closes.
- **Files**: `YouTubeWatchPage.tsx` (sort state, sort logic), `.module.css` (`.sortDropdown`, `.sortRow`, `.sortCheck`).
- **Complexity**: S

#### C2. Comment input focus state + buttons
- **Description**: Unfocused: input shows "Add a comment..." with border-bottom `#303030`. Focus: border-bottom `#f1f1f1`, input expands to 2-line textarea, "Cancel" + "Comment" buttons appear below (right-aligned). "Comment" disabled until text entered. Click "Comment" then adds comment to top of list + clears. Click "Cancel" then clears + blurs.
- **Acceptance criteria**:
  - Unfocused: single-line, border `#303030`, no buttons.
  - Focus: border `#f1f1f1`, buttons appear (Cancel gray, Comment blue disabled).
  - Type text then "Comment" button enables (blue `#3ea6ff`).
  - Click "Comment" then new comment appears at top (avatar + "You" + "just now" + text + 0 likes).
  - Click "Cancel" then input clears, blurs, buttons hide.
- **Files**: `YouTubeWatchPage.tsx` (comment input state, addComment handler), `.module.css` (`.commentInputFocus`, `.commentButtons`, `.commentSubmitBtn`, `.commentCancelBtn`).
- **Complexity**: M

#### C3. Comment item — pinned + creator heart + replies expand
- **Description**: First comment: pinned (pin icon + "Pinned by Jeremy Zucker" label, 12px `#aaa`). Creator heart: small heart overlay on like icon (red, 12px, bottom-right of like button). Replies: "View N replies" button (12px `#aaa`, chevron-down). Click then expands reply list (1-2 mock replies, same structure, indented). Click again collapses.
- **Acceptance criteria**:
  - First comment has pin icon + "Pinned by [channel]" label above text.
  - Like button has small red heart overlay (creator liked).
  - "View N replies" button below actions.
  - Click then 1-2 mock replies appear (indented 40px, avatar 24px).
  - Click "Hide replies" then collapses.
  - Reply chevron rotates 180deg on expand.
- **Files**: `YouTubeWatchPage.tsx` (pinned flag, replies data, expanded state), `.module.css` (`.pinnedLabel`, `.creatorHeart`, `.repliesToggle`, `.replyItem`, `@keyframes chevronRotate`), `YouTubeIcons.tsx` (new `PinIcon`, `HeartIcon`, `ChevronDownIcon`).
- **Complexity**: M

#### C4. Comment like animation
- **Description**: Click comment like button then icon bounces (scale 1 to 1.3 to 1, 0.3s), count +1, icon fills `#3ea6ff` (blue). Click again then reverts (count -1, icon outline). Dislike: click then icon bounces, no color.
- **Acceptance criteria**:
  - Like click then icon bounce + count +1 + blue fill.
  - Like click again then revert.
  - Dislike click then icon bounce (no color).
  - Only one of like/dislike active at a time (clicking like clears dislike and vice versa).
- **Files**: `YouTubeWatchPage.tsx` (per-comment like/dislike state), `.module.css` (`@keyframes commentLikeBounce`, `.commentLikeActive`).
- **Complexity**: S

#### C5. Related videos — 3-dot menu + duration badge + hover
- **Description**: Add 3-dot menu button to each related item (appears on hover, right side of info area, 24px). Click then small dropdown: "Save to Watch later", "Report" (visual only). Add duration badge on thumbnail (bottom-right, same as home cards). Fix thumb width responsive (168px desktop, 120px mobile already OK).
- **Acceptance criteria**:
  - 3-dot menu appears on related item hover (right side).
  - Click 3-dot then dropdown with 2 options.
  - Click outside then closes.
  - Duration badge on each related thumbnail.
  - Hover bg `rgba(255,255,255,0.05)` maintained.
- **Files**: `YouTubeWatchPage.tsx` (menu state per item), `.module.css` (`.relatedMenu`, `.relatedMenuDropdown`, `.durationBadge` reuse).
- **Complexity**: S

#### C6. Global button press animation
- **Description**: Add `:active` press scale (0.97) to all buttons: icon buttons, action pills, subscribe, comment actions, guide items. Transition 0.1s ease.
- **Acceptance criteria**:
  - All buttons scale to 0.97 on `:active`.
  - Smooth 0.1s transition.
  - Reverts on release.
- **Files**: `.module.css` (add `:active { transform: scale(0.97); }` to `.iconButton`, `.actionBtn`, `.likeBtn`, `.dislikeBtn`, `.subscribeBtn`, `.guideItem`, `.commentActionBtn`, `.chip`).
- **Complexity**: S

#### C7. Skeleton loading states
- **Description**: On video switch (openVideo), show skeleton placeholders for 0.5s: player (gray box with pulse), title (gray bar), metadata (gray bars), related (gray thumbnails). Use existing `.loadingPulse` animation. Then real content fades in.
- **Acceptance criteria**:
  - Click video then skeleton shows for 0.5s.
  - Skeleton: gray `#212121` blocks with pulse animation.
  - After 0.5s then real content fades in (existing `.fadeIn`).
  - No layout shift between skeleton and real content.
- **Files**: `YouTubeWatchPage.tsx` (isLoading state, setTimeout in openVideo), `.module.css` (`.skeletonPlayer`, `.skeletonTitle`, `.skeletonMeta`, `.skeletonRelated`).
- **Complexity**: M

#### C8. Sidebar slide animation polish
- **Description**: When toggling sidebar collapsed/expanded, animate width (0.2s ease OK) + content margin-left同步. Add overlay dim (rgba(0,0,0,0.5)) on mobile when sidebar open. Ensure no jank.
- **Acceptance criteria**:
  - Toggle then sidebar width animates 240px to 72px (0.2s).
  - Content margin-left animates同步.
  - Mobile (<792px): sidebar slides in from left with overlay.
  - No layout jump.
- **Files**: `.module.css` (verify `.guide` transition, add `.sidebarOverlay` for mobile), `YouTubeWatchPage.tsx` (overlay render on mobile).
- **Complexity**: S

#### C9. Page transition animation
- **Description**: Home to watch transition: fade out home grid + fade in watch row (0.3s). Watch to home: reverse. Use existing `.fadeIn` class but add fade-out on unmount.
- **Acceptance criteria**:
  - Click video then home grid fades out (0.2s) then watch fades in (0.3s).
  - Click logo then watch fades out then home fades in.
  - No white flash between.
- **Files**: `YouTubeWatchPage.tsx` (transition state), `.module.css` (`@keyframes fadeOut`, `.fadeOut`).
- **Complexity**: S

#### C10. Comments count formatting + loading
- **Description**: Format comments count with commas (e.g. "16,308 Comments"). Show 3 comments by default + "Show more comments" button that reveals all (mock 10+). Add subtle fade-in on each comment as it appears.
- **Acceptance criteria**:
  - Count formatted with commas.
  - 3 comments visible initially.
  - "Show more comments" button reveals remaining.
  - Each comment fades in (stagger 0.05s).
- **Files**: `YouTubeWatchPage.tsx` (expanded comments state, more mock comments), `.module.css` (`@keyframes commentFadeIn`, `.commentItem` animation).
- **Complexity**: S

---

## 3. Verification Checklist

### Header
- [ ] DOM: `header.masthead` height 56px, fixed top 0, z-index 2000.
- [ ] Search input focus then border `#1c62b9`, search icon visible at left.
- [ ] Search suggestions dropdown appears, 6+ rows, click fills input.
- [ ] Voice button click then modal overlay `rgba(0,0,0,0.6)` + mic pulse.
- [ ] Create button click then dropdown with "Upload video" + "Go live".
- [ ] Icon button hover then bg `rgba(255,255,255,0.1)`, active then scale 0.97.
- [ ] Tooltip appears on hover after 0.5s.

### Sidebar
- [ ] Expanded: 240px, 5 sections with dividers.
- [ ] "You" item with chevron.
- [ ] Live subscriptions: red dot 8px on avatar.
- [ ] "Show more" toggles subscriptions list.
- [ ] Footer links at bottom (2-column, 12px `#aaa`).
- [ ] Collapsed: 72px, only 4 items, label 10px.
- [ ] Active item: bg `rgba(255,255,255,0.12)`, font-weight 500.
- [ ] Hover: bg `rgba(255,255,255,0.08)`, 10px radius.
- [ ] Mobile: sidebar hidden, bottom nav visible (5 items).

### Home Page
- [ ] Chips bar: sticky top 56px, horizontal scroll, "All" active.
- [ ] Chip click then active moves.
- [ ] Video grid: gap 16px, cards responsive.
- [ ] Duration badge on each thumbnail (bottom-right).
- [ ] 3-dot menu on card hover.
- [ ] Channel name hover then `#f1f1f1`.
- [ ] Thumbnail hover then radius 12px to 0 top.

### Player
- [ ] No native browser controls.
- [ ] Center play button when paused (64px, fades when playing).
- [ ] Click video / spacebar toggles play/pause.
- [ ] Seekbar: red progress, buffered gray, hover expands 4px to 8px.
- [ ] Seekbar drag then scrubs.
- [ ] Time display "0:00 / 3:45" updates.
- [ ] Volume button: hover then slider popup, wheel adjusts.
- [ ] Settings gear: speed menu works (playbackRate updates).
- [ ] CC toggle: on/off, subtitles styled (white on dark, bottom).
- [ ] Fullscreen: button + double-click + Esc exit.
- [ ] Theater: full-width, sidebar hidden.
- [ ] Miniplayer: floats bottom-right on scroll.
- [ ] Controls auto-hide after 3s playing.

### Watch Metadata
- [ ] Title: font-weight 400, line-height 26px, 20px.
- [ ] Channel name: font-weight 400.
- [ ] Subscribe: radius 18px, hover `#c5c5c5`.
- [ ] Subscribe click then "Subscribed" + bell icon.
- [ ] Action pills: radius 18px.
- [ ] Like click then blue `#3ea6ff` + count +1 + bounce.
- [ ] Like click again then revert.
- [ ] "Thanks", "Clip", "Report" buttons present.
- [ ] Description: "...more" collapsed, "Show less" expanded.
- [ ] Description expand: smooth height animation 0.3s.
- [ ] Hashtags blue `#3ea6ff`.
- [ ] Share modal: social icons + URL + Copy + "Copied!" feedback.

### Comments
- [ ] Count formatted with commas.
- [ ] Sort dropdown: "Top comments" / "Newest first", reorders.
- [ ] Input focus then border `#f1f1f1` + Cancel/Comment buttons.
- [ ] Type text then Comment enables.
- [ ] Submit then comment appears at top.
- [ ] First comment pinned (pin icon + label).
- [ ] Creator heart on like button.
- [ ] "View N replies" expands/collapses replies.
- [ ] Like click then bounce + blue + count +1.
- [ ] Like/dislike mutually exclusive.

### Related Videos
- [ ] Thumb 168px desktop, 120px mobile.
- [ ] Title 2-line clamp.
- [ ] 3-dot menu on hover.
- [ ] Duration badge on thumbnail.
- [ ] Hover bg `rgba(255,255,255,0.05)`.

### Animations
- [ ] Button press scale 0.97 on all buttons.
- [ ] Sidebar slide 0.2s smooth.
- [ ] Description expand smooth height.
- [ ] Like bounce animation.
- [ ] Skeleton loading 0.5s on video switch.
- [ ] Page transition fade (home to watch).
- [ ] Comment stagger fade-in.
- [ ] Chip active state transition.

### Responsive
- [ ] Desktop (>1280px): full sidebar, 5-col grid.
- [ ] Tablet (792-1280px): sidebar, 3-4 col grid.
- [ ] Mobile (<792px): bottom nav, 1-col grid, search icon only.
- [ ] Watch page: <1024px stacks (related below).
- [ ] No horizontal scroll on any breakpoint.

### Build
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] No new dependencies in `package.json`.
- [ ] Multi-video switching works.
- [ ] Subtitles (VTT) still work with CC toggle.

---

## 4. Priority Order

### P0 — Blocking (must do first)
1. **A6. Home page chips/filters bar** — completely missing, very visible.
2. **B1. Custom player controls — play/pause + center button** — native controls look nothing like YouTube.
3. **B2. Custom player controls — seekbar/timeline** — core player feature.

### P1 — Important (do after P0)
4. **A4. Sidebar structure + sections** — structure mismatch very visible.
5. **A5. Mini-guide (collapsed sidebar) fix** — wrong items + sizing.
6. **A7. Home video card improvements** — duration badge, 3-dot, gap fix.
7. **B3. Custom player controls — volume**.
8. **B4. Custom player controls — settings menu**.
9. **B5. Custom player controls — CC toggle + subtitles**.
10. **B6. Custom player controls — fullscreen + theater + miniplayer**.
11. **B7. Watch title + channel info fixes** — font-weight, subscribe state.
12. **B8. Action bar fixes + like animation**.
13. **B9. Description expand/collapse animation + content**.
14. **A1. Search bar focus state + suggestions dropdown**.
15. **A8. Mobile bottom nav bar**.

### P2 — Nice-to-have (do last)
16. **A2. Voice search popup modal**.
17. **A3. Create button dropdown menu**.
18. **A9. Header tooltip on icon hover**.
19. **B10. Share popup modal**.
20. **C1. Comments sort dropdown**.
21. **C2. Comment input focus state + buttons**.
22. **C3. Comment item — pinned + creator heart + replies expand**.
23. **C4. Comment like animation**.
24. **C5. Related videos — 3-dot menu + duration badge + hover**.
25. **C6. Global button press animation**.
26. **C7. Skeleton loading states**.
27. **C8. Sidebar slide animation polish**.
28. **C9. Page transition animation**.
29. **C10. Comments count formatting + loading**.

---

## Coordination Notes for Doer Agents

- **Stream A** owns: `YouTubeWatchPage.tsx` header + sidebar + home sections, `.module.css` header/sidebar/home rules, `YouTubeIcons.tsx` new sidebar/explore icons.
- **Stream B** owns: `YouTubeWatchPage.tsx` player + watch metadata sections, `.module.css` player/metadata rules, `YouTubeIcons.tsx` new player icons.
- **Stream C** owns: `YouTubeWatchPage.tsx` comments + related sections, `.module.css` comments/related/animation rules, `YouTubeIcons.tsx` new comment icons.
- **Conflict avoidance**: Each stream works on distinct CSS class prefixes (A: `.masthead*`, `.guide*`, `.video*`, `.chip*`; B: `.player*`, `.watch*`, `.action*`, `.desc*`, `.subscribe*`; C: `.comment*`, `.related*`, `.skeleton*`, global `@keyframes`). Merge conflicts resolved by class prefix ownership.
- **Shared state**: `view`, `activeIdx`, `sidebarCollapsed` are shared — Stream A owns these. Streams B/C consume read-only.
- **Build gate**: After each task, run `npm run typecheck && npm run build`. Fix before next task.
