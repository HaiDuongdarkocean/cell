# Spec: Quản lý Audio nén (Condensed Audio)

> Intent: `docs/intent/condensed-audio.md` · ui_surface: yes · Mode: all

## Objective

Biến mọi video có cues thành một file audio chỉ-gồm-thoại (mặc định mp3) mà người immersion mang đi mọi nơi — hai đường sản xuất: **leg A** đọc file (FileSystemFileHandle/OPFS) + cắt-ghép nhanh hơn realtime bằng ffmpeg wasm trong offscreen; **leg B** ghi realtime trong khi phát với gap-skip (`skipNoDialogue=JUMP` semantics) + `video.captureStream()` cho streaming không tải được. Kết quả đăng ký vào tab **Playlist** (universal panel) + export ra thư mục user chọn + sync Drive per-item. Tất cả chạy như durable job.

## Actor ↔ System Boundary

| Actor | Triggers | Inputs | Receives/Views |
|---|---|---|---|
| User (immersionist) | Start condense từ subtitle panel; pick export dir; play/delete/sync item trong Playlist; cancel job | Video đang mở có cues; export dir handle; item actions | Job progress/result; playlist items; file mp3 trên disk/Drive |
| System ngoài: Google Drive | — | file bytes khi user bấm sync | file trong folder Drive |
| Anki/site host | — | — | — (không liên quan) |

System-internal processing never includes human behavior.

## Requirements

### Functional

REQ-1: Khởi tạo condense từ subtitle panel
- Actor: user
- Goal: tạo condensed audio cho media đang xem
- Preconditions: session có cues (streaming đã load sub, hoặc local-player video có subtitle record)
- Basic flow:
  1. user bấm action "Condensed audio" trong subtitle panel
  2. system resolve nguồn: file handle/OPFS video tồn tại → leg A; không → leg B
  3. system tạo job `condenseAudio` + `CondensedAudioRecord` (status `processing`) và bắt đầu xử lý
  4. system báo progress qua job events; hoàn tất → record `ready`
- Alt flow: user chọn leg B chủ động dù có file (VD muốn record kèm khoảng JUMP phát hiện tại) — [assumption: giữ đơn giản — leg A mặc định, không expose chọn leg; leg B chỉ khi không có file]
- Exception: không có cues → action disabled/báo "cần subtitle"; job đã tồn tại cho cùng source → dedupe theo JobRegistry identity
- Rules: một source → một record non-terminal; retry sau `failed` supersede record cũ (ghi đè/đánh dấu superseded), không nhân đôi record
- Postcondition: job queued/running; record tồn tại
- NFR refs: NFR-3, NFR-4

REQ-2: Leg A — condense từ file (faster-than-realtime)
- Actor: (không — system-triggered bởi REQ-1)
- Goal: file audio chỉ-thoại từ video file + cue timings
- Preconditions: video file đọc được (FileSystemFileHandle từ VideoRecord hoặc OPFS `downloads/{id}/output.mp4`); cue list parse được (SubtitleRecord fileHandle → srt/vtt parser hiện có, hoặc cues đang loaded)
- Basic flow:
  1. system (offscreen) tính danh sách khoảng thoại: merge cue ranges overlap + padding `padMs` (default 500ms, setting)
  2. system chạy ffmpeg wasm (`public/ffmpeg/` vendored): `atrim` từng khoảng → `concat` → encode mp3 → ghi OPFS `condensed/{id}.mp3`
  3. system cập nhật record + progress job
- Alt flow: encoder mp3 vắng trong vendored core → fallback m4a (AAC) nếu khả dụng, cuối cùng opus — record `mimeType` thật
- Exception: file quá lớn cho wasm MEMFS → mount WORKERFS hoặc fail với lý do rõ; ffmpeg lỗi → job failed + record `failed` kèm error
- Rules: không load toàn bộ file vào ArrayBuffer trong SW; mọi IO nặng ở offscreen
- Postcondition: `condensed/{id}.{ext}` tồn tại trong OPFS; record ready
- NFR refs: NFR-1, NFR-2, NFR-3

REQ-3: Leg B — realtime record session (streaming không tải được)
- Actor: user (start/stop), system (drive playback)
- Goal: ghi audio phần-thoại khi video phát — output condensed "miễn phí" vì playback nhảy qua gap
- Preconditions: video element hiện hữu + cues loaded; tab đang foreground hoặc tiếp tục phát được
- Basic flow:
  1. user start → system bật record session: ép gap-skip behavior (JUMP semantics — không mutate `advanced.skipNoDialogue` của user, áp trong session scope), `video.captureStream()` → MediaRecorder audio-only timeslice ~5s, target bitrate ~96kbps (browser default nếu không set được — revisit nếu output vượt ~45MB/giờ)
  2. system stream chunk: content script → background → offscreen append OPFS `condensed/{id}.part.webm`
  3. video kết thúc hoặc user stop → system finalize: concat/encode mp3 → `condensed/{id}.mp3`, record `ready`
- Alt flow: user seek tay → session tiếp tục từ vị trí mới (ghi đúng phần phát), hoặc auto-stop nếu seek ra ngoài vùng chưa ghi — chọn đơn giản: tiếp tục ghi theo playback thực
- Exception: `captureStream` trả track muted/rỗng (DRM/EME) → detect 0 audio → fail-closed "không ghi được (DRM?)"; tab/video dừng >10s → pause session, resume khi phát lại; đóng tab → job failed, `.part` discard
- Rules: playback rate 1× trong session; session không resume được sau browser restart (record là volatile) — job mark failed với lý do, user re-run
- Postcondition: record ready hoặc failed với reason; `.part` cleanup
- NFR refs: NFR-2, NFR-3, NFR-5

REQ-4: Export ra thư mục user chọn
- Actor: user (cấu hình path lần đầu / đổi trong settings)
- Goal: file mp3 nằm ở thư mục user quản lý
- Basic flow:
  1. job finalize → system đọc setting `condensedAudio.exportDirHandleId`
  2. null → `exportState=pending` + Playlist hiện action "Chọn thư mục export" trên item; user bấm (transient activation) → `showDirectoryPicker` → persist handle qua `localFileHandleStorage` → ghi file
  3. system ghi `{title-safe}.mp3` vào dir; user cancel picker → giữ OPFS copy, record vẫn `ready` với `exportState=pending`
- Exception: handle mất permission → re-request `queryPermission/requestPermission` từ user gesture; vẫn fail → record `ready` + `exportState=failed` có reason
- Rules: permission theo chuẩn File System Access; file name sanitize
- Postcondition: file tồn tại trong export dir hoặc export state rõ ràng
- NFR refs: NFR-5

REQ-5: Playlist tab — liệt kê & thao tác items
- Actor: user
- Goal: một chỗ xem lại mọi condensed audio + nghe thử + đồng bộ
- Basic flow:
  1. user mở tab "Playlist" trong universal panel
  2. system liệt kê `CondensedAudioRecord` (mới nhất trước): title, duration, size, status, nguồn
  3. per-item actions: play/pause preview (OPFS blob → `<audio>`), "save a copy" (`showSaveFilePicker` khi chưa export/chọn nơi khác), sync Drive, delete (xóa OPFS + record; export trên disk giữ nguyên), retry khi failed
- Exception: OPFS file mất (quota eviction) → item báo `missing` + action re-run nguồn; item bị delete giữa lúc job chạy → finalize check record tồn tại, absent → discard output
- Rules: chỉ condensed audio items — watch-later là feature sau (không nằm item này)
- NFR refs: NFR-4, NFR-5

REQ-6: Sync Drive per item
- Actor: user
- Goal: file lên Drive để nghe trên phone
- Basic flow:
  1. user bấm sync trên item `ready`
  2. system đọc OPFS file → upload qua Drive provider infra (`googleDriveStorageProvider` resumable upload) vào folder condensed-audio (tạo nếu chưa có)
  3. record `driveFileId` + `driveSyncedAt`; UI hiện synced state
- Exception: chưa OAuth/no permission → báo link tới sync settings; upload fail → retry được
- Rules: sync là user-initiated per item (không auto-upload — NFR-4)
- NFR refs: NFR-4, NFR-5

REQ-7: Durable job + progress
- Actor: user (observe/cancel)
- Preconditions: `jobs`/`entities/job` registry tồn tại
- Basic flow: job `condenseAudio` (cap 1) → progress persist `chrome.storage.session` → JOB_EVENT broadcast → JobRow render; SW restart → restore+reconcile (leg A re-run được; leg B → failed do volatile)
- Alt flow (cancel): user cancel → system abort runner/MediaRecorder → xóa `.part` + output tạm trong OPFS → record `failed` với reason `cancelled` → job terminal `cancelled`
- Rules: reuse JobRegistry contract verbatim — không tự viết progress plumbing; cancel luôn cleanup partial output
- NFR refs: NFR-3

### Non-functional (NFR)

| ID | Requirement | Class | Target |
|---|---|---|---|
| NFR-1 | Leg A nhanh hơn realtime rõ rệt | P | < 25% duration video trên desktop tham chiếu |
| NFR-2 | RAM persona ≥1GB | R/resource | Không giữ >1 file lớn trong memory; chunk/stream IO; leg B chunk ≤ vài MB/message |
| NFR-3 | Job sống sót SW/browser restart theo contract jobs hiện hữu | R | leg A idempotent re-run; leg B fail sạch |
| NFR-4 | Privacy/local-first | +privacy | Không upload gì ngoài Drive sync do user bấm; không telemetry |
| NFR-5 | Feedback rõ | U | Progress %, lý do fail human-readable (i18n en/vi), không console.error câm |
| NFR-6 | Tương thích phát | S | Output mp3 (m4a/opus fallback documented) chơi được trên phone players phổ biến |

## Flows / States

**Source resolution (REQ-1):**
```
start condense → có FileSystemFileHandle/OPFS video? 
  ├─ yes → leg A (REQ-2)
  └─ no  → cues loaded? ├─ yes → leg B (REQ-3)
                        └─ no  → reject "cần subtitle"
```

**Job state:** `queued --start→ running --progress→ running --done→ succeeded/failed --(user retry)→ running`. Leg B riêng: `running --tab closed/SW death→ failed (volatile, .part discarded)`.

## Function ↔ Feature Map

| Function (system does) | Features (tools) |
|---|---|
| Cắt-ghép audio theo cue ranges | Cue-range planner (merge + padMs); leg A ffmpeg offscreen pipeline; leg B captureStream record session; JUMP-gap driver |
| Lưu trữ & liệt kê condensed items | `condensedAudio` IDB store + record; Playlist tab (list/play/delete/retry); OPFS `condensed/` layout |
| Export ra ngoài extension | Export-dir setting + picker (`exportDirHandleId`); Drive sync action per item (`driveFileId`) |
| Theo dõi tác vụ dài | JobRegistry `condenseAudio` kind; JobRow progress trong Playlist; cancel |

## Data

| Entity | Key fields | Lives in | Retention |
|---|---|---|---|
| `CondensedAudioRecord` | id, title, source{kind:library\|opfs\|stream, ref}, durationMs, sizeBytes, mimeType, opfsPath, exportFilename, exportState, driveFileId?, status(processing/ready/failed/missing), error?, createdAt | IDB store `condensedAudio` (orca-local-player DB) | persist tới khi user delete |
| Audio file | `condensed/{id}.mp3` (+`.part.webm` tạm) | OPFS extension | theo record |
| Setting | `condensedAudio.exportDirHandleId`, `condensedAudio.padMs` (default 500) | settings store (persist) | user-controlled |
| Job | kind `condenseAudio`, params{recordId}, progress% | JobRegistry + `chrome.storage.session` | theo jobs contract |

## Traceability

| Need (intent) | REQ | AC |
|---|---|---|
| N1 file chỉ-thoại từ video có cues | REQ-1,2,3 | SC-1,2 |
| N2 leg A nhanh | REQ-2 | SC-1,3 |
| N3 leg B streaming | REQ-3 | SC-2,4 |
| N4 output portable (disk+Playlist+Drive) | REQ-4,5,6 | SC-5,6,7 |
| N5 durable job | REQ-7 | SC-8 |
| N6 padding tự nhiên | REQ-2 (padMs) | SC-9 |

| Journey step | REQ |
|---|---|
| AS-IS 1-3 (pain) | — (bối cảnh) |
| TO-BE 1 action panel | REQ-1 |
| TO-BE 2 leg A/job | REQ-2,7 |
| TO-BE 2 leg B record | REQ-3,7 |
| TO-BE 3 Playlist/Drive | REQ-5,6 |
| TO-BE 4 edge fail-closed | REQ-2,3 exceptions |

## Boundaries

- Always: JobRegistry contract; OPFS cho mọi file nội bộ; i18n en/vi; token/component design system; không console.log
- Ask first: manifest change (`tabCapture` — deferred, xem Open Questions); dependency mới KHÔNG được thêm trong item này (mode `all` không hỏi được) — nếu vendored ffmpeg + WebCodecs đều không encode được → job `failed` với reason rõ, không thêm dep
- Never: upload file không qua user action; hold file lớn trong SW memory; mutate `advanced.skipNoDialogue` của user từ record session

## Success Criteria

- [ ] SC-1: Video local-player/downloaded có cues → mp3 (hoặc fallback format ghi trong record) trong OPFS `condensed/` chỉ chứa khoảng thoại ±padMs; duration < duration video gốc khi có gap.
- [ ] SC-2: Streaming có cues không tải được → record session chạy tới hết → output tương đương leg A (condensed theo JUMP-driven playback).
- [ ] SC-3: Leg A hoàn tất < 25% duration video (desktop), progress hiển thị liên tục.
- [ ] SC-4: captureStream bị chặn/DRM → job failed với reason i18n rõ; không treo; `.part` dọn sạch.
- [ ] SC-5: Export path unset → prompt picker → persist; file xuất hiện trong dir đã chọn; đổi path được trong settings.
- [ ] SC-6: Playlist tab liệt kê items (title/duration/size/status), play preview được, delete xóa OPFS+record.
- [ ] SC-7: Sync Drive per item → file xuất hiện trong Drive folder; `driveFileId` persist; fail → retry được.
- [ ] SC-8: SW restart giữa leg A → job restore và hoàn tất (re-run an toàn); leg B restart → failed sạch.
- [ ] SC-9: Cue ranges merge overlap + pad mặc định 500ms; audio nghe không bị cắt giữa từ (spot check).
- [ ] SC-10: Gates `typecheck + lint + test:unit + build` xanh; real-Chromium verify leg A end-to-end trên mock local video; mọi chuỗi user-facing mới có i18n đủ en/vi.

## Definition of Done

- [ ] Tất cả Success Criteria pass
- [ ] `npm run typecheck && npm run lint && npm run test:unit && npm run build` green
- [ ] UI (Playlist tab, subtitle panel action, export-dir setting, JobRow) qua design-system check + browser verify có screenshot
- [ ] `docs/2-architechture-system.md` + `docs/0-wiki.md` cập nhật; ADR nếu có quyết định kiến trúc mới (kênh addon? không — item này không có)
- [ ] Backlog row → shipped + commit hash; state transition `--to shipped`

## Open Questions / Accepted Risks

- **Vendored `public/ffmpeg/` chưa từng được load** — spike đầu DELIVER: load ffmpeg.js trong offscreen, test `-codec:a libmp3lame` + `atrim/concat` trên sample nhỏ. Nếu core thiếu encoder → fallback AAC m4a (WebCodecs AudioEncoder) hoặc opus; đổi `mimeType` trong record; user-facing contract "file audio" vẫn giữ. [accepted risk]
- **Memory với file lớn**: ffmpeg wasm MEMFS load toàn file — video >~1GB có thể OOM trên máy yếu. Mitigation: WORKERFS mount blob; nếu vẫn fail → reject với message rõ. [accepted risk]
- **Leg B background-tab**: MediaRecorder trên captureStream của tab ẩn có thể throttle → warn user giữ tab sống trong session; không cam kết background-recording ổn định v1. [accepted risk]
- **`chrome.tabCapture`** (record thẳng tab audio — robust hơn captureStream cho DRM-muted nhưng vẫn không vượt DRM thật) cần manifest permission mới → ask-first boundary, deferred sang item riêng nếu leg B coverage thấp. [deferred]
- **Phone playback**: user tự chuyển file/Drive — không build player riêng trên phone. [scope]
