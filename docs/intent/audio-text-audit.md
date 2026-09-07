# Copy Audit — Audio sections (Pronunciation · Local Pronunciation · TTS)

## Scope
- `SettingsDialogContent.tsx` — card 7.4 `Pronunciation`, card 7.5 `Local Pronunciation`, card 10 `TTS Voices`
- `PronunciationSettingsPanel.tsx` + `.module.css`
- `LocalPronunciationSettingsPanel.tsx`
- `TtsVoiceManagerPanel.tsx` + `.module.css`
- `TtsLanguagePanel.tsx` (rendered inside card 10)
- `src/shared/i18n/messages/{en,vi}.json`
- `.devin/skills/audit-text-in-ui/SKILL.md` (W/S/E/L rules)

---

## Extract table

| # | file:line | Bề mặt | Hiện tại | Verdict | Đề xuất | Key |
|---|-----------|--------|----------|---------|---------|-----|
| 1 | `SettingsDialogContent.tsx:164` | nav-label | `Pronunciation` | FAIL(L1) | `Pronunciation` | `settings.nav.pronunciation` |
| 2 | `SettingsDialogContent.tsx:165` | nav-label | `Local Pronunciation` | FAIL(L1, W5) | `Local audio` | `settings.nav.localPronunciation` |
| 3 | `SettingsDialogContent.tsx:168` | nav-label | `TTS Voices` | FAIL(L1, W5) | `Read-aloud` | `settings.nav.tts` |
| 4 | `SettingsDialogContent.tsx:555` | card-title | `Pronunciation` | FAIL(L1) | `Pronunciation` | `settings.pronunciation.title` |
| 5 | `SettingsDialogContent.tsx:556` | card-desc | `Choose and reorder the audio source fallback chain.` | FAIL(L1, W5) | `Choose and reorder audio sources for word playback.` | `settings.pronunciation.desc` |
| 6 | `SettingsDialogContent.tsx:573` | card-title | `Local Pronunciation` | FAIL(L1, W5) | `Local audio` | `settings.localPronunciation.title` |
| 7 | `SettingsDialogContent.tsx:574` | card-desc | `Use a local Forvo/Lingvo DSL audio package.` | FAIL(L1, W5) | `Use audio files stored on your device.` | `settings.localPronunciation.desc` |
| 8 | `SettingsDialogContent.tsx:650` | card-title | `TTS Voices` | FAIL(L1, W5) | `Read-aloud voices` | `settings.tts.title` |
| 9 | `SettingsDialogContent.tsx:651` | card-desc | `Enable TTS, select voices, and configure autoplay count.` | FAIL(L1, W5) | `Choose voices and how many times to play them.` | `settings.tts.desc` |
| 10 | `PronunciationSettingsPanel.tsx:15` | label | `Local Forvo package` | FAIL(L1, W5) | `Forvo audio (offline)` | `settings.pronunciation.engine.localFile` |
| 11 | `PronunciationSettingsPanel.tsx:16` | label | `Community audio (Wikimedia)` | FAIL(L1, W5) | `Community audio (Wikimedia)` | `settings.pronunciation.engine.native` |
| 12 | `PronunciationSettingsPanel.tsx:17` | label | `Supertonic cloud TTS` | FAIL(L1, W5) | `Cloud speech (Supertonic)` | `settings.pronunciation.engine.supertonic` |
| 13 | `PronunciationSettingsPanel.tsx:18` | label | `Browser / Google TTS` | FAIL(L1, W5) | `Browser speech` | `settings.pronunciation.engine.browserTts` |
| 14 | `PronunciationSettingsPanel.tsx:19` | label | `eSpeak on-device TTS` | FAIL(L1, W5) | `Device speech (eSpeak)` | `settings.pronunciation.engine.espeak` |
| 15 | `PronunciationSettingsPanel.tsx:42` | label | `Audio source priority` | FAIL(L1, W9) | `Audio source order` | `settings.pronunciation.sourcePriority.label` |
| 16 | `PronunciationSettingsPanel.tsx:44` | description | `Engines are tried in order. Drag is not supported; use the up/down buttons to reorder.` | FAIL(L1, W3, W5, W8) | `Audio sources are tried from top to bottom. Use the buttons to change the order.` | `settings.pronunciation.sourcePriority.desc` |
| 17 | `PronunciationSettingsPanel.tsx:60` | button | `Up` | FAIL(L1, S-Button) | `Move up` | `settings.pronunciation.priority.moveUp` |
| 18 | `PronunciationSettingsPanel.tsx:69` | button | `Down` | FAIL(L1, S-Button) | `Move down` | `settings.pronunciation.priority.moveDown` |
| 19 | `PronunciationSettingsPanel.tsx:58` | aria-label | `Move ${ENGINE_LABELS[engine]} up` | FAIL(L1, W?) | `Move up in the list` | `settings.pronunciation.priority.moveUpAria` |
| 20 | `PronunciationSettingsPanel.tsx:67` | aria-label | `Move ${ENGINE_LABELS[engine]} down` | FAIL(L1, W?) | `Move down in the list` | `settings.pronunciation.priority.moveDownAria` |
| 21 | `PronunciationSettingsPanel.tsx:77` | label | `Download eSpeak TTS data` | FAIL(L1, W5) | `Download offline speech data` | `settings.pronunciation.espeakData.label` |
| 22 | `PronunciationSettingsPanel.tsx:81` | aria-label | `Download eSpeak TTS data on demand` | FAIL(L1, W5) | `Download speech data when needed` | `settings.pronunciation.espeakData.aria` |
| 23 | `LocalPronunciationSettingsPanel.tsx:36` | file-type-label | `Lingvo DSL` | FAIL(L1, W5) | `Lingvo DSL files` | `settings.localPronunciation.fileType.dsl` |
| 24 | `LocalPronunciationSettingsPanel.tsx:50` | file-type-label | `ZIP archive` | FAIL(L1) | `ZIP audio archive` | `settings.localPronunciation.fileType.zip` |
| 25 | `LocalPronunciationSettingsPanel.tsx:41` | status | `Selected DSL: ${handle.name}` | FAIL(L1, L2, W5) | `Selected index file: $1` | `settings.localPronunciation.status.selectedDsl` |
| 26 | `LocalPronunciationSettingsPanel.tsx:43` | error | `Failed to select DSL file` | FAIL(L1, W5) | `Could not select the index file.` | `settings.localPronunciation.error.selectDsl` |
| 27 | `LocalPronunciationSettingsPanel.tsx:55` | status | `Selected archive: ${handle.name}` | FAIL(L1, L2) | `Selected audio archive: $1` | `settings.localPronunciation.status.selectedArchive` |
| 28 | `LocalPronunciationSettingsPanel.tsx:57` | error | `Failed to select archive` | FAIL(L1) | `Could not select the audio archive.` | `settings.localPronunciation.error.selectArchive` |
| 29 | `LocalPronunciationSettingsPanel.tsx:67` | status | `Selected split directory: ${handle.name}` | FAIL(L1, L2) | `Selected audio folder: $1` | `settings.localPronunciation.status.selectedFolder` |
| 30 | `LocalPronunciationSettingsPanel.tsx:69` | error | `Failed to select split directory` | FAIL(L1) | `Could not select the audio folder.` | `settings.localPronunciation.error.selectFolder` |
| 31 | `LocalPronunciationSettingsPanel.tsx:75` | error | `Select a .dsl file first` | FAIL(L1, W5) | `Choose an index file first.` | `settings.localPronunciation.error.selectDslFirst` |
| 32 | `LocalPronunciationSettingsPanel.tsx:78` | status | `Reading .dsl...` | FAIL(L1, W5) | `Reading index file…` | `settings.localPronunciation.status.reading` |
| 33 | `LocalPronunciationSettingsPanel.tsx:82` | error | `Stored DSL handle is missing or not a file.` | FAIL(L1, W5) | `The selected index file is missing.` | `settings.localPronunciation.error.missingFile` |
| 34 | `LocalPronunciationSettingsPanel.tsx:86` | error | `Permission denied for DSL file.` | FAIL(L1, W5) | `Cannot read the selected file. Check permissions.` | `settings.localPronunciation.error.permission` |
| 35 | `LocalPronunciationSettingsPanel.tsx:94` | status | `Indexed ${entries.length} entries.` | FAIL(L1, L2) | `Indexed $1 entries.` | `settings.localPronunciation.status.indexedCount` |
| 36 | `LocalPronunciationSettingsPanel.tsx:96` | error | `Failed to build index` | FAIL(L1) | `Could not build the index. Try again.` | `settings.localPronunciation.error.buildIndex` |
| 37 | `LocalPronunciationSettingsPanel.tsx:103` | label | `Package type` | FAIL(L1) | `Package type` | `settings.localPronunciation.packageType.label` |
| 38 | `LocalPronunciationSettingsPanel.tsx:108` | option | `Single .dsl.files.zip` | FAIL(L1, W5) | `Single zip file` | `settings.localPronunciation.packageType.single` |
| 39 | `LocalPronunciationSettingsPanel.tsx:109` | option | `Split zips (per first letter)` | FAIL(L1) | `Split by first letter` | `settings.localPronunciation.packageType.split` |
| 40 | `LocalPronunciationSettingsPanel.tsx:116` | label | `Lingvo DSL index` | FAIL(L1, W5) | `Dictionary index` | `settings.localPronunciation.dslFile.label` |
| 41 | `LocalPronunciationSettingsPanel.tsx:118` | button | `Choose .dsl file` | FAIL(L1, W5) | `Choose .dsl file` | `settings.localPronunciation.dslFile.choose` |
| 42 | `LocalPronunciationSettingsPanel.tsx:118` | button | `Change .dsl file` | FAIL(L1, W5) | `Change .dsl file` | `settings.localPronunciation.dslFile.change` |
| 43 | `LocalPronunciationSettingsPanel.tsx:124` | label | `Audio archive` | FAIL(L1) | `Audio archive` | `settings.localPronunciation.archive.label` |
| 44 | `LocalPronunciationSettingsPanel.tsx:126` | button | `Choose .dsl.files.zip` | FAIL(L1, W5) | `Choose audio archive` | `settings.localPronunciation.archive.choose` |
| 45 | `LocalPronunciationSettingsPanel.tsx:126` | button | `Change .zip` | FAIL(L1) | `Change audio archive` | `settings.localPronunciation.archive.change` |
| 46 | `LocalPronunciationSettingsPanel.tsx:132` | label | `Split zip directory` | FAIL(L1) | `Audio folder` | `settings.localPronunciation.splitDirectory.label` |
| 47 | `LocalPronunciationSettingsPanel.tsx:134` | button | `Choose split zip directory` | FAIL(L1) | `Choose audio folder` | `settings.localPronunciation.splitDirectory.choose` |
| 48 | `LocalPronunciationSettingsPanel.tsx:134` | button | `Change directory` | FAIL(L1) | `Change audio folder` | `settings.localPronunciation.splitDirectory.change` |
| 49 | `LocalPronunciationSettingsPanel.tsx:138` | label | `Archive name pattern` | FAIL(L1) | `File name pattern` | `settings.localPronunciation.splitPattern.label` |
| 50 | `LocalPronunciationSettingsPanel.tsx:143` | placeholder | `ForvoEnglish_{firstLetter}.zip` | FAIL(L1) | `ForvoEnglish_{firstLetter}.zip` | `settings.localPronunciation.splitPattern.placeholder` |
| 51 | `LocalPronunciationSettingsPanel.tsx:150` | label | `Index build` | FAIL(L1, S-Label) | `Index` | `settings.localPronunciation.buildIndex.label` |
| 52 | `LocalPronunciationSettingsPanel.tsx:152` | button | `Build index` | FAIL(L1, S-Button) | `Build index` | `settings.localPronunciation.buildIndex.action` |
| 53 | `LocalPronunciationSettingsPanel.tsx:158` | label | `Status` | FAIL(L1) | `Status` | `settings.localPronunciation.status.label` |
| 54 | `LocalPronunciationSettingsPanel.tsx:165` | label | `Last indexed` | FAIL(L1) | `Last indexed` | `settings.localPronunciation.lastIndexed.label` |
| 55 | `TtsVoiceManagerPanel.tsx:116` | error | `Không thể tải danh sách giọng đọc: ${String(e)}` | FAIL(L1, L2, L6) | `Could not load the voice list. Try again.` | `settings.tts.error.loadVoices` |
| 56 | `TtsVoiceManagerPanel.tsx:166` | status | `Đã lưu cài đặt TTS.` | FAIL(L1, W5) | `Saved read-aloud settings.` | `settings.tts.status.saved` |
| 57 | `TtsVoiceManagerPanel.tsx:175` | error | `Lỗi phát âm thanh: ${String(e)}` | FAIL(L1, L2, L6) | `Could not play audio. Try again.` | `settings.tts.error.play` |
| 58 | `TtsVoiceManagerPanel.tsx:242` | error | `Chọn ít nhất một giọng để phát.` | FAIL(L1) | `Select at least one voice to play.` | `settings.tts.error.noSelection` |
| 59 | `TtsVoiceManagerPanel.tsx:252` | error | `Lỗi phát âm thanh: ${String(e)}` | FAIL(L1, L2, L6) | `Could not play audio. Try again.` | `settings.tts.error.play` |
| 60 | `TtsVoiceManagerPanel.tsx:265` | status | `Đã lưu ${saved.length} giọng đọc.` | FAIL(L1, L2) | `Saved $1 voices.` | `settings.tts.status.savedVoices` |
| 61 | `TtsVoiceManagerPanel.tsx:276` | card-title | `Text-to-Speech (TTS)` | FAIL(L1, W5) | `Read-aloud` | `settings.tts.settings.title` |
| 62 | `TtsVoiceManagerPanel.tsx:280` | label | `Enable TTS` | FAIL(L1, W5) | `Read words aloud` | `settings.tts.enabled.label` |
| 63 | `TtsVoiceManagerPanel.tsx:285` | aria-label | `Enable TSI` | FAIL(L1, W5) | `Turn read-aloud on or off` | `settings.tts.enabled.aria` |
| 64 | `TtsVoiceManagerPanel.tsx:288` | hint | `Read example sentence` | FAIL(L1, W9) | `Also read example sentences` | `settings.tts.enabled.hint` |
| 65 | `TtsVoiceManagerPanel.tsx:293` | label | `Show buttons` | FAIL(L1, W5) | `Voice choices to show` | `settings.tts.maxDisplay.label` |
| 66 | `TtsVoiceManagerPanel.tsx:300-302` | option | `1`, `2`, `3` | FAIL(L1) | `$1` | `settings.tts.maxDisplay.option` |
| 67 | `TtsVoiceManagerPanel.tsx:309` | label | `Voice selection` | FAIL(L1, W9) | `Priority voices` | `settings.tts.priorityVoices.label` |
| 68 | `TtsVoiceManagerPanel.tsx:312` | loading | `Đang tải danh sách giọng đọc…` | FAIL(L1) | `Loading voices…` | `settings.tts.priorityVoices.loading` |
| 69 | `TtsVoiceManagerManagerPanel.tsx:314` | empty | `Không có giọng đọc nào.` | FAIL(L1) | `No voices found.` | `settings.tts.priorityVoices.empty` |
| 70 | `TtsVoiceManagerPanel.tsx:323` | aria-label | `Phát giọng ${v.voiceName}` | FAIL(L1, L2) | `Play $1` | `settings.tts.play.aria` |
| 71 | `TtsVoiceManagerPanel.tsx:350` | label | `Autoplay` | FAIL(L1, W5) | `Auto-play count` | `settings.tts.autoplay.label` |
| 72 | `TtsVoiceManagerPanel.tsx:357-360` | option | `0`, `1`, `2`, `3` | FAIL(L1) | `$1` | `settings.tts.autoplay.option` |
| 73 | `TtsVoiceManagerPanel.tsx:368` | button | `Save settings` | FAIL(L1, S-Button) | `Save read-aloud settings` | `settings.tts.saveSettings` |
| 74 | `TtsVoiceManagerPanel.tsx:377` | card-title | `TTS Tester` | FAIL(L1, W5) | `Voice tester` | `settings.tts.tester.title` |
| 75 | `TtsVoiceManagerPanel.tsx:381` | label | `Sentence` | FAIL(L1) | `Test sentence` | `settings.tts.tester.sentence.label` |
| 76 | `TtsVoiceManagerPanel.tsx:388` | placeholder | `Type a sentence to test` | FAIL(L1, W8) | `Type a sentence to hear` | `settings.tts.tester.sentence.placeholder` |
| 77 | `TtsVoiceManagerPanel.tsx:395` | label | `Filter by country` | FAIL(L1, W6) | `Filter by language` | `settings.tts.tester.languageFilter.label` |
| 78 | `TtsVoiceManagerPanel.tsx:402` | option | `All countries` | FAIL(L1, W6) | `All languages` | `settings.tts.tester.languageFilter.all` |
| 79 | `TtsVoiceManagerPanel.tsx:410` | label | `Voices` | FAIL(L1, W9) | `Test voices` | `settings.tts.tester.voices.label` |
| 80 | `TtsVoiceManagerPanel.tsx:418` | button | `Delete selection ({selectedCount})` | FAIL(L1, L2, S-Button, W6) | `Clear selection ($1)` | `settings.tts.tester.clearSelection` |
| 81 | `TtsVoiceManagerPanel.tsx:427` | button | `Play all audios` | FAIL(L1, S-Button, W?) | `Play selected` | `settings.tts.tester.playSelected` |
| 82 | `TtsVoiceManagerPanel.tsx:434` | button | `Save TTS voice list` | FAIL(L1, W5, S-Button) | `Save selected voices` | `settings.tts.tester.saveSelected` |
| 83 | `TtsVoiceManagerPanel.tsx:455` | aria-label | `Thứ tự` | FAIL(L1) | `Order number` | `settings.tts.tester.order.aria` |
| 84 | `TtsVoiceManagerPanel.tsx:461` | aria-label | `Phát giọng ${row.voiceName}` | FAIL(L1, L2) | `Play $1` | `settings.tts.play.aria` |
| 85 | `TtsLanguagePanel.tsx:128` | label | `Local TTS (Supertonic v3)` | FAIL(L1, W5) | `Local speech (Supertonic)` | `settings.tts.localTts.label` |
| 86 | `TtsLanguagePanel.tsx:132` | aria-label | `Bật tắt local TTS` | FAIL(L1, W5) | `Turn local speech on or off` | `settings.tts.localTts.aria` |
| 87 | `TtsLanguagePanel.tsx:141` | label | `Ngôn ngữ phát mặc định` | FAIL(L1) | `Default playback language` | `settings.tts.localTts.defaultLanguage.label` |
| 88 | `TtsLanguagePanel.tsx:146` | placeholder | `Chọn ngôn ngữ` | FAIL(L1) | `Select a language` | `settings.tts.localTts.defaultLanguage.placeholder` |
| 89 | `TtsLanguagePanel.tsx:153` | section-title | `Voice pack đã tải` | FAIL(L1, W5) | `Downloaded voice packs` | `settings.tts.localTts.downloaded.section` |
| 90 | `TtsLanguagePanel.tsx:157` | empty | `Chưa có voice pack nào.` | FAIL(L1, W5) | `No voice packs downloaded yet.` | `settings.tts.localTts.downloaded.empty` |
| 91 | `TtsLanguagePanel.tsx:166` | badge | `Ẩn` | FAIL(L1) | `Hidden` | `settings.tts.localTts.badge.hidden` |
| 92 | `TtsLanguagePanel.tsx:168` | badge | `Đang tải…` | FAIL(L1) | `Downloading…` | `settings.tts.localTts.badge.downloading` |
| 93 | `TtsLanguagePanel.tsx:173` | aria-label | `Hiện ${language}` | FAIL(L1, L2) | `Show $1` | `settings.tts.localTts.actions.show` |
| 94 | `TtsLanguagePanel.tsx:173` | aria-label | `Ẩn ${language}` | FAIL(L1, L2) | `Hide $1` | `settings.tts.localTts.actions.hide` |
| 95 | `TtsLanguagePanel.tsx:174` | title | `Hiện` | FAIL(L1) | `Show` | `settings.tts.localTts.actions.showTitle` |
| 96 | `TtsLanguagePanel.tsx:174` | title | `Ẩn` | FAIL(L1) | `Hide` | `settings.tts.localTts.actions.hideTitle` |
| 97 | `TtsLanguagePanel.tsx:183` | aria-label | `Tải lại ${language}` | FAIL(L1, L2) | `Re-download $1` | `settings.tts.localTts.actions.redownload` |
| 98 | `TtsLanguagePanel.tsx:184` | title | `Tải lại` | FAIL(L1) | `Re-download` | `settings.tts.localTts.actions.redownloadTitle` |
| 99 | `TtsLanguagePanel.tsx:194` | aria-label | `Xóa ${language}` | FAIL(L1, L2) | `Delete $1` | `settings.tts.localTts.actions.delete` |
| 100 | `TtsLanguagePanel.tsx:195` | title | `Xóa` | FAIL(L1) | `Delete` | `settings.tts.localTts.actions.deleteTitle` |
| 101 | `TtsLanguagePanel.tsx:225` | placeholder | `Thêm ngôn ngữ` | FAIL(L1) | `Add a language` | `settings.tts.localTts.add.placeholder` |
| 102 | `TtsLanguagePanel.tsx:241` | button | `Tải` | FAIL(L1, S-Button) | `Download` | `settings.tts.localTts.download` |
| 103 | `TtsLanguagePanel.tsx:71` | error | `Tải voice pack thất bại` | FAIL(L1, W5, L6) | `Could not download the voice pack.` | `settings.tts.localTts.error.download` |
| 104 | `TtsLanguagePanel.tsx:245` | error-display | `{error}` (raw `err.message`) | FAIL(L6) | Map to `settings.tts.localTts.error.load` and `console.warn` raw | `settings.tts.localTts.error.load` |

> **Raw error text** (`err.message`, `String(e)`) also appears at `TtsVoiceManagerPanel:116,175,252` and `LocalPronunciationSettingsPanel:43,57,69,96`. These need boundary mapping before display (L6).

---

## Tổng kết

- **Literal cần đưa vào i18n:** 103 chuỗi user-visible (đã liệt kê ở bảng trên; ngoài ra còn ~5 dòng raw `err.message` cần bọc lỗi thân thiện).
- **Vi phạm blocking:**
  - `L1` (hardcode, chưa qua `t()`): ~103
  - `L2` (nối chuỗi / thiếu placeholder): ~15
  - `L6` (error code/message nội bộ trôi ra UI): ~8
  - `W5` (jargon / thuật ngữ kỹ thuật chưa giải thích): ~35
  - `W6` (sai khái niệm / tên không nhất quán, e.g. `country` thực ra là `language`): 2
  - `W8` (chữ vá UI / mô tả những gì UI không làm được): 1
- **Verdict tổng thể:** **REWRITE + NEEDS I18N** — toàn bộ 3 section đều cần viết lại copy, đưa hết vào `t(key)`, và bổ sung đủ `en`/`vi`. Đặc biệt cần map tất cả error raw trước khi render.

---

## Proposed i18n keys

| Key | en | vi |
|-----|----|----|
| `settings.nav.pronunciation` | `Pronunciation` | `Phát âm` |
| `settings.nav.localPronunciation` | `Local audio` | `Âm thanh nội bộ` |
| `settings.nav.tts` | `Read-aloud` | `Đọc to` |
| `settings.pronunciation.title` | `Pronunciation` | `Phát âm` |
| `settings.pronunciation.desc` | `Choose and reorder audio sources for word playback.` | `Chọn và sắp xếp nguồn âm thanh khi tra từ.` |
| `settings.localPronunciation.title` | `Local audio` | `Âm thanh nội bộ` |
| `settings.localPronunciation.desc` | `Use audio files stored on your device.` | `Dùng tệp âm thanh đã lưu trên máy.` |
| `settings.tts.title` | `Read-aloud voices` | `Giọng đọc to` |
| `settings.tts.desc` | `Choose voices and how many times to play them.` | `Chọn giọng đọc và số lần tự động phát.` |
| `settings.pronunciation.engine.localFile` | `Forvo audio (offline)` | `Âm thanh Forvo (ngoại tuyến)` |
| `settings.pronunciation.engine.native` | `Community audio (Wikimedia)` | `Âm thanh cộng đồng (Wikimedia)` |
| `settings.pronunciation.engine.supertonic` | `Cloud speech (Supertonic)` | `Đọc to đám mây (Supertonic)` |
| `settings.pronunciation.engine.browserTts` | `Browser speech` | `Đọc to của trình duyệt` |
| `settings.pronunciation.engine.espeak` | `Device speech (eSpeak)` | `Đọc to trên máy (eSpeak)` |
| `settings.pronunciation.sourcePriority.label` | `Audio source order` | `Thứ tự nguồn âm thanh` |
| `settings.pronunciation.sourcePriority.desc` | `Audio sources are tried from top to bottom. Use the buttons to change the order.` | `Nguồn âm thanh được thử từ trên xuống. Dùng nút để đổi thứ tự.` |
| `settings.pronunciation.priority.moveUp` | `Move up` | `Đưa lên` |
| `settings.pronunciation.priority.moveDown` | `Move down` | `Đưa xuống` |
| `settings.pronunciation.priority.moveUpAria` | `Move up in the list` | `Đưa lên trong danh sách` |
| `settings.pronunciation.priority.moveDownAria` | `Move down in the list` | `Đưa xuống trong danh sách` |
| `settings.pronunciation.espeakData.label` | `Download offline speech data` | `Tải dữ liệu đọc nội bộ` |
| `settings.pronunciation.espeakData.aria` | `Download speech data when needed` | `Tải dữ liệu đọc khi cần` |
| `settings.localPronunciation.fileType.dsl` | `Lingvo DSL files` | `Tệp từ điển Lingvo DSL` |
| `settings.localPronunciation.fileType.zip` | `ZIP audio archive` | `Tệp nén kho âm thanh` |
| `settings.localPronunciation.status.selectedDsl` | `Selected index file: $1` | `Đã chọn tệp chỉ mục: $1` |
| `settings.localPronunciation.error.selectDsl` | `Could not select the index file.` | `Không chọn được tệp chỉ mục.` |
| `settings.localPronunciation.status.selectedArchive` | `Selected audio archive: $1` | `Đã chọn kho âm thanh: $1` |
| `settings.localPronunciation.error.selectArchive` | `Could not select the audio archive.` | `Không chọn được kho âm thanh.` |
| `settings.localPronunciation.status.selectedFolder` | `Selected audio folder: $1` | `Đã chọn thư mục âm thanh: $1` |
| `settings.localPronunciation.error.selectFolder` | `Could not select the audio folder.` | `Không chọn được thư mục âm thanh.` |
| `settings.localPronunciation.error.selectDslFirst` | `Choose an index file first.` | `Hãy chọn tệp chỉ mục trước.` |
| `settings.localPronunciation.status.reading` | `Reading index file…` | `Đang đọc tệp chỉ mục…` |
| `settings.localPronunciation.error.missingFile` | `The selected index file is missing.` | `Tệp chỉ mục đã chọn không còn tồn tại.` |
| `settings.localPronunciation.error.permission` | `Cannot read the selected file. Check permissions.` | `Không đọc được tệp đã chọn. Hãy kiểm tra quyền truy cập.` |
| `settings.localPronunciation.status.indexedCount` | `Indexed $1 entries.` | `Đã lập chỉ mục $1 mục.` |
| `settings.localPronunciation.error.buildIndex` | `Could not build the index. Try again.` | `Không tạo được chỉ mục. Thử lại nhé.` |
| `settings.localPronunciation.packageType.label` | `Package type` | `Loại gói` |
| `settings.localPronunciation.packageType.single` | `Single zip file` | `Một tệp zip` |
| `settings.localPronunciation.packageType.split` | `Split by first letter` | `Chia theo chữ cái đầu` |
| `settings.localPronunciation.dslFile.label` | `Dictionary index` | `Chỉ mục từ điển` |
| `settings.localPronunciation.dslFile.choose` | `Choose .dsl file` | `Chọn tệp .dsl` |
| `settings.localPronunciation.dslFile.change` | `Change .dsl file` | `Thay đổi tệp .dsl` |
| `settings.localPronunciation.archive.label` | `Audio archive` | `Kho âm thanh` |
| `settings.localPronunciation.archive.choose` | `Choose audio archive` | `Chọn kho âm thanh` |
| `settings.localPronunciation.archive.change` | `Change audio archive` | `Thay đổi kho âm thanh` |
| `settings.localPronunciation.splitDirectory.label` | `Audio folder` | `Thư mục âm thanh` |
| `settings.localPronunciation.splitDirectory.choose` | `Choose audio folder` | `Chọn thư mục âm thanh` |
| `settings.localPronunciation.splitDirectory.change` | `Change audio folder` | `Thay đổi thư mục âm thanh` |
| `settings.localPronunciation.splitPattern.label` | `File name pattern` | `Mẫu tên tệp` |
| `settings.localPronunciation.splitPattern.placeholder` | `ForvoEnglish_{firstLetter}.zip` | `ForvoEnglish_{firstLetter}.zip` |
| `settings.localPronunciation.buildIndex.label` | `Index` | `Chỉ mục` |
| `settings.localPronunciation.buildIndex.action` | `Build index` | `Tạo chỉ mục` |
| `settings.localPronunciation.status.label` | `Status` | `Trạng thái` |
| `settings.localPronunciation.lastIndexed.label` | `Last indexed` | `Lập chỉ mục lần cuối` |
| `settings.tts.error.loadVoices` | `Could not load the voice list. Try again.` | `Không tải được danh sách giọng. Thử lại nhé.` |
| `settings.tts.status.saved` | `Saved read-aloud settings.` | `Đã lưu cài đặt đọc to.` |
| `settings.tts.error.play` | `Could not play audio. Try again.` | `Không phát được âm thanh. Thử lại nhé.` |
| `settings.tts.error.noSelection` | `Select at least one voice to play.` | `Hãy chọn ít nhất một giọng để nghe thử.` |
| `settings.tts.status.savedVoices` | `Saved $1 voices.` | `Đã lưu $1 giọng đọc.` |
| `settings.tts.settings.title` | `Read-aloud` | `Đọc to` |
| `settings.tts.enabled.label` | `Read words aloud` | `Đọc to từ` |
| `settings.tts.enabled.aria` | `Turn read-aloud on or off` | `Bật/tắt đọc to` |
| `settings.tts.enabled.hint` | `Also read example sentences` | `Cũng đọc cả câu ví dụ` |
| `settings.tts.maxDisplay.label` | `Voice choices to show` | `Số nút đọc to hiển thị` |
| `settings.tts.maxDisplay.option` | `$1` | `$1` |
| `settings.tts.priorityVoices.label` | `Priority voices` | `Giọng ưu tiên` |
| `settings.tts.priorityVoices.loading` | `Loading voices…` | `Đang tải danh sách giọng…` |
| `settings.tts.priorityVoices.empty` | `No voices found.` | `Chưa có giọng đọc nào.` |
| `settings.tts.play.aria` | `Play $1` | `Nghe thử $1` |
| `settings.tts.autoplay.label` | `Auto-play count` | `Số lần tự động phát` |
| `settings.tts.autoplay.option` | `$1` | `$1` |
| `settings.tts.saveSettings` | `Save read-aloud settings` | `Lưu cài đặt đọc to` |
| `settings.tts.tester.title` | `Voice tester` | `Kiểm tra giọng` |
| `settings.tts.tester.sentence.label` | `Test sentence` | `Câu thử` |
| `settings.tts.tester.sentence.placeholder` | `Type a sentence to hear` | `Nhập câu để nghe thử` |
| `settings.tts.tester.languageFilter.label` | `Filter by language` | `Lọc theo ngôn ngữ` |
| `settings.tts.tester.languageFilter.all` | `All languages` | `Tất cả ngôn ngữ` |
| `settings.tts.tester.voices.label` | `Test voices` | `Các giọng thử` |
| `settings.tts.tester.clearSelection` | `Clear selection ($1)` | `Bỏ chọn ($1)` |
| `settings.tts.tester.playSelected` | `Play selected` | `Phát các giọng đã chọn` |
| `settings.tts.tester.saveSelected` | `Save selected voices` | `Lưu các giọng đã chọn` |
| `settings.tts.tester.order.aria` | `Order number` | `Số thứ tự` |
| `settings.tts.localTts.label` | `Local speech (Supertonic)` | `Đọc to nội bộ (Supertonic)` |
| `settings.tts.localTts.aria` | `Turn local speech on or off` | `Bật/tắt đọc to nội bộ` |
| `settings.tts.localTts.defaultLanguage.label` | `Default playback language` | `Ngôn ngữ phát mặc định` |
| `settings.tts.localTts.defaultLanguage.placeholder` | `Select a language` | `Chọn ngôn ngữ` |
| `settings.tts.localTts.downloaded.section` | `Downloaded voice packs` | `Gói giọng đã tải` |
| `settings.tts.localTts.downloaded.empty` | `No voice packs downloaded yet.` | `Chưa có gói giọng nào.` |
| `settings.tts.localTts.badge.hidden` | `Hidden` | `Ẩn` |
| `settings.tts.localTts.badge.downloading` | `Downloading…` | `Đang tải…` |
| `settings.tts.localTts.actions.show` | `Show $1` | `Hiện $1` |
| `settings.tts.localTts.actions.hide` | `Hide $1` | `Ẩn $1` |
| `settings.tts.localTts.actions.showTitle` | `Show` | `Hiện` |
| `settings.tts.localTts.actions.hideTitle` | `Hide` | `Ẩn` |
| `settings.tts.localTts.actions.redownload` | `Re-download $1` | `Tải lại $1` |
| `settings.tts.localTts.actions.redownloadTitle` | `Re-download` | `Tải lại` |
| `settings.tts.localTts.actions.delete` | `Delete $1` | `Xóa $1` |
| `settings.tts.localTts.actions.deleteTitle` | `Delete` | `Xóa` |
| `settings.tts.localTts.add.placeholder` | `Add a language` | `Thêm ngôn ngữ` |
| `settings.tts.localTts.download` | `Download` | `Tải xuống` |
| `settings.tts.localTts.error.download` | `Could not download the voice pack.` | `Không tải được gói giọng.` |
| `settings.tts.localTts.error.load` | `Could not load the voice pack.` | `Không tải được gói giọng.` |

---

## Notes / next actions for parent

1. **No source code was changed** — this is a read-only audit as requested.
2. The report file has been persisted to `docs/intent/audio-text-audit.md`.
3. After approval, the implementation pass should:
   - Add all proposed keys to `src/shared/i18n/messages/en.json` and `vi.json`.
   - Replace every hardcoded literal in the 3 sections with `t(key)`.
   - Map raw `err.message` / `String(e)` to friendly keys at the boundary and `console.warn` the raw value.
   - Remove redundant `aria-label` where the visible label already identifies the control.
   - Run `npm run typecheck` to catch any missing keys.
