# UI Prototype Variants — Video Downloader Popup Redesign

> 3 design variants for the 400×600px Chrome extension popup.
> Each variant is a complete layout spec with ASCII wireframes, component breakdown,
> information architecture, and implementation notes.
>
> **Design system:** Orca (Cluely Light / Midnight Command Center)
> **Constraint:** 400×600px fixed popup window
> **Framework:** React + Zustand + CSS Modules

---

## Shared Component Library (all variants)

These components are used across all 3 variants. Each variant composes them differently.

### Updated Components

| Component | Props | Purpose |
|-----------|-------|---------|
| `Header` | isActive, onToggle, onTheme, onSettings | Title + 3 icon buttons |
| `MediaCard` | media, onDownload, onSelectQuality | Unified card for video/subtitle |
| `DownloadCard` | download, onCancel, onPause, onResume | Download item with full progress |
| `ProgressBar` | progress, status, phase? | Animated bar with phase segments |
| `ProgressDetail` | fileSize, processedBytes, workerCount, ... | Inline detail chips |
| `SettingsSheet` | settings, onChange, isOpen | Slide-up settings panel |
| `EmptyState` | type, message, action? | Empty/error state with CTA |
| `StatChip` | label, value, icon? | Compact stat display |
| `SegmentProgress` | current, total | Dotted segment indicator |

### New Components Needed

| Component | Purpose |
|-----------|---------|
| `DownloadCard` | Replaces inline download rendering; adds cancel/pause/resume buttons |
| `StatChip` | Compact stat display (file size, workers, speed) |
| `SegmentProgress` | Visual dot/bar indicator for segment progress |
| `SettingsSheet` | Slide-up bottom sheet (replaces collapsible/modal) |
| `SearchBar` | Filter detected media by title/URL |
| `ConversionModeBadge` | Shows "Parallel 4W" or "Sequential" badge |

---

## Variant A — Compact Dashboard

### Design Philosophy
**"Everything at a glance, minimal navigation."**

A single-scroll dashboard that shows detected media and active downloads together.
No tabs. Settings slide up from bottom. Optimized for quick action — see media, click download, watch progress.

### Layout (400×600px)

```
┌──────────────────────────────────────────┐
│  ◉ Video Downloader          ☀ ⚙ ▌      │ ← Header (40px)
├──────────────────────────────────────────┤
│  ┌────────────────────────────────────┐  │
│  │ 🔍 Search media...                │  │ ← Search bar (36px)
│  └────────────────────────────────────┘  │
├──────────────────────────────────────────┤
│  MEDIA (3)                    Download All│ ← Section header
│  ┌────────────────────────────────────┐  │
│  │ ▶ Movie Title           1080p ⬇    │  │ ← MediaCard (video)
│  │   m3u8 · 2 variants · 445 MB       │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ ▶ Another Video         720p  ⬇    │  │ ← MediaCard (video)
│  │   mp4 · 1 variant · 120 MB         │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ T  Subtitle (en)         vtt  ⬇    │  │ ← MediaCard (subtitle)
│  └────────────────────────────────────┘  │
├──────────────────────────────────────────┤
│  DOWNLOADS (2)                           │ ← Section header
│  ┌────────────────────────────────────┐  │
│  │ Movie Title              ⏸ ✕       │  │ ← DownloadCard
│  │ ████████████░░░░░░  68%  Converting │  │
│  │ ▸ 212 MB / 445 MB  ⚡4W  parallel   │  │ ← ProgressDetail
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ Another Video            ✕         │  │ ← DownloadCard
│  │ ████████████████████ 100%  Done     │  │
│  │ ▸ 120 MB                  1.2s      │  │
│  └────────────────────────────────────┘  │
│                                          │
│  (scrollable area)                       │
├──────────────────────────────────────────┤
│        ⌃ Settings                         │ ← Settings tab handle
└──────────────────────────────────────────┘
```

### Settings Sheet (slides up from bottom)

```
┌──────────────────────────────────────────┐
│  Settings                        ⌄       │
├──────────────────────────────────────────┤
│  ── Download ──                          │
│  Concurrent downloads      [ 3  ]        │
│  Segment fetch concurrency [ 6  ]        │
│  Default quality           [highest ▾]   │
│  Subtitle language         [en   ]       │
│                                          │
│  ── Conversion ──                        │
│  TS→MP4 conversion         [always  ▾]   │
│  Parallel mode             [auto    ▾]   │
│  Worker count              [ 4  ]        │
│  Fallback if parallel fails [save-ts ▾]  │
│                                          │
│  ── Appearance ──                        │
│  Theme                     [light  ▾]   │
└──────────────────────────────────────────┘
```

### Information Architecture
```
Root
├── Header (fixed)
│   ├── Extension toggle (◉/○)
│   ├── Theme toggle (☀/☾)
│   └── Settings button (⚙)
├── Search bar (fixed, collapsible)
├── Scrollable content
│   ├── Media section
│   │   ├── Section header + "Download All" button
│   │   ├── MediaCard[] (videos + subtitles mixed)
│   │   └── EmptyState (if no media)
│   └── Downloads section
│       ├── Section header + count
│       ├── DownloadCard[] (with ProgressDetail)
│       └── EmptyState (if no downloads)
└── Settings sheet (slide-up overlay)
```

### Key Design Decisions
- **No tabs** — media and downloads visible together, scroll naturally
- **Search bar** — filter media by title/URL when many detected
- **Download All** inline with section header (not a big button)
- **Settings as bottom sheet** — slides up, doesn't navigate away
- **DownloadCard** includes cancel (✕) and pause (⏸) buttons
- **ProgressDetail** shows: bytes processed / total, worker count, parallel badge, duration
- **ConversionModeBadge** shows "⚡4W parallel" or "Sequential"

### Pros
- Everything visible without switching
- Fastest path from detect → download → monitor
- Minimal cognitive load

### Cons
- Can get long with many media items + downloads
- No visual separation between video/subtitle types
- Search bar takes vertical space

---

## Variant B — Activity-Centric

### Design Philosophy
**"Downloads first. Media discovery is secondary."**

The popup opens to the Downloads/Activity tab. Media detection is accessed via a
compact top strip. The focus is on monitoring and managing active/completed downloads.
A live activity feed shows conversion phases in real-time.

### Layout (400×600px)

```
┌──────────────────────────────────────────┐
│  ◉ Video Downloader          ☀ ⚙ ▌      │ ← Header (40px)
├──────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐│
│  │ 📺 3 videos  ·  T 1 subtitle  ⬇ All ││ ← Media strip (48px)
│  └──────────────────────────────────────┘│
├──────────────────────────────────────────┤
│  ACTIVE (1)                    COMPLETED │ ← Filter tabs
│  ─────────────                            │
│  ┌──────────────────────────────────────┐│
│  │ Movie Title                    ⏸ ✕  ││ ← DownloadCard (active)
│  │ ┌──────────────────────────────────┐ ││
│  │ │ ████████████░░░░░░░  68%        │ ││ ← ProgressBar
│  │ └──────────────────────────────────┘ ││
│  │  Converting · transmuxing            ││ ← Phase label
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐││
│  │  │212MB │ │⚡4W   │ │parall│ │1.2s  │││ ← StatChips row
│  │  │/445MB│ │workers│ │el    │ │      │││
│  │  └──────┘ └──────┘ └──────┘ └──────┘││
│  └──────────────────────────────────────┘│
│                                          │
│  ┌──────────────────────────────────────┐│
│  │ ── Activity Feed ──                  ││ ← Activity feed
│  │ 10:42 PM  Started download           ││
│  │ 10:42 PM  Fetched 50/310 segments    ││
│  │ 10:43 PM  Fetched 310/310 segments   ││
│  │ 10:43 PM  Download complete (445 MB) ││
│  │ 10:43 PM  Starting conversion...     ││
│  │ 10:43 PM  Planning parallel (4W)     ││
│  │ 10:43 PM  Transmuxing group 0... ✓  ││
│  │ 10:43 PM  Transmuxing group 1... ✓  ││
│  │ 10:43 PM  Transmuxing group 2... ⏳ ││
│  └──────────────────────────────────────┘│
│                                          │
│  (scrollable)                            │
├──────────────────────────────────────────┤
│  ◆ Active   ✓ Completed   ⚙ Settings    │ ← Bottom nav (56px)
└──────────────────────────────────────────┘
```

### Media Strip (expanded when clicked)

```
┌──────────────────────────────────────────┐
│  📺 3 videos  ·  T 1 subtitle  ⬇ All  ⌃ │
├──────────────────────────────────────────┤
│  ┌────────────────────────────────────┐  │
│  │ ▶ Movie Title           1080p ⬇    │  │
│  │   m3u8 · 2 variants · 445 MB       │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ ▶ Another Video         720p  ⬇    │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ T  Subtitle (en)         vtt  ⬇    │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### Completed Tab

```
┌──────────────────────────────────────────┐
│  COMPLETED (5)                           │
│  ┌────────────────────────────────────┐  │
│  │ ✓ Another Video        120 MB  ↗   │  │ ← Completed card
│  │   mp4 · 1.2s · sequential          │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ ✓ Old Movie            445 MB  ↗   │  │
│  │   mp4 · 3.4s · ⚡4W parallel        │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### Information Architecture
```
Root
├── Header (fixed)
├── Media strip (fixed, expandable)
│   ├── Summary: "3 videos · 1 subtitle"
│   ├── Download All button
│   └── Expand → MediaCard[] list
├── Filter tabs (Active / Completed)
├── Scrollable content
│   ├── Active: DownloadCard[] + Activity Feed
│   └── Completed: CompletedCard[] with retry/re-download
└── Bottom navigation (fixed)
    ├── Active tab
    ├── Completed tab
    └── Settings (opens sheet)
```

### Key Design Decisions
- **Downloads first** — popup opens to active downloads, not media list
- **Media strip** — compact summary at top, expands to show cards
- **Activity feed** — real-time log of conversion phases (planning, transmuxing group N, merging, validating)
- **StatChips** — bytes, workers, mode, duration as compact chips below progress bar
- **Bottom navigation** — Active / Completed / Settings (thumb-friendly)
- **Completed tab** — persists completed downloads with file info + re-download
- **Filter tabs** — separate active from completed downloads

### Pros
- Best for monitoring long downloads/conversions
- Activity feed gives transparency into parallel conversion
- Completed downloads persist (not lost on popup close)
- Bottom nav is thumb-friendly

### Cons
- Media discovery requires extra click (expand strip)
- Activity feed takes vertical space
- More complex state management (activity log, completed list)

---

## Variant C — Split-View Command Center

### Design Philosophy
**"Power user control center. See everything, control everything."**

A split-view layout: media on top half, downloads on bottom half. A persistent
status bar shows system stats (CPU cores, active workers, OPFS usage). Settings
open as a side panel. Designed for users who want maximum information density.

### Layout (400×600px)

```
┌──────────────────────────────────────────┐
│  ◉ Video Downloader          ☀ ⚙ ▌      │ ← Header (40px)
├──────────────────────────────────────────┤
│  CPU: 20  Workers: 4/6  OPFS: 1.2GB/5GB │ ← Status bar (28px)
├──────────────────────────────────────────┤
│  MEDIA  (3)                     ⬇ All   │ ← Section header (32px)
│  ┌────────────────────────────────────┐  │
│  │ ▶ Movie Title           1080p ⬇    │  │ ← MediaCard
│  │   m3u8 · 2 variants · 445 MB       │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ ▶ Another Video         720p  ⬇    │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ T  Subtitle (en)         vtt  ⬇    │  │
│  └────────────────────────────────────┘  │
├──────────────────────────────────────────┤
│  DOWNLOADS (2)                           │ ← Section header (32px)
│  ┌────────────────────────────────────┐  │
│  │ Movie Title              ⏸ ✕       │  │
│  │ ████████████░░░░ 68%  Converting    │  │
│  │ 212MB/445MB ⚡4W parallel  transmux │  │
│  │ ●●●●●●●●●●○○○○○  9/14 groups       │  │ ← SegmentProgress
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ Another Video            ✕         │  │
│  │ ████████████████████ 100% Done      │  │
│  │ 120MB  sequential  1.2s             │  │
│  └────────────────────────────────────┘  │
├──────────────────────────────────────────┤
│  ◆ Ready · Auto-parallel enabled         │ ← Footer status (28px)
└──────────────────────────────────────────┘
```

### Settings Side Panel (slides in from right)

```
┌──────────────────────┬───────────────────┐
│  (dimmed main view)  │  Settings    ⌄    │
│                      │───────────────────│
│                      │  Download         │
│                      │  Concurrent [ 3 ] │
│                      │  Seg concurrency  │
│                      │             [ 6 ] │
│                      │  Quality [highest▾]│
│                      │  Language  [en  ] │
│                      │                   │
│                      │  Conversion       │
│                      │  TS→MP4 [always ▾]│
│                      │  Parallel [auto ▾]│
│                      │  Workers  [ 4  ]  │
│                      │  Fallback [save-ts▾]│
│                      │                   │
│                      │  Appearance       │
│                      │  Theme  [light ▾] │
│                      │                   │
│                      │  System           │
│                      │  CPU cores: 20    │
│                      │  Max workers: 6   │
│                      │  OPFS: 1.2GB/5GB  │
└──────────────────────┴───────────────────┘
```

### Information Architecture
```
Root
├── Header (fixed)
├── Status bar (fixed)
│   ├── CPU cores
│   ├── Active workers / max
│   └── OPFS usage
├── Split view (scrollable)
│   ├── Top half: Media section
│   │   ├── Section header + Download All
│   │   └── MediaCard[] (compact)
│   └── Bottom half: Downloads section
│       ├── Section header + count
│       └── DownloadCard[] (with SegmentProgress)
├── Footer status (fixed)
│   └── System mode indicator
└── Settings side panel (overlay, slides from right)
    ├── All settings
    └── System info (CPU, workers, OPFS)
```

### Key Design Decisions
- **Split view** — media top, downloads bottom, both visible
- **Status bar** — system stats: CPU cores, active workers, OPFS quota usage
- **SegmentProgress** — dotted indicator showing group completion (●●●●○○)
- **Settings side panel** — slides from right, dims main view, includes system info
- **Footer status** — shows auto-enablement state ("Auto-parallel enabled")
- **Compact cards** — less padding, more info density
- **System info in settings** — CPU cores, max workers, OPFS usage visible

### Pros
- Maximum information density
- System stats visible (power users care about CPU/workers/OPFS)
- Both media and downloads visible without scrolling
- Segment-level progress visualization

### Cons
- Can feel cramped at 400px width
- Status bar takes vertical space
- Not as thumb-friendly (content at top)
- May overwhelm casual users

---

## Comparison Matrix

| Criterion | Variant A (Dashboard) | Variant B (Activity) | Variant C (Command Center) |
|-----------|----------------------|----------------------|---------------------------|
| **Primary user** | Casual | Monitor-focused | Power user |
| **First screen** | Media + Downloads | Active downloads | Media (top) + Downloads (bottom) |
| **Media visibility** | High (scrollable list) | Medium (expandable strip) | High (top half) |
| **Download monitoring** | Medium (scroll to see) | High (primary focus) | High (bottom half) |
| **Settings access** | Bottom sheet | Bottom nav tab | Side panel |
| **Info density** | Medium | Medium | High |
| **Activity feed** | No | Yes | No |
| **System stats** | No | No | Yes (status bar) |
| **Segment progress** | No | No | Yes (dotted) |
| **Cancel/Pause UI** | Yes (in card) | Yes (in card) | Yes (in card) |
| **Search/filter** | Yes (search bar) | No | No |
| **Completed downloads** | No (ephemeral) | Yes (persisted tab) | No (ephemeral) |
| **Scroll required** | Medium | Low (tabbed) | Low (split view) |
| **Thumb-friendly** | Medium | High (bottom nav) | Low |
| **Implementation effort** | Low | High (activity log, persistence) | Medium |
| **New components** | 4 (SearchBar, DownloadCard, StatChip, SettingsSheet) | 6 (+ActivityFeed, CompletedCard, BottomNav) | 5 (+StatusBar, SegmentProgress, SidePanel, StatChip) |
| **Best for** | Quick detection → download | Long conversions, monitoring | Power users, transparency |

---

## Recommendation

**Variant A (Compact Dashboard)** is recommended as the primary implementation because:

1. **Lowest implementation effort** — reuses most existing components, adds only SearchBar + DownloadCard + SettingsSheet
2. **Fastest user flow** — see media → click download → see progress, all in one scroll
3. **Fits 400×600px naturally** — no split-view cramping, no tab switching
4. **Extensible** — can add activity feed (B) or status bar (C) later without restructure

**However**, the best features from B and C should be incorporated:
- From B: **DownloadCard with cancel/pause/resume buttons** (all variants need this)
- From B: **StatChips** for compact progress detail (better than current ProgressDetail)
- From C: **SegmentProgress** dotted indicator (shows parallel group completion)
- From C: **System info in settings** (CPU cores, max workers, OPFS usage)

### Final recommended hybrid: **Variant A+**
- Variant A layout (single scroll, no tabs)
- DownloadCard with cancel/pause/resume from B
- StatChips from B for progress detail
- SegmentProgress from C for parallel group visualization
- Settings as bottom sheet (from A)
- System info section in settings (from C)
