# Phase 7: theocean-extension-dictionary — Reading Summary

> Đọc toàn bộ core files của extension The0cean — một Chrome MV3 dictionary extension có OCEAN Engine cho phrasal verb matching, Anki integration, TTS, và multi-format dictionary import.

---

## Tech stack

- **Manifest V3**: Service worker (`background.js` type:module), content scripts inject trên `<all_urls>` với `all_frames: true`. Permissions: `tts`, `storage`, `activeTab`, `scripting`. Host permissions: Forvo, AnkiConnect (`http://127.0.0.1:8765/`).
- **Vanilla JS (ES modules)**: Không framework, không build step. Background + options dùng ES module imports. Content scripts dùng IIFE bundle (`oceanBundle.js`) vì content script không hỗ trợ ES modules trực tiếp.
- **IndexedDB**: Database `OceanDictionaryDB` version 2, 4 object stores. Lưu dictionary entries, frequency entries, phrasal patterns, và resource metadata.
- **AnkiConnect**: Tích hợp qua HTTP POST `http://127.0.0.1:8765` — addNote, updateNoteFields, findNotes, storeMediaFile, guiBrowse, cardsInfo. Audio/image upload as base64.
- **TTS**: Chrome `chrome.tts` API cho speak, `MediaRecorder` + `AudioContext` trong content script để record TTS thành WebM blob cho Anki. Fallback Google Translate TTS API nếu browser TTS fail.

---

## IndexedDB schema

- **Store `resources`**: keyPath=`id` (UUID). Indexes: `kind` (dictionary|frequency), `enabled`, `priority`. Mỗi dictionary/frequency list là một resource với title, sourceFormat, stats.
- **Store `dict_entries`**: keyPath=`id` (autoIncrement). Indexes: `termKey` (normalized term), `resourceTerm` (compound `[resourceId, termKey]`). Mỗi entry có: termKey, displayTerm, reading, pronunciation, pos, meaningAtoms[], raw.
- **Store `freq_entries`**: keyPath=`id` (autoIncrement). Indexes: `termKey`, `resourceTerm`. Entry có: resourceId, termKey, value, valueType (rank|freq).
- **Store `phrasal_patterns`** (OCEAN): keyPath=`id` (autoIncrement). Indexes: `anchorWord`, `anchorPriority` (compound `[anchorWord, priority]`), `resourceId`. Entry có: anchorWord, originalTerm, compiledRegex, priority, displayTerm, meaningAtoms, definition.
- **`ensurePhrasalStore()`** pattern: Mỗi hàm storage gọi `ensurePhrasalStore()` trước khi truy cập — mở DB với version hiện tại, trigger `onupgradeneeded` nếu store chưa tồn tại. Giải quyết vấn đề store bị xóa khi clear browser data nhưng DB version không đổi.

---

## Dictionary lookup

- **`lookupTermWithFreq(termRaw, options)`** trong `storage.js`: Normalize term → lấy enabled dictionary resources sorted by priority → query `dict_entries` qua index `resourceTerm` cho từng resource.
- **`first_match` mode**: Return entry đầu tiên tìm thấy (break loop). Response: `{ entry, resource, freqs }`. Nhanh hơn, chỉ 1 dictionary.
- **`stacked` mode**: Collect tất cả results từ nhiều dictionaries (max 10). Response: `{ results: [{resource, entries}], freqs }`. Hiển thị nhiều định nghĩa cùng lúc.
- **Frequency lookup**: Luôn collect từ tất cả enabled frequency resources, không phụ thuộc mode. Trả về `{ resource, entries }[]`.
- **`normalizeTermKey()`**: lowercase, trim, collapse spaces, strip trailing punctuation. Đảm bảo lookup nhất quán bất kể input form.

---

## Ocean engine

- **`oceanCompiler.js`**: Biến term như `"be (right) under your nose"` thành compiled regex. Xử lý placeholders: `sth/something` → `(?:[\w'\-]+(?:\s+[\w'\-]+){0,4})`, `sb/someone` → person pattern, `poss` → `(my|your|his|her|its|our|their|one's)`. Optional parts `(right)` → `(?:\s+right)?\s+`. `extractAnchorWord()` tìm từ khóa chính (bỏ sth/sb/poss). `calculatePriority()` đếm số từ cố định.
- **`oceanStorage.js`**: CRUD cho phrasal_patterns store. `getPhrasalPatternsByAnchor(anchorWord)` — query bằng index, sort by priority descending. `bulkInsertPhrasalPatterns()` — insert batch 500 entries.
- **`oceanMigration.js`**: Scan dictionary entries lúc import, gọi `isPhrasalPattern()` → `extractAnchorWord()` → `compilePhrasalPattern()` → insert vào phrasal_patterns. Batch 500, progress callback mỗi 1000 entries.
- **`oceanEngine.js`** (background): `lemmatizeWord()` — check irregularMap → getRegularRoot → fallback suffix removal. `matchPhrasalVerb()` — normalize sentence, test tất cả candidates, calculate score, return top 5.
- **`oceanMatcher.js`** (content script): `findPhrasalMatch()` — tương tự oceanEngine nhưng chạy trong content script context. Thêm `validateSemanticMatch()` — check sb/sth có subject/object xung quanh không, +20/-15 điểm.
- **Scoring algorithm**: `Score = (FixedWords × 10) + MatchLength`. FixedWords = số từ cố định (không phải placeholder). MatchLength = độ dài ký tự match. Sort by score desc, then priority desc. Return top 1 (oceanMatcher) hoặc top 5 (oceanEngine).
- **`oceanBundle.js`**: Bundle toàn bộ compiler + storage + matcher vào 1 file IIFE cho content script. Expose qua window object. Duplicate logic từ oceanCompiler/oceanStorage/oceanMatcher vì content script không dùng ES modules.
- **`oceanLoader.js`**: Dynamic import ES modules trong content script, expose `window.oceanMatcher/oceanCompiler/oceanStorage`. Promise `window.oceanReady`.

---

## Importers

- **`baseImporter.js`**: Abstract base class. `resourceId = crypto.randomUUID()`. Methods: `saveResourceMeta()`, `saveDictEntries()`, `saveFreqEntries()`. Subclass implements `import()`.
- **`migakuImporter.js`**: Parse JSON array. Detect dictionary (object elements) vs frequency (string elements). `importDictionary()` → normalize each row → save → trigger `migratePhrasalPatterns()` for OCEAN. `importFrequency()` → normalize as rank list.
- **`migakuZipImporter.js`**: Giống Migaku nhưng đọc nhiều JSON files từ ZIP, merge arrays. Dùng JSZip.
- **`yomitanImporter.js`**: Đọc ZIP có `index.json`. Detect `term_bank_*.json` (dictionary) hoặc `term_meta_bank_*.json` (frequency). Normalize Yomitan format `[term, reading, ?, ?, ?, definitions[]]`. Trigger `migrateYomitanFormat()` for OCEAN.
- **`importManager.js`**: Facade — detect file type (zip/json), chọn importer phù hợp. `importDictionary()` helper cho auto-import từ URL (background onInstalled).

---

## Content script popup

- **`popupDictionary.js`** (3722 lines): Core UI logic. Mousemove listener → debounce 150ms → `performLookup()`. Popup stack (nested popups cho tra từ trong popup). Feature toolbar: Forvo, Images, TTS, Sentence, Other. Resize, size persistence. Keyboard shortcuts integration.
- **`sentenceExtractor.js`**: `getOceanContext(range)` — bubble up DOM to semantic container (P/DIV/ARTICLE), segment text via `Intl.Segmenter` (fallback regex), calculate caret offset, extract target word, find sentence containing word (priority: target word proximity > offset > first).
- **`audioManager.js`**: `fetchAudioFromForvo(term)` — gửi message background fetch Forvo HTML, parse `#pronunciations-list-en_uk/en_usa`, extract audio URLs via `atob()`. `processAudioList()` — score by accent preference (US/UK), sort, slice top 3.
- **`shortcuts.js`**: 20 actions (defPrev/Next, addToAnki, audioNext/Prev, ttsPlay, etc). Storage key `oceanShortcuts` in local. `ShortcutUtils` exposed via window. Key capture, duplicate detection, format display.
- **`matchPhrasalVerbWithOcean()`**: Lemmatize via background → matchPhrasalVerb via background → build termOptions array (phrasal + single word fallback). `loadMediaInParallel()` — fetch Forvo audio + Google Images + translation cùng lúc với timeout 3s.

---

## Anki integration

- **`ankiSettings.js`**: `loadAnkiConfig()` / `saveAnkiConfig()` qua `chrome.storage.sync`. Config: deckName, modelName, tags, fieldMapping, allowDuplicate, showBrowserButton. `ankiInvoke(action, params)` — POST to `http://127.0.0.1:8765` với version 6.
- **`ankiManager.js`**: `buildFieldsFromMapping(extensionData, config)` — map extension fields (Target word, Definition, Sentence, etc) to Anki model fields via config.fieldMapping. `buildNoteObject()` — assemble note với deckName, modelName, fields, options, tags.
- **`background.js` handleAddToAnki()**: Build fields → process audio (Forvo URL download as base64 → storeMediaFile → `[sound:filename]`) → process TTS (record browser TTS via content script → base64 → upload) → process images → duplicate check (findNotes) → addNote. Same flow cho updateAnkiNote.
- **Auto field mapping**: `autoMapFields()` trong options.js — match extension fields to Anki model fields by name (case-insensitive, exact then partial). Rules: "Target word" → word/target/front/expression, "Definition" → definition/meaning/back/gloss, etc.
- **Duplicate detection**: `checkNoteExists` — query `note:"modelName" "targetField:word"`. Nếu allowDuplicate=false và tìm thấy → return `{ duplicate: true, noteIds }`. Popup hiển thị "Note already in Anki" + View link + Update button.

---

## TTS + Translate

- **`ttsModule.js`**: `TTSModule.getAvailableVoices()` — `chrome.tts.getVoices()`. `speak(text, voiceName)` — `chrome.tts.speak()` với rate/pitch 1.0, onEvent callbacks. `stop()` — `chrome.tts.stop()`. Minimal wrapper, dễ thay thế.
- **`TranslateModule.js`**: `translateText(text, targetLang='vi')` — fetch Google Translate free API `translate.googleapis.com/translate_a/single?client=gtx`. Parse nested array, join translation segments. Return null on error.
- **Browser TTS recording**: Content script tạo `AudioContext` + `MediaStreamDestination` + `MediaRecorder` → send `startTTSRecording` to background → background `chrome.tts.speak` → content script listens for `ttsEvent` (end/error) → stop recording → return base64 blob. Fallback Google TTS URL nếu fail.

---

## Data formats

- **Cambridge Dictionary.json**: Array of objects. Fields: `term` (headword), `altterm` (reading/variant), `pronunciation` (IPA), `definition` (HTML với numbered headings `<br>`, POS tags), `pos`, `examples`, `audio`. Definition dùng `atomicSplitter.js` để tách thành meaningAtoms (numbered sections).
- **En-Wiki Frequency List.json**: Simple JSON array of strings, ordered by frequency rank (index+1 = rank). `"the"`, `"of"`, `"and"`, etc. Import via `normalizeMigakuFreq(term, index, resourceId)` → `{ termKey, value: index+1, valueType: "rank" }`.
- **Yomitan format**: ZIP chứa `index.json` + `term_bank_*.json` (arrays of `[term, reading, ?, ?, ?, definitions[], ...]`) hoặc `term_meta_bank_*.json` (frequency). Normalized via `normalizeYomitanDictEntry/normalizeYomitanFreq`.

---

## Architecture Insights for Cell

- **OCEAN phrasal matching pattern**: Compile dictionary terms thành regex lúc import (migration), lưu vào IndexedDB với anchorWord index. Lúc lookup: lemmatize target word → query patterns by anchor → test regex → score → return best match. Pattern này có thể port sang Cell cho phrasal verb/idiom detection — đặc biệt scoring algorithm `(FixedWords × 10) + MatchLength` ưu tiên cụm từ cụ thể hơn wildcard.
- **Dictionary lookup modes**: `first_match` (nhanh, 1 dict) vs `stacked` (chậm hơn, nhiều dict). Cell nên hỗ trợ cả hai — stacked cho user muốn so sánh định nghĩa, first_match cho performance.
- **Content script popup pattern**: Mousemove debounce → `caretRangeFromPoint` → `getOceanContext` (bubble up DOM, Intl.Segmenter sentence split) → message passing to background → render popup stack. Pattern này directly applicable cho Cell's word popup. Popup stack cho nested lookup là rất hữu ích.
- **AnkiConnect integration**: HTTP POST to localhost:8765, field mapping auto-detect, audio/image upload as base64 via `storeMediaFile`, duplicate detection via `findNotes`. Browser TTS recording via `MediaRecorder` trong content script (service worker không có Web Audio API). Cell có thể reuse toàn bộ pattern này.
- **Importer strategy pattern**: BaseImporter abstract class, subclasses cho Migaku/Yomitan/ZIP. Auto-detect format by file content (index.json = Yomitan, string array = frequency, object array = dictionary). OCEAN migration triggered sau mỗi dictionary import. Cell nên adopt strategy pattern cho multi-format dictionary import.
- **Message passing architecture**: Content script → `chrome.runtime.sendMessage` → background → IndexedDB. Content script KHÔNG bao giờ truy cập DB trực tiếp (trừ oceanBundle.js cho phrasal patterns). `runtimeMessageWithTimeout` wrapper cho tất cả messages. Pattern này quan trọng cho Cell MV3.
- **`ensurePhrasalStore()` lesson**: IndexedDB store có thể bị xóa nhưng DB version không đổi → `onupgradeneeded` không trigger. Giải pháp: gọi `ensureStore()` trước mỗi operation. Cell cần pattern tương tự cho IndexedDB resilience.
- **What to port to Cell**: (1) OCEAN Engine — phrasal verb/idiom detection với scoring; (2) Dictionary lookup với first_match/stacked modes; (3) AnkiConnect integration với auto field mapping; (4) Importer strategy pattern cho multi-format; (5) Content script popup với sentence extraction; (6) TTS recording pattern; (7) Shortcut system với capture/duplicate detection.
