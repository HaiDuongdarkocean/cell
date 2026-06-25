# Blueprint — Cell Language Learning Platform

> **Định vị**: Open-core multi-language learning platform, input-first (nghe + đọc) + shadowing trong SRS, từ beginner đến power user, onboarding tối giản, social layer tạo động lực quần thể.
>
> **MVP scope (đã chốt với Anh yêu)**: Baseline C1-C8 + SRS qua Anki export + dict hybrid (Yomitan + AI). Social tym = phase 2.

---

## A. Logic Chart Tổng quan — Cell Platform

```
CELL LANGUAGE LEARNING PLATFORM
│
├── LAYER 0: FOUNDATION (đã có — Cell hiện tại)
│   ├── Media Detection (network intercept + DOM scan)
│   ├── Download Engine (m3u8/mp4/TS→MP4, parallel, OPFS)
│   ├── Subtitle Detection + Language Detection (hybrid script+frequency)
│   ├── Subtitle Parsing (ASS/VTT/SRT → normalized SRT)
│   ├── Auto-Select + Auto-Download (whitelist)
│   └── Popup UI (React + Zustand, settings, progress)
│
├── LAYER 1: MVP — Learning Baseline (C1-C8 + Anki + Dict)
│   │   ← MỤC TIÊU: biến Cell từ "downloader" → "learning tool"
│   │
│   ├── C1: Video Overlay Extension
│   │   ├── Content script inject trên streaming page (YouTube/Netflix/+educational)
│   │   ├── Subtitle overlay renderer (text-selectable, dual sub)
│   │   └── Playback control (seek by subtitle, auto-pause on unknown)
│   │
│   ├── C2-C3: Interactive Dual Subtitle
│   │   ├── Parse subtitle (reuse existing ASS/VTT/SRT parser)
│   │   ├── Render dual layer: target + native translation
│   │   ├── Click word → trigger lookup (C4)
│   │   └── Keyboard shortcuts (seek, repeat, slow)
│   │
│   ├── C4: Dictionary Lookup (Hybrid Yomitan + AI)
│   │   ├── Yomitan dict format loader (JMdict, CC-CEDICT, Oxford...)
│   │   ├── 1-click word lookup → popup (definition + reading + example)
│   │   ├── AI Explain fallback (ChatGPT) cho ngôn ngữ không có dict
│   │   └── Multi-language: dict selection per target language
│   │
│   ├── C5: Vocabulary Store
│   │   ├── Word entry: word + context sentence + source (video/title/timestamp)
│   │   ├── Wordbook management (per language, per topic)
│   │   ├── Learning status: Unknown / Learning / Known / Ignored
│   │   └── IndexedDB storage (offline-first, sync optional phase sau)
│   │
│   ├── C6: Flashcard Creation (1-click mine)
│   │   ├── Capture: sentence + audio snippet + screenshot + definition
│   │   ├── Card preview + edit before save
│   │   ├── Audio: tabCapture / MediaRecorder (streaming) hoặc video file (local)
│   │   ├── Screenshot: captureVisibleTab
│   │   └── Export target: Anki (.apkg) hoặc Cell wordbook
│   │
│   ├── C7: SRS via Anki Export
│   │   ├── Generate .apkg file (Anki package format)
│   │   ├── Note type: Basic (sentence + audio + screenshot + definition)
│   │   ├── User import manually vào Anki desktop (không cần AnkiConnect)
│   │   ├── Optional: AnkiConnect integration (localhost:8765) cho power user
│   │   └── No self-built SRS — tận dụng Anki ecosystem
│   │
│   └── C8: Streaming Platform Support
│       ├── YouTube adapter (subtitle API + overlay)
│       ├── Netflix adapter (subtitle API + overlay)
│       ├── Educational: Coursera / Udemy / TED (subtitle + overlay)
│       └── Generic: any webpage with <video> + <track>
│
├── LAYER 2: SOCIAL — Community Motivation (phase sau MVP)
│   │   ← Lý thuyết: SDT (Relatedness) + Strava kudos + Octalysis Social Influence
│   │
│   ├── S1: Tym / Cheer (phase 2.1 — rẻ nhất, hiệu quả đã chứng minh)
│   │   ├── Tym tiến trình mine của người học khác ("An vừa mine 50 từ")
│   │   ├── Tym streak milestone ("An đạt 30 ngày streak")
│   │   ├── Notification "X người vừa tym tiến trình của bạn"
│   │   └── Variable reward: không đoán trước ai tym (dopamine)
│   │
│   ├── S2: Activity Feed (phase 2.2)
│   │   ├── Feed nhẹ: xem người khác đang học content gì
│   │   ├── "Hot content" — video nhiều người mine nhất tuần này
│   │   └── Không comment chưa — chỉ tym + xem
│   │
│   ├── S3: Leaderboard theo Cohort (phase 2.3)
│   │   ├── Chia theo: CEFR level + ngôn ngữ + số từ đã biết
│   │   ├── Không trộn trình độ (Festinger similarity hypothesis)
│   │   ├── Upward comparison an toàn (gap nhỏ → motivate, không envy)
│   │   └── Weekly reset + badge
│   │
│   └── S4: Study Group (phase 2.4 — tùy chọn)
│       ├── Group theo ngôn ngữ + trình độ
│       ├── Shared content playlist
│       ├── Co-mining challenge (cùng mine 1 bộ phim)
│       └── Chat nhẹ (text, không voice)
│
├── LAYER 3: AI ENHANCEMENT (phase sau social)
│   │   ← Học từ Migaku + eJOY: AI mở rộng content pool + comprehension
│   │
│   ├── AI-1: Comprehension Score
│   │   ├── Compare video subtitle vocab vs user known-word DB
│   │   ├── % comprehension → recommend "phù hợp trình độ"
│   │   └── "Học N từ nữa để đạt 90% comprehension video này"
│   │
│   ├── AI-2: AI Subtitle Generation (Whisper)
│   │   ├── Generate subtitle cho video không có caption
│   │   ├── Mở rộng content pool (podcast, raw video)
│   │   └── Manual override + edit
│   │
│   ├── AI-3: AI Explain (ChatGPT)
│   │   ├── Giải thích phrase/idiom/grammar in context
│   │   ├── Sentence breakdown
│   │   └── Fallback dict cho ngôn ngữ không có Yomitan dict
│   │
│   └── AI-4: Content Recommendation
│       ├── "Video tiếp theo cho trình độ em" (dựa comprehension + interest)
│       ├── Curated playlist per level
│       └── Học từ eJOY EPIC + Migaku Academy
│
├── LAYER 4: ANNOTATION & POLISH (phase sau AI)
│   │   ← Học từ Migaku: annotation chi tiết per language
│   │
│   ├── P1: Furigana (JP) — hover/all/unknown
│   ├── P2: Pitch Accent (JP) — color-code
│   ├── P3: Pinyin (CN) — hover/all/unknown
│   ├── P4: Frequency badge — star/rank per word
│   ├── P5: Color-coding by learning status (Unknown/Learning/Known/Ignored)
│   └── P6: Playback modes (condensed, auto-pause on unknown, fast-forward)
│
├── LAYER 5: MOBILE & CROSS-DEVICE (phase dài hạn)
│   │   ← Học từ Migaku + eJOY: mobile native
│   │
│   ├── M1: PWA review (review flashcard trên mobile, sync cloud)
│   ├── M2: Mobile overlay (Kiwi/Firefox Android)
│   ├── M3: Native app (iOS/Android) — phase cần team
│   └── M4: Cloud sync (word DB + settings + streak)
│
└── LAYER 6: STRUCTURED COURSE (phase dài hạn — cần content investment)
    │   ← Học từ Migaku Academy + eJOY EPIC
    │
    ├── Onboarding course (hiragana/katakana/pinyin/basics per language)
    ├── Frequency-based vocab curriculum (1500 từ chiếm 80% content)
    ├── CEFR-aligned path
    └── Exam prep wordlist (IELTS/TOEIC/JLPT/HSK)
```

---

## B. Logic Chart Chi tiết — Layer 1 MVP (C1-C8 + Anki + Dict)

```
LAYER 1: MVP — LEARNING BASELINE
│
├── C1: VIDEO OVERLAY EXTENSION
│   │   ← Biến Cell từ "downloader" → "in-page player + learning"
│   │
│   ├── Content Script Inject (per-site adapter)
│   │   ├── YouTube adapter
│   │   │   ├── Hook YouTube subtitle API (ytInitialPlayerResponse)
│   │   │   ├── Detect <video> element + subtitle <track>
│   │   │   └── Inject overlay container (z-index above native sub)
│   │   ├── Netflix adapter
│   │   │   ├── Hook Netflix subtitle API (Netflix player)
│   │   │   ├── Detect video element
│   │   │   └── Inject overlay
│   │   ├── Educational adapter (Coursera/Udemy/TED)
│   │   │   ├── Detect <video> + <track kind="subtitles">
│   │   │   └── Reuse existing pageScanner.ts
│   │   └── Generic adapter
│   │       ├── Any webpage with <video>
│   │       └── BYO subtitle (drag-drop .srt/.vtt)
│   │
│   ├── Subtitle Overlay Renderer
│   │   ├── Parse subtitle (REUSE: m3u8Parser/assParser/vttParser/srtParser)
│   │   ├── Render timed cue list synced to video.currentTime
│   │   ├── Dual layer: target (top) + native translation (bottom)
│   │   ├── Text-selectable (click word → C4 lookup)
│   │   └── Style: font/size/color/position (user setting)
│   │
│   └── Playback Control
│       ├── Seek by subtitle (click cue → jump to timestamp)
│       ├── Auto-pause on unknown word (toggle, check word status)
│       ├── Repeat current subtitle (loop 1 cue)
│       ├── Slow playback (0.5x/0.75x)
│       └── Keyboard shortcuts (←/→ seek, Space pause, R repeat, S slow)
│
├── C2-C3: INTERACTIVE DUAL SUBTITLE
│   │   ← Đã merge vào C1 overlay renderer
│   │
│   ├── Dual Subtitle Logic
│   │   ├── Target subtitle: từ video native subtitle hoặc AI gen
│   │   ├── Native translation: Google Translate API hoặc user-provided .srt
│   │   ├── Display mode: both / target-only / native-only / hover-reveal
│   │   └── IPA phonetic (EN) — optional, per-language toggle
│   │
│   └── Word Interaction
│       ├── Click word → highlight + trigger C4 lookup popup
│       ├── Hover word → tooltip quick definition (if already in wordbook)
│       ├── Right-click phrase → phrase lookup
│       └── Selection → lookup phrase/sentence
│
├── C4: DICTIONARY LOOKUP (Hybrid Yomitan + AI)
│   │   ← Multi-language từ đầu, dict format chuẩn
│   │
│   ├── Yomitan Dict Format Loader
│   │   ├── Parse Yomitan dict format (term_bank_*.json + tag_bank_*.json)
│   │   ├── Supported dicts: JMdict (JP), CC-CEDICT (CN), KRDic (KO)
│   │   ├── Oxford/Cambridge (EN) — nếu có Yomitan-compatible format
│   │   ├── Dict storage: IndexedDB (offline, loaded on first use)
│   │   ├── Dict management UI: enable/disable per language
│   │   └── Dict import: user upload .zip Yomitan dict
│   │
│   ├── Lookup Engine
│   │   ├── Tokenize text per language (MeCab for JP, jieba for CN...)
│   │   ├── Match longest word first (deinflection for JP verbs)
│   │   ├── Return: reading + definition + part-of-speech + frequency
│   │   └── Fuzzy match fallback
│   │
│   ├── AI Explain Fallback (ChatGPT)
│   │   ├── Trigger: khi Yomitan dict không có entry
│   │   ├── Prompt: "Explain [word] in context: [sentence]. Language: [lang]"
│   │   ├── Return: definition + usage + example
│   │   ├── Cache result (IndexedDB) — không gọi lại cùng word+context
│   │   └── User brings own OpenAI key (open-core, no backend cost)
│   │
│   └── Lookup Popup UI
│       ├── Definition + reading + IPA
│       ├── Example sentences (from dict or Word Hunt — phase sau)
│       ├── Frequency badge
│       ├── Save button → C5 word store
│       ├── Mine button → C6 flashcard creation
│       └── Audio pronunciation (TTS or dict audio)
│
├── C5: VOCABULARY STORE
│   │   ← Word DB offline-first, foundation cho comprehension + social
│   │
│   ├── Word Entry Schema
│   │   ├── id: uuid
│   │   ├── word: string
│   │   ├── reading: string (furigana/pinyin/IPA)
│   │   ├── language: ISO 639-1
│   │   ├── definition: string
│   │   ├── context: { sentence, sourceTitle, sourceUrl, timestamp }
│   │   ├── status: 'unknown' | 'learning' | 'known' | 'ignored'
│   │   ├── createdAt, lastReviewedAt
│   │   └── miningCount: number
│   │
│   ├── Wordbook Management
│   │   ├── Default wordbook per language
│   │   ├── Custom wordbook (per topic: "anime", "business", "IELTS")
│   │   ├── Move/copy word between wordbooks
│   │   └── Search + filter (by status, by date, by frequency)
│   │
│   ├── Storage
│   │   ├── IndexedDB (Dexie.js or idb library)
│   │   ├── Schema: words, wordbooks, settings
│   │   ├── Export: JSON (backup) + .apkg (Anki — C7)
│   │   └── Import: JSON (restore) + Anki deck (phase sau)
│   │
│   └── Word Status Logic
│       ├── New word from lookup → status='unknown'
│       ├── User mark → 'learning' | 'known' | 'ignored'
│       ├── Auto-promote: after N reviews correct → 'known'
│       └── Auto-demote: after N reviews wrong → 'learning'
│
├── C6: FLASHCARD CREATION (1-click mine)
│   │   ← Sentence mining: sentence + audio + screenshot + definition
│   │
│   ├── Capture Pipeline
│   │   ├── Sentence: current subtitle cue text
│   │   ├── Audio snippet: tabCapture + MediaRecorder (start/end by cue timing)
│   │   ├── Screenshot: chrome.tabs.captureVisibleTab (current frame)
│   │   ├── Definition: from C4 lookup result
│   │   └── Source metadata: video title, URL, timestamp
│   │
│   ├── Card Preview + Edit
│   │   ├── Front: sentence (cloze-deleted target word) + audio + screenshot
│   │   ├── Back: word + reading + definition + full sentence
│   │   ├── Edit fields before save
│   │   └── Save → C5 word store + queue for Anki export
│   │
│   ├── Audio Recording
│   │   ├── Streaming: chrome.tabCapture API (MV3 — cần permission)
│   │   ├── Local video: extract audio from file (Web Audio API)
│   │   ├── Format: WebM/Opus → MP3 (lamejs) hoặc giữ WebM
│   │   └── Duration: cue start → cue end + 0.5s padding
│   │
│   └── Screenshot
│       ├── chrome.tabs.captureVisibleTab (full viewport)
│       ├── Crop to video area (optional)
│       └── Compress: JPEG 80% quality
│
├── C7: SRS via Anki Export
│   │   ← Tận dụng Anki ecosystem, không reinvent SRS
│   │
│   ├── .apkg Generator
│   │   ├── Anki package format: SQLite DB + media files (ZIP)
│   │   ├── Note type: "Cell Mining" (Front/Sentence/Audio/Image/Back/Word/Reading)
│   │   ├── Deck: "Cell::[Language]::[WordbookName]"
│   │   ├── Library: genanki (JS port) hoặc tự build SQLite
│   │   └── Export: download .apkg file → user import Anki desktop
│   │
│   ├── AnkiConnect Integration (optional, power user)
│   │   ├── POST localhost:8765 (addNote, createDeck, findNotes)
│   │   ├── Auto-send card on mine (no manual import)
│   │   ├── Sync trigger (optional)
│   │   └── Fallback: nếu AnkiConnect không chạy → download .apkg
│   │
│   └── Export UI
│       ├── "Export to Anki" button (per wordbook or selected words)
│       ├── Progress bar (generating .apkg)
│       ├── "Open Anki" hint (instruction to import)
│       └── Export history (last export date, count)
│
└── C8: STREAMING PLATFORM SUPPORT
    │   ← Mở rộng từ downloader sang in-page learning
    │
    ├── YouTube
    │   ├── Subtitle: ytInitialPlayerResponse.captions
    │   ├── Auto-translate: YouTube auto-translated track
    │   ├── BYO subtitle: drag-drop .srt/.vtt
    │   └── Video element: document.querySelector('video')
    │
    ├── Netflix
    │   ├── Subtitle: Netflix player API (nflxvideo)
    │   ├── Dual sub: target + user-selected translation
    │   └── Video element: Netflix player container
    │
    ├── Educational (Coursera/Udemy/TED/edX/Khan)
    │   ├── Subtitle: <track kind="subtitles"> hoặc platform API
    │   ├── Coursera: course API subtitle
    │   ├── Udemy: asset API subtitle
    │   └── TED/Khan: native VTT
    │
    └── Generic
        ├── Any <video> + <track>
        ├── BYO subtitle drag-drop
        └── Local video file (file:// or drag-drop)
```

---

## C. Logic Chart — Data Flow MVP (user journey chi tiết)

> 5 journey chính: **Onboarding → Watch+Lookup → Mine → Manage → Export**.
> Mỗi journey có nhánh quyết định (◇), state (□), edge case (⚠), error (✗).

### C.0 — FIRST-TIME ONBOARDING (chỉ xảy ra 1 lần)

```
USER INSTALLS CELL EXTENSION
│
├── 1. Extension installed → chrome.runtime.onInstalled
│   ├── □ state: onboardingNeeded = true
│   └── Open onboarding tab automatically (or badge "!")
│
├── 2. Onboarding wizard (4 steps — tối giản theo sứ mệnh Anh yêu)
│   │
│   ├── Step 1: Chọn ngôn ngữ học (target language)
│   │   ├── ◇ User chọn 1 trong: EN / JP / CN / KO / FR / DE / ES / VI / ...
│   │   ├── □ state: settings.targetLanguage = 'ja'
│   │   └── → Step 2
│   │
│   ├── Step 2: Chọn ngôn ngữ mẹ (native language — cho translation)
│   │   ├── ◇ User chọn: VI / EN / ...
│   │   ├── □ state: settings.nativeLanguage = 'vi'
│   │   └── → Step 3
│   │
│   ├── Step 3: Dict setup (hybrid Yomitan + AI)
│   │   ├── ◇ Có Yomitan dict sẵn cho ngôn ngữ này?
│   │   │   ├── YES (JP/CN/KO/EN) → recommend download dict
│   │   │   │   ├── User click "Download JMdict" → fetch + store IndexedDB
│   │   │   │   ├── ⚠ Dict lớn (50-200MB) → progress bar + "continue without"
│   │   │   │   └── □ state: dict.loaded = true
│   │   │   └── NO (ngôn ngữ hiếm) → recommend AI Explain
│   │   │       ├── User nhập OpenAI key (optional, encrypted storage)
│   │   │       ├── ⚠ No key → lookup sẽ fallback "definition not available"
│   │   │       └── □ state: aiKey.set = true/false
│   │   └── → Step 4
│   │
│   └── Step 4: Anki setup (optional)
│       ├── ◇ User dùng Anki?
│       │   ├── YES → "Do you have AnkiConnect running?"
│       │   │   ├── YES → test localhost:8765 → □ state: anki.connect = true
│       │   │   │   └── ⚠ AnkiConnect không phản hồi → fallback .apkg mode
│       │   │   └── NO → □ state: anki.mode = 'apkg' (manual import)
│       │   └── NO → □ state: anki.enabled = false (skip, phase sau có Cell SRS)
│       └── → Done
│
└── 3. Onboarding complete
    ├── □ state: onboardingNeeded = false
    ├── Show "You're ready! Open any video on YouTube/Netflix to start"
    └── → Journey C.1 (Watch + Lookup)
```

---

### C.1 — WATCH + LOOKUP (journey chính, lặp lại mỗi phiên học)

```
USER OPENS VIDEO ON YOUTUBE / NETFLIX / COURSERA / GENERIC PAGE
│
├── 1. Content script inject (chrome.tabs.onUpdated complete)
│   │
│   ├── 1a. Detect site adapter
│   │   ├── ◇ URL match YouTube? → youtube.ts adapter
│   │   ├── ◇ URL match Netflix? → netflix.ts adapter
│   │   ├── ◇ URL match Coursera/Udemy/TED? → educational.ts adapter
│   │   └── else → generic.ts adapter
│   │
│   ├── 1b. Detect <video> element
│   │   ├── □ video element found → continue
│   │   ├── ⚠ No <video> yet (SPA lazy load) → MutationObserver wait (timeout 30s)
│   │   └── ✗ Timeout no video → overlay not injected (silent, no error)
│   │
│   ├── 1c. Detect subtitle source
│   │   ├── ◇ YouTube → fetch ytInitialPlayerResponse.captions
│   │   │   ├── Has caption track? → fetch subtitle (VTT/TTML)
│   │   │   └── No caption → show "No subtitle" + "BYO subtitle" drag-drop zone
│   │   ├── ◇ Netflix → hook Netflix player API
│   │   │   ├── Has subtitle track? → fetch timed text
│   │   │   └── No subtitle → "BYO subtitle" drag-drop
│   │   ├── ◇ Educational → check <track kind="subtitles">
│   │   │   ├── Has track? → fetch track.src (VTT)
│   │   │   └── No track → "BYO subtitle" drag-drop
│   │   └── ◇ Generic → check <track> or drag-drop
│   │
│   ├── 1d. Parse subtitle (REUSE existing parsers)
│   │   ├── ASS → assParser.ts → cue list
│   │   ├── VTT → vttParser.ts → cue list
│   │   ├── SRT → srtParser.ts → cue list
│   │   └── ⚠ Parse error → fallback raw text, no timing
│   │
│   ├── 1e. Detect subtitle language (REUSE languageDetector)
│   │   ├── ISO code from URL (BCP 47) → primary subtag
│   │   ├── Fallback: script + frequency detection on cue text
│   │   └── □ state: subtitleLanguage = 'ja'
│   │
│   ├── 1f. Get native translation (for dual sub)
│   │   ├── ◇ User has native .srt? → load + sync by timestamp
│   │   ├── ◇ No native .srt → Google Translate API (batch, cached)
│   │   │   ├── ⚠ Rate limit → translate only current cue on-demand
│   │   │   └── ⚠ API key needed → if no key, hide translation layer
│   │   └── ◇ User setting "translation: off" → skip
│   │
│   └── 1g. Render overlay
│       ├── Create overlay container (z-index above native sub)
│       ├── Hide native subtitle (if overlay replaces it)
│       ├── Render cue list synced to video.currentTime
│       ├── Dual layer: target (top) + native translation (bottom)
│       ├── Tokenize each word in cue (per-language tokenizer)
│       ├── Color-code by word status (query IndexedDB):
│       │   ├── Unknown → red underline
│       │   ├── Learning → orange
│       │   ├── Known → no highlight (dim if toggle)
│       │   └── Ignored → strikethrough
│       └── □ state: overlay.active = true
│
├── 2. User watches video (overlay active)
│   │
│   ├── 2a. Subtitle sync loop (requestAnimationFrame or timeupdate event)
│   │   ├── video.currentTime → find current cue (binary search)
│   │   ├── Render current cue (+ prev/next preview if setting)
│   │   └── ⚠ Cue gap > 5s → hide overlay (no subtitle shown)
│   │
│   ├── 2b. Auto-pause on unknown (if settings.autoPauseOnUnknown = true)
│   │   ├── Cue change → check if cue has unknown words
│   │   ├── ◇ Has unknown word?
│   │   │   ├── YES → video.pause() + highlight unknown word + pulse animation
│   │   │   │   └── User clicks word → Journey C.1 step 3
│   │   │   └── NO → continue playing
│   │   └── ⚠ User disabled auto-pause mid-session → respect immediately
│   │
│   └── 2c. Keyboard shortcuts (global, when overlay active)
│       ├── ← / → → seek ±5s (or ±1 cue)
│       ├── Space → play/pause
│       ├── R → repeat current cue (loop)
│       ├── S → slow playback (toggle 1x/0.75x/0.5x)
│       ├── A → toggle auto-pause
│       ├── D → toggle dual sub (target/translation/both)
│       └── Esc → close lookup popup (if open)
│
├── 3. User clicks/taps unknown word in subtitle
│   │
│   ├── 3a. Word selection + tokenize
│   │   ├── Get selection range (click position → word boundary)
│   │   ├── Tokenize per language:
│   │   │   ├── JP → MeCab/Wasm (longest match + deinflection)
│   │   │   ├── CN → jieba-wasm (segmentation)
│   │   │   ├── EN → whitespace + punctuation split
│   │   │   └── Other → whitespace + ICU boundary
│   │   ├── ◇ User selected phrase (multiple words)?
│   │   │   ├── YES → phrase lookup (skip tokenize, lookup whole phrase)
│   │   │   └── NO → single word lookup
│   │   └── □ state: currentLookup = { word, reading, context, timestamp }
│   │
│   ├── 3b. Dictionary lookup (hybrid)
│   │   ├── ◇ Step 1: Yomitan dict (IndexedDB)
│   │   │   ├── Query: word + deinflection variants
│   │   │   ├── Found → return { reading, definition, pos, frequency, examples }
│   │   │   │   └── → step 3d (popup)
│   │   │   └── Not found → step 3c
│   │   │
│   ├── 3c. AI Explain fallback (if Yomitan miss)
│   │   ├── ◇ AI key set?
│   │   │   ├── NO → popup: "No dict entry. Add OpenAI key in Settings for AI explain."
│   │   │   │   └── Show: word + context sentence + "Save anyway" button
│   │   │   └── YES → call ChatGPT API
│   │   │       ├── Prompt: "Explain [word] in [language] in context: [sentence]. Return JSON: {reading, definition, pos, example}"
│   │   │       ├── ⚠ API error / rate limit → popup: "AI unavailable. Save anyway?"
│   │   │       ├── ⚠ Slow (>3s) → loading spinner + "Save anyway" option
│   │   │       ├── Success → cache result (IndexedDB: aiCache[word+context])
│   │   │       └── → step 3d (popup with AI result)
│   │   │
│   ├── 3d. Lookup popup render
│   │   ├── Position: near clicked word (smart positioning — flip if near edge)
│   │   ├── Content:
│   │   │   ├── Word + reading (furigana/pinyin/IPA)
│   │   │   ├── Definition (Yomitan or AI)
│   │   │   ├── Part of speech
│   │   │   ├── Frequency badge (star 1-5 or rank number)
│   │   │   ├── Example sentences (from dict)
│   │   │   ├── Audio pronunciation (TTS or dict audio — click to play)
│   │   │   └── Context sentence (from current video subtitle)
│   │   ├── Buttons:
│   │   │   ├── [Save] → quick save word (step 4a)
│   │   │   ├── [Mine] → full flashcard creation (step 4b)
│   │   │   ├── [Mark Known] → word status = 'known' (no card)
│   │   │   ├── [Ignore] → word status = 'ignored' (hide forever)
│   │   │   └── [Close] / Esc
│   │   └── □ state: popup.active = true
│   │
│   └── 3e. Word status check (for popup button state)
│       ├── Query IndexedDB: word + language
│       ├── ◇ Word exists in DB?
│       │   ├── YES → show current status, buttons adapt:
│       │   │   ├── 'unknown' → [Save] [Mine] prominent
│       │   │   ├── 'learning' → [Mine again] [Mark Known]
│       │   │   ├── 'known' → [Re-mine] [Move to Learning]
│       │   │   └── 'ignored' → [Un-ignore]
│       │   └── NO → new word, all buttons available
│       └── Update popup button states
│
├── 4a. QUICK SAVE (user clicks [Save])
│   │
│   ├── 4a.1. Create word entry
│   │   ├── id: uuid()
│   │   ├── word, reading, language, definition (from popup)
│   │   ├── context: { sentence (current cue), sourceTitle (tab title), sourceUrl, timestamp (video.currentTime) }
│   │   ├── status: 'learning'
│   │   ├── wordbookId: default wordbook for language
│   │   ├── createdAt: now, lastReviewedAt: null
│   │   └── miningCount: 0
│   │
│   ├── 4a.2. Write IndexedDB
│   │   ├── Insert word entry
│   │   ├── ⚠ Duplicate (same word + language)?
│   │   │   ├── YES → update: increment miningCount, update context if different
│   │   │   └── NO → insert new
│   │   └── Update overlay color (word → orange 'learning')
│   │
│   ├── 4a.3. Feedback
│   │   ├── Popup: "✓ Saved to [wordbook]" + toast
│   │   ├── Subtitle: word color changes red→orange
│   │   └── Popup closes (or stays if user clicks [Mine] next)
│   │
│   └── → User continues watching (step 2)
│
├── 4b. MINE FULL FLASHCARD (user clicks [Mine])
│   │
│   ├── 4b.1. Capture pipeline (parallel)
│   │   │
│   │   ├── Capture A: Sentence
│   │   │   ├── Current cue text (from overlay state)
│   │   │   ├── Cloze: replace target word with [...] in sentence
│   │   │   └── □ cardData.sentence = { full, cloze, word }
│   │   │
│   │   ├── Capture B: Audio snippet
│   │   │   ├── ◇ Streaming site (YouTube/Netflix)?
│   │   │   │   ├── YES → chrome.tabCapture API
│   │   │   │   │   ├── Start MediaRecorder BEFORE cue start
│   │   │   │   │   ├── Stop AFTER cue end + 0.5s padding
│   │   │   │   │   ├── ⚠ tabCapture requires user gesture + permission
│   │   │   │   │   ├── ⚠ Background tab → capture fails → skip audio
│   │   │   │   │   └── Format: WebM/Opus → (optional) MP3 via lamejs
│   │   │   │   └── Local video file?
│   │   │   │       ├── YES → Web Audio API extract (video.currentTime seek)
│   │   │   │       │   ├── Seek to cue start → record → seek to cue end
│   │   │   │       │   └── ⚠ Slow (real-time seek) → show progress
│   │   │   │       └── NO audio source → skip audio, card has no audio
│   │   │   └── □ cardData.audio = { blob, duration, format }
│   │   │
│   │   ├── Capture C: Screenshot
│   │   │   ├── chrome.tabs.captureVisibleTab (current frame)
│   │   │   ├── ⚠ Popup open covers video? → close popup first, capture, reopen
│   │   │   ├── Crop to video area (optional, detect video rect)
│   │   │   ├── Compress: JPEG 80% quality
│   │   │   └── □ cardData.screenshot = { dataUrl, width, height }
│   │   │
│   │   └── Capture D: Definition + metadata
│   │       ├── From popup state (Yomitan or AI result)
│   │       ├── Source: { title, url, timestamp, cueIndex }
│   │       └── □ cardData.definition, cardData.source
│   │
│   ├── 4b.2. Card preview popup
│   │   ├── Render preview:
│   │   │   ├── Front: cloze sentence + audio player + screenshot
│   │   │   ├── Back: word + reading + definition + full sentence
│   │   │   └── Tags: [language] [source]
│   │   ├── Editable fields:
│   │   │   ├── Sentence (edit text)
│   │   │   ├── Definition (edit / add note)
│   │   │   ├── Tags (add/remove)
│   │   │   └── Audio (re-record / remove)
│   │   ├── Buttons: [Save Card] [Cancel] [Save + Continue]
│   │   └── □ state: preview.active = true
│   │
│   ├── 4b.3. Save card
│   │   ├── Create word entry (like 4a.1) + cardData
│   │   ├── Write IndexedDB:
│   │   │   ├── words table: word entry (status='learning')
│   │   │   ├── cards table: cardData (wordId, sentence, audio, screenshot, definition, source)
│   │   │   └── miningQueue: mark card as 'pending_export'
│   │   ├── Update overlay color (word → orange)
│   │   ├── Feedback: "✓ Card saved to mining queue" + toast
│   │   └── ◇ AnkiConnect mode?
│   │       ├── YES + AnkiConnect running → auto-send (step 6b)
│   │       └── NO → stay in queue, export later (step 6a)
│   │
│   └── → User continues watching (step 2) OR closes preview
│
└── 5. Session end (user closes tab / navigates away)
    ├── □ state: overlay destroyed, popup closed
    ├── Auto-save: all word entries already in IndexedDB (no data loss)
    ├── ⚠ Unsaved card preview? → confirm dialog "Discard card?"
    └── Session stats logged (words looked up, words saved, cards mined) — for future social
```

---

### C.2 — MANAGE WORDBOOK (journey quản lý, trong Cell popup)

```
USER OPENS CELL POPUP (clicks extension icon)
│
├── 1. Popup renders (React + Zustand)
│   │
│   ├── Tab bar (4 tabs):
│   │   ├── [Download] ← existing (detected media, downloads)
│   │   ├── [Wordbook] ← NEW
│   │   ├── [Mining Queue] ← NEW
│   │   └── [Settings] ← existing + extended
│   │
│   └── Default tab: Wordbook (or last opened)
│
├── 2. Wordbook tab
│   │
│   ├── 2a. Load wordbooks
│   │   ├── Query IndexedDB: wordbooks WHERE language = settings.targetLanguage
│   │   ├── Default wordbook: "[Language] Default" (auto-created on first save)
│   │   ├── Custom wordbooks: user-created (e.g. "Anime vocab", "IELTS", "Business")
│   │   ├── □ state: wordbookList = [...]
│   │   └── ⚠ No wordbook yet → empty state "Start by looking up a word in any video"
│   │
│   ├── 2b. Wordbook selected → word list
│   │   ├── Query IndexedDB: words WHERE wordbookId = selected
│   │   ├── Sort: by createdAt desc (default) | by status | by frequency | alphabetical
│   │   ├── Filter: by status (Unknown/Learning/Known/Ignored) | by date range | by source
│   │   ├── Search: by word / reading / definition
│   │   ├── Render: WordCard component (word, reading, status badge, frequency, source, timestamp)
│   │   └── Pagination / virtual scroll (if > 100 words)
│   │
│   ├── 2c. Word card actions
│   │   ├── Click word → expand: full definition + context sentence + source link
│   │   ├── [Edit] → edit definition / context / tags
│   │   ├── [Change Status] → dropdown: Unknown / Learning / Known / Ignored
│   │   ├── [Move to Wordbook] → select target wordbook
│   │   ├── [Delete] → confirm → remove from IndexedDB
│   │   └── [Re-mine] → open card creator (if no card) or re-capture
│   │
│   ├── 2d. Wordbook actions
│   │   ├── [New Wordbook] → name + language + description
│   │   ├── [Rename] / [Delete] (delete wordbook → words move to default or delete)
│   │   ├── [Export] → Journey C.3 (Export to Anki)
│   │   └── [Import] → import .json backup or Anki deck (phase sau)
│   │
│   └── 2e. Stats summary (top of wordbook)
│       ├── Total words: N
│       ├── By status: Unknown X | Learning Y | Known Z | Ignored W
│       ├── Mined cards: M (cards with audio+screenshot)
│       └── Last activity: date
│
├── 3. Mining Queue tab
│   │
│   ├── 3a. Load pending cards
│   │   ├── Query IndexedDB: cards WHERE exportStatus = 'pending'
│   │   ├── Render: CardPreview list (sentence, word, audio player, screenshot thumb)
│   │   └── ⚠ Empty → "No pending cards. Mine words from videos to create cards."
│   │
│   ├── 3b. Card actions
│   │   ├── [Preview] → full card view (front/back)
│   │   ├── [Edit] → edit sentence/definition/tags
│   │   ├── [Remove] → remove from queue (keep word in wordbook)
│   │   └── [Export Selected] → Journey C.3
│   │
│   └── 3c. Batch actions
│       ├── [Select All] / [Select None]
│       ├── [Export All to Anki] → Journey C.3
│       └── [Delete Selected]
│
└── 4. Settings tab (extended)
    ├── Existing settings (download, conversion, subtitle language, theme...)
    ├── NEW: Overlay settings
    │   ├── Dual sub display mode (both/target/translation/hover)
    │   ├── Auto-pause on unknown (toggle)
    │   ├── Font size / color / position
    │   ├── Keyboard shortcuts (customize)
    │   └── Translation provider (Google / DeepL / off)
    ├── NEW: Dict management
    │   ├── Installed dicts list (per language)
    │   ├── [Import Dict] → upload Yomitan .zip
    │   ├── [Download Dict] → curated list (JMdict, CC-CEDICT...)
    │   ├── [Delete Dict]
    │   └── AI Explain: OpenAI key input (encrypted)
    └── NEW: Anki settings
        ├── Mode: .apkg (manual) / AnkiConnect (auto) / off
        ├── AnkiConnect test (localhost:8765)
        ├── Note type mapping (custom field names)
        ├── Deck name template ("Cell::[Lang]::[Wordbook]")
        └── Export history
```

---

### C.3 — EXPORT TO ANKI (journey xuất card)

```
USER TRIGGERS EXPORT (from Wordbook or Mining Queue)
│
├── 1. Export trigger
│   ├── Source: Wordbook [Export] button → export all words with cards in wordbook
│   ├── Source: Mining Queue [Export All] → export all pending cards
│   ├── Source: Mining Queue [Export Selected] → export selected cards only
│   └── □ state: exportConfig = { cardIds: [...], deckName, noteType }
│
├── 2. Export mode decision
│   ├── ◇ settings.anki.mode?
│   │   ├── 'ankiConnect' → Journey 6b (auto-send)
│   │   ├── 'apkg' → Journey 6a (file download)
│   │   └── 'off' → prompt "Enable Anki in Settings first"
│   │
│   └── ◇ AnkiConnect mode BUT not running?
│       ├── Test localhost:8765 → fail → fallback to .apkg + notify user
│       └── → Journey 6a
│
├── 6a. .apkg FILE GENERATION (manual import)
│   │
│   ├── 6a.1. Collect card data
│   │   ├── Query IndexedDB: cards + words WHERE id IN exportConfig.cardIds
│   │   ├── For each card:
│   │   │   ├── sentence (cloze + full)
│   │   │   ├── audio blob → convert to MP3 (lamejs) or keep WebM
│   │   │   ├── screenshot dataUrl → image file
│   │   │   ├── word + reading + definition
│   │   │   └── tags
│   │   └── □ exportData = [card1, card2, ...]
│   │
│   ├── 6a.2. Build Anki package
│   │   ├── Create SQLite DB (anki schema: notes, cards, decks, notetypes)
│   │   ├── Note type: "Cell Mining"
│   │   │   ├── Fields: Front, Back, Sentence, Word, Reading, Audio, Image, Definition, Tags
│   │   │   └── Templates: Front={{Sentence}}<br>{{Audio}}<br>{{Image}} / Back={{Word}} {{Reading}}<br>{{Definition}}<br>{{Sentence}}
│   │   ├── Deck: exportConfig.deckName (e.g. "Cell::Japanese::Anime vocab")
│   │   ├── Insert notes + cards (1 card per note, or 2 if cloze)
│   │   ├── Media files: audio_[uuid].mp3, image_[uuid].jpg
│   │   ├── Package: SQLite DB + media/ → ZIP → .apkg
│   │   ├── ⚠ Large export (>500 cards)? → chunk + progress bar
│   │   └── ⚠ Memory limit? → stream to OPFS, not RAM
│   │
│   ├── 6a.3. Download .apkg
│   │   ├── chrome.downloads.download({ url: blobUrl, filename: "cell_export_[date].apkg" })
│   │   ├── Update IndexedDB: cards.exportStatus = 'exported', exportedAt = now
│   │   └── Show instruction: "Open Anki Desktop → File → Import → select .apkg"
│   │
│   └── 6a.4. Export complete
│       ├── Toast: "✓ Exported N cards to .apkg"
│       ├── Export history updated (date, count, deck)
│       └── Mining Queue: exported cards marked (greyed out or moved to "Exported" filter)
│
└── 6b. ANKICONNECT AUTO-SEND (power user)
    │
    ├── 6b.1. Test connection
    │   ├── POST localhost:8765 { action: 'version' }
    │   ├── ⚠ Fail → fallback to 6a + notify "AnkiConnect not running, downloaded .apkg instead"
    │   └── Success → continue
    │
    ├── 6b.2. Ensure deck exists
    │   ├── POST { action: 'createDeck', deckName }
    │   └── (idempotent — no error if exists)
    │
    ├── 6b.3. Send notes (batch)
    │   ├── For each card → POST { action: 'addNote', note: { deckName, modelName, fields, tags, audio, picture } }
    │   ├── ⚠ Duplicate detection: { action: 'findNotes', query: 'deck:"X" word:"Y"' } → skip if exists
    │   ├── ⚠ Rate limit: batch 10 notes/request, 100ms delay between batches
    │   ├── Progress bar: "Sending N/M cards..."
    │   └── Update IndexedDB: each card.exportStatus = 'exported'
    │
    ├── 6b.4. Confirmation
    │   ├── Toast: "✓ Sent N cards to Anki deck [deckName]"
    │   ├── Optional: { action: 'sync' } → trigger Anki Sync
    │   └── Export history updated
    │
    └── 6b.5. Error handling
        ├── ⚠ Anki closed mid-export → partial send, resume on next attempt
        ├── ⚠ Network error → retry 3x, then fallback .apkg
        └── ⚠ Note type missing in Anki → create model first (modelNames) or use Basic
```

---

### C.4 — EDGE CASES & ERROR STATES (cross-journey)

```
EDGE CASES (xử lý ở mọi journey)
│
├── E1: No subtitle available
│   ├── Trigger: video has no caption track, no <track>, no BYO
│   ├── UI: overlay shows "No subtitle detected" + drag-drop zone
│   ├── ◇ User drag-drops .srt/.vtt → parse + render overlay
│   └── ◇ User ignores → overlay hidden, Cell acts as downloader only
│
├── E2: Subtitle language mismatch
│   ├── Trigger: detected language ≠ settings.targetLanguage
│   ├── ◇ User watching JP video but target = EN?
│   │   ├── Prompt: "Subtitle is Japanese. Switch target language? [Yes] [No] [Always ask]"
│   │   ├── YES → settings.targetLanguage = 'ja' (temporary or permanent)
│   │   └── NO → use EN dict on JP text (likely no results → AI fallback)
│   └── □ state: sessionLanguage override
│
├── E3: Dict not loaded
│   ├── Trigger: user clicks word but no Yomitan dict for language
│   ├── ◇ AI key set? → AI Explain only (slower, online)
│   ├── ◇ No AI key → popup: "No dictionary for [language]. Add dict in Settings or add OpenAI key."
│   └── [Save anyway] still available (word saved without definition)
│
├── E4: Audio capture permission denied
│   ├── Trigger: chrome.tabCapture requires user gesture + permission
│   ├── ◇ First mine → request permission prompt
│   │   ├── Grant → capture proceeds
│   │   └── Deny → card saved WITHOUT audio, toast "Audio skipped (no permission)"
│   └── Subsequent mines → permission remembered
│
├── E5: IndexedDB quota exceeded
│   ├── Trigger: word DB + dict + audio + screenshot > quota (~50% of disk)
│   ├── ⚠ Detect: catch QuotaExceededError on write
│   ├── UI: "Storage full. Export to Anki and clear old cards?"
│   ├── [Export] → Journey C.3
│   ├── [Clear exported cards] → delete cards WHERE exportStatus = 'exported'
│   └── [Clear ignored words] → delete words WHERE status = 'ignored'
│
├── E6: Video navigated away mid-mine
│   ├── Trigger: user clicks [Mine] but video URL changes (SPA navigation)
│   ├── ⚠ Capture fails (video element gone)
│   ├── Fallback: save word + sentence (text only), no audio/screenshot
│   └── Toast: "Saved without audio (video changed)"
│
├── E7: AnkiConnect CORS / version mismatch
│   ├── Trigger: AnkiConnect running but CORS blocks / old version
│   ├── ⚠ Test: POST fails with CORS error
│   ├── Fallback: .apkg mode + notify "AnkiConnect blocked. Using .apkg download."
│   └── Help link: "How to fix AnkiConnect CORS"
│
├── E8: Multiple videos on same page
│   ├── Trigger: page has 2+ <video> elements (e.g. course preview + main video)
│   ├── ◇ Detect largest <video> or first playing → attach overlay
│   ├── UI: "Multiple videos detected. Using [title]. [Switch]"
│   └── [Switch] → re-attach overlay to selected video
│
└── E9: Popup closed during background work
    ├── Trigger: user closes popup while .apkg generating or AnkiConnect sending
    ├── □ Background service worker continues (MV3 keeps alive during active task)
    ├── Progress saved to chrome.storage.session
    └── Reopen popup → resume display from storage state
```

---

### C.5 — STATE DIAGRAM (word lifecycle)

```
WORD LIFECYCLE (trong Cell system)

    ┌─────────┐
    │ (not in │ ← word chưa được lookup
    │   DB)   │
    └────┬────┘
         │ user clicks word + lookup
         ▼
    ┌──────────┐
    │ UNKNOWN  │ ← vừa lookup, chưa save
    │ (red)    │
    └────┬─────┘
         │ user clicks [Save] or [Mine]
         ▼
    ┌──────────┐
    │ LEARNING │ ← trong wordbook, pending Anki export
    │ (orange) │
    └────┬─────┘
         │
         ├── user clicks [Mark Known] ──→ ┌────────┐
         │                                  │ KNOWN  │ (green/dim)
         │                                  └───┬────┘
         │                                      │ user clicks [Re-mine]
         │                                      ▼
         │                                  back to LEARNING
         │
         ├── user clicks [Ignore] ────────→ ┌──────────┐
         │                                    │ IGNORED  │ (strikethrough)
         │                                    └─────┬────┘
         │                                          │ user clicks [Un-ignore]
         │                                          ▼
         │                                      back to LEARNING
         │
         ├── exported to Anki ──→ (still LEARNING in Cell, Anki handles SRS)
         │
         └── user deletes word ──→ removed from DB
```

---

### C.6 — SEQUENCE: Lookup → Save → Mine → Export (happy path tóm tắt)

```
User    ContentScript    LookupEngine    IndexedDB    CardBuilder    AnkiExporter
 │           │                │              │             │              │
 │──click──▶│                │              │             │              │
 │           │──tokenize──▶  │              │             │              │
 │           │──query dict──▶│              │             │              │
 │           │◀──result──────│              │             │              │
 │           │──query word──▶│              │             │              │
 │           │◀──status: new─│              │             │              │
 │◀─popup───│                │              │             │              │
 │──[Save]─▶│                │              │             │              │
 │           │──insert word──────────────▶│             │              │
 │           │◀──ok───────────────────────│             │              │
 │◀─toast───│                │              │             │              │
 │           │                │              │             │              │
 │──[Mine]─▶│                │              │             │              │
 │           │──capture audio+screenshot──▶│             │              │
 │           │──build card────────────────────────────▶│              │
 │           │◀──cardData──────────────────────────────│              │
 │◀─preview─│                │              │             │              │
 │──[OK]───▶│                │              │             │              │
 │           │──insert card──────────────▶│             │              │
 │           │◀──ok───────────────────────│             │              │
 │◀─toast───│                │              │             │              │
 │           │                │              │             │              │
 │──open popup─────────────────────────────────────────────────────────▶│
 │──[Export]───────────────────────────────────────────────────────────▶│
 │           │                │              │             │──build .apkg│
 │           │                │              │             │──download───▶│
 │◀─toast───│                │              │             │              │
```

---

### C.7 — JOURNEY METRICS (đo lường cho future social + optimization)

```
METRICS CELL TRACKS (anonymous, local — for future social + product insight)
│
├── Per-session
│   ├── Words looked up: count
│   ├── Words saved: count (by status)
│   ├── Cards mined: count (with/without audio, with/without screenshot)
│   ├── Videos watched: count + total duration
│   ├── Time in flow (no pause): minutes
│   └── Dict hit rate: Yomitan vs AI (for dict coverage insight)
│
├── Per-word
│   ├── Lookup count (how many times user looked up same word)
│   ├── Time to save (lookup → save duration)
│   ├── Mining count (re-mined same word?)
│   └── Status transitions (unknown→learning→known timeline)
│
├── Per-video
│   ├── Unknown word density: unknown/total words
│   ├── Comprehension estimate: known/total (future AI-1)
│   └── Mining rate: cards mined per minute
│
└── Per-export
    ├── Cards exported: count
    ├── Export method: .apkg vs AnkiConnect
    ├── Export duration
    └── Success/failure rate
```

---

## D. Logic Chart — Architecture Integration (Cell hiện tại + MVP mới)

```
EXISTING CELL (downloader)          NEW CELL (learning platform)
│                                   │
├── background/                      ├── background/
│   ├── networkInterceptor.ts       │   ├── (existing — unchanged)
│   ├── downloader.ts               │   ├── (existing — unchanged)
│   ├── downloadQueue.ts            │   ├── (existing — unchanged)
│   ├── autoDownload.ts             │   ├── (existing — unchanged)
│   └── ...                         │   ├── audioRecorder.ts (NEW — tabCapture)
│                                   │   └── ankiExporter.ts (NEW — .apkg gen)
│                                   │
├── content/                         ├── content/
│   ├── content-script.ts           │   ├── content-script.ts (extend)
│   └── pageScanner.ts              │   ├── pageScanner.ts (existing)
│                                   │   ├── overlay/
│                                   │   │   ├── overlayInjector.ts (NEW)
│                                   │   │   ├── subtitleRenderer.ts (NEW)
│                                   │   │   ├── playbackController.ts (NEW)
│                                   │   │   └── siteAdapters/
│                                   │   │       ├── youtube.ts (NEW)
│                                   │   │       ├── netflix.ts (NEW)
│                                   │   │       ├── educational.ts (NEW)
│                                   │   │       └── generic.ts (NEW)
│                                   │   └── lookup/
│                                   │       ├── lookupPopup.ts (NEW)
│                                   │       └── tokenizer.ts (NEW)
│                                   │
├── lib/                             ├── lib/
│   ├── detectors/ (existing)       │   ├── detectors/ (existing — unchanged)
│   ├── parsers/ (existing)         │   ├── parsers/ (existing — REUSE for overlay)
│   ├── converters/ (existing)      │   ├── converters/ (existing — unchanged)
│   ├── selectors/ (existing)       │   ├── dict/
│   │                               │   │   ├── yomitanLoader.ts (NEW)
│   │                               │   │   ├── yomitanFormat.ts (NEW — types)
│   │                               │   │   ├── lookupEngine.ts (NEW)
│   │                               │   │   └── aiExplain.ts (NEW — ChatGPT)
│   │                               │   ├── anki/
│   │                               │   │   ├── apkgGenerator.ts (NEW)
│   │                               │   │   ├── ankiConnect.ts (NEW)
│   │                               │   │   └── noteTypes.ts (NEW)
│   │                               │   ├── mining/
│   │                               │   │   ├── cardBuilder.ts (NEW)
│   │                               │   │   ├── audioCapture.ts (NEW)
│   │                                   │   └── screenshotCapture.ts (NEW)
│   │                               │   └── (existing utils)
│   │                               │
├── popup/                           ├── popup/
│   ├── (existing components)       │   ├── (existing — keep as "Download" tab)
│   │                               │   ├── wordbook/
│   │                               │   │   ├── WordbookView.tsx (NEW)
│   │                               │   │   ├── WordCard.tsx (NEW)
│   │                               │   │   └── WordbookFilter.tsx (NEW)
│   │                               │   ├── mining/
│   │                               │   │   ├── MiningQueue.tsx (NEW)
│   │                               │   │   └── CardPreview.tsx (NEW)
│   │                               │   ├── dict/
│   │                               │   │   ├── DictManager.tsx (NEW)
│   │                               │   │   └── DictImport.tsx (NEW)
│   │                               │   └── settings/
│   │                               │       └── (extend existing — overlay + dict settings)
│   │                               │
└── types/                           └── types/
    ├── media.ts (existing)             ├── media.ts (extend)
    │                                   ├── word.ts (NEW — WordEntry, Wordbook)
    │                                   ├── dict.ts (NEW — DictEntry, YomitanFormat)
    │                                   ├── mining.ts (NEW — CardData, MiningItem)
    │                                   └── anki.ts (NEW — AnkiNote, ApkgConfig)
```

---

## E. Phasing Roadmap

| Phase | Scope | Mục tiêu | Thời gian ước tính |
|---|---|---|---|
| **P0: MVP** | C1-C8 + Anki export + Dict hybrid | Cell trở thành learning tool, không chỉ downloader | Main focus |
| **P1: Social tym** | Tym tiến trình + notification | Lấp gap relatedness, tạo động lực quần thể | Sau MVP stable |
| **P2: Comprehension + AI** | Comprehension score + AI subtitle + AI explain | Mở rộng content pool, giảm frustration chọn sai level | Sau social |
| **P3: Annotation + Playback** | Furigana/pitch/pinyin/frequency + condensed/auto-pause | Polish cho power user, differentiator vs eJOY | Sau AI |
| **P4: Mobile + Cloud** | PWA review + cloud sync + mobile overlay | Review anywhere, cross-device | Cần backend |
| **P5: Course + Community** | Structured course + study group + leaderboard | Onboarding beginner + community engagement | Cần content investment |

---

## F. Differentiator Matrix (Cell vs 3 sản phẩm)

| Dimension | asbplayer | Migaku | eJOY | **Cell** |
|---|---|---|---|---|
| **Open core** | ✅ MIT | ❌ | ❌ | ✅ open-core |
| **Multi-language** | ✅ via Yomitan | ✅ 11 | ❌ EN only | ✅ via Yomitan + AI |
| **Anki export** | ✅ required | ✅ optional | ❌ | ✅ .apkg + AnkiConnect |
| **Social layer** | ❌ | ❌ Discord tách | ❌ | ✅ tym in-workflow |
| **Dict strategy** | External Yomitan | Built-in | Built-in + Oxford | **Hybrid Yomitan + AI** |
| **Comprehension** | Planned | Shipped | Per-word | P2 (sau social) |
| **Speaking** | ❌ | ❌ | ✅ AI Speaking | ❌ (shadowing only in SRS) |
| **Gamification** | ❌ | ❌ | ✅ 9+ games | ❌ (P5) |
| **Mobile** | Yếu | Native | Native | P4 (PWA first) |
| **Pricing** | Free | $9-14/mo | Subscription | Free open-core, AI bring-own-key |
