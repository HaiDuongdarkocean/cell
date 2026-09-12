# Plan: Folder Flow — Chọn folder → scan video + subtitle → match → library

## Vấn đề hiện tại
- Flow: chọn video → prompt chọn folder subtitle → scan → match. 2 bước riêng, folder subtitle có thể khác folder video.
- Drop video + subtitle cùng lúc KHÔNG hoạt động (chỉ nhận video).
- Không có flow "chọn folder" để xem danh sách video + tiến trình.

## Flow mới

### Flow 1: Chọn 1 video (giữ nguyên, cải thiện UX)
- Click "Open file" → `showOpenFilePicker()` chọn video
- Video load → tự động prompt `showDirectoryPicker({ id: 'local-player-video' })`
- Chrome nhớ directory (`id` persistence) → nếu video + subtitle cùng folder, user chỉ click "Select Folder" 1 lần
- Lần sau mở video khác từ cùng folder → Chrome nhớ → không cần prompt lại (cached `dirHandleRef`)
- **Không thay đổi logic** — flow này đã hoạt động, chỉ thêm hint text

### Flow 2: Chọn folder (MỚI — library mode)
- Click "Open folder" → `showDirectoryPicker()`
- Scan folder: tìm tất cả video files + subtitle files
- Match mỗi video với subtitle cùng base name (dùng `matchSubtitles` hiện có)
- Build library list với metadata + subtitle status
- Hiển thị library grid với:
  - Title
  - Duration (nếu có)
  - Subtitle status badge (matched / not matched)
  - Resume position (tiến trình %)
- Click video → load video + auto-match subtitle (đã có directory handle → không cần prompt lại)

## Edge cases

1. **Folder không có video** → hiển thị "No videos found in this folder"
2. **Folder có video nhưng không có subtitle** → video vẫn hiển thị, badge "No subtitle"
3. **Folder có nhiều video cùng tên khác resolution** → match theo base name (đã có `stripResolutionSuffix`)
4. **Folder có subtitle nhưng không match video nào** → bỏ qua subtitle
5. **Folder rất lớn (1000+ files)** → scan async, hiển thị progress "Scanning… N files found"
6. **Permission bị revoke** → re-prompt
7. **Video file corrupt** → không parse metadata, vẫn hiển thị với duration 0
8. **Duplicate video (cùng tên + size)** → dedup by ID (`${name}-${size}-${lastModified}`)
9. **Video đã có trong library** → update metadata, không duplicate (upsert)
10. **Resume position persist** → khi mở lại video, seek đến vị trí cũ (đã có)
11. **Browser không support File System Access API** → fallback: ẩn nút "Open folder", giữ "Open file"
12. **User cancel folder picker** → không làm gì
13. **Folder có subfolder** → KHÔNG scan recursive (ponytail: chỉ top-level, tránh scan toàn bộ ổ đĩa)
14. **Video format không hỗ trợ** → filter by extension (.mp4, .webm, .ogg, .ogv, .mov)
15. **Subtitle format không hỗ trợ** → filter by extension (srt, vtt, ass, ssa, ttml, dfxp, sbv, smi)
16. **Folder có video nhưng file handle không lấy được** → skip video, log error

## Implementation

### T1: Thêm `openFolder()` vào `useFileSystemAccess.ts`
- `showDirectoryPicker({ id: 'local-player-folder' })` → return `FileSystemDirectoryHandle | null`

### T2: Thêm `scanFolderForVideos()` vào `src/features/local-player/logic/folderScan.ts`
- Input: `FileSystemDirectoryHandle`
- Output: `{ videos: VideoScanResult[], subtitles: Map<string, File> }`
- `VideoScanResult = { file: File, handle: FileSystemFileHandle, filename: string }`
- Scan `dirHandle.values()` → filter video + subtitle extensions
- **Ponytail**: O(n) scan, n = files in folder. Ceiling: 10k files = ~2s. Upgrade: web worker.

### T3: Thêm `matchVideosWithSubtitles()` vào `folderScan.ts`
- Input: `VideoScanResult[]`, `Map<string, File>`, `targetLang`, `nativeLang`
- Output: `FolderScanResult[]` = `{ video: VideoScanResult, subtitles: SubtitlesState }`
- Dùng `matchSubtitles` hiện có cho mỗi video

### T4: Thêm `onOpenFolder` handler vào `main.tsx`
- `handleOpenFolder()` → `openFolder()` → `scanFolderForVideos()` → `matchVideosWithSubtitles()`
- Build `VideoRecord[]` từ scan results → save to IndexedDB → update library
- Cache `dirHandleRef` + `subtitleFileMapRef` cho lần click video sau

### T5: Thêm nút "Open folder" vào `EmptyState.tsx`
- Button "Open folder" bên cạnh "Open file"
- `onOpenFolder` prop

### T6: Wire `onOpenFolder` qua `PlayerView` → `main.tsx`
- Thêm `onOpenFolder` prop vào `PlayerViewProps`
- Pass xuống `EmptyState`

### T7: Cải thiện `handleVideoSelect` — dùng cached dirHandle
- Khi click video từ library, nếu có `dirHandleRef` cached → scan subtitle cùng folder
- Không cần prompt folder lại

### T8: Thêm subtitle status badge vào `LibraryCard.tsx`
- Hiển thị badge "Sub: ✓" hoặc "Sub: ✗" dựa trên subtitle match result
- Cần thêm field `hasSubtitle` vào `VideoRecord` hoặc compute từ scan

### T9: Tests
- `folderScan.test.ts` — test scan + match logic
- Update `EmptyState.test.tsx` — test "Open folder" button
- Update `PlayerView.test.tsx` — test `onOpenFolder` prop
- Update `main.test.tsx` — test `handleOpenFolder`

### T10: Browser verify
- Pack .crx → spawn browser → navigate to local-player
- Click "Open folder" → select folder với video + subtitle
- Verify library list hiển thị + subtitle badge
- Click video → verify video + subtitle load
