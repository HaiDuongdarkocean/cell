# Popup Layout/Media Components — Cell Extension

> Location: `src/entrypoints/popup/components/`

## Inventory

| Component | File | Status | Since | Variants | States | a11y | Used in |
|---|---|---|---|---|---|---|---|
| Header | `components/layout/Header.tsx` | stable | 1.0.0 | — | — | semantic h1 | App |
| SelectionBar | `components/SelectionBar.tsx` | stable | 1.0.0 | — | — | aria-label | App |
| VideoCard | `components/media/VideoCard.tsx` | stable | 1.0.0 | — | empty/loading/ready | role=region | App |
| SubtitleCard | `components/media/SubtitleCard.tsx` | stable | 1.0.0 | — | empty/loading/ready | role=region | App |
| DownloadCard | `components/media/DownloadCard.tsx` | stable | 1.0.0 | — | idle/downloading/done/error | aria-live=polite | App |
| MediaEmpty | `components/media/MediaEmpty.tsx` | stable | 1.0.0 | — | — | role=status | App |

---

## Usage guide — do/don't + code examples

### VideoCard / SubtitleCard / DownloadCard (`src/entrypoints/popup/components/media/`)

| Do | Don't |
|---|---|
| Pass `state` prop (`'empty' | 'loading' | 'ready'` / `'idle' | 'downloading' | 'done' | 'error'`) — card renders the right variant | Conditionally render different components per state — breaks `aria-live` continuity |
| Use `role="region"` (built-in) for screen reader landmark | Wrap in extra `<div role="region">` — double role confuses a11y tree |
| For DownloadCard: rely on `aria-live="polite"` for progress announcements | Manually announce progress via `aria-live="assertive"` — interrupts user |

```tsx
<VideoCard state="ready" video={video} />
<DownloadCard state="downloading" progress={0.65} />
```
