# Implementation Plan: Popup Dictionary 4 Tab Logic

## Overview

Wire data-fetch + controller cho 4 tab popup dictionary (audio/image/translate/links) + TTS voice manager UI trong options. Tham khảo `project-reference/theocean-extension-dictionary`.

## Architecture Decisions

1. **Forvo crawl HTML** (không API) — parse `#pronunciations-list-en_uk` + `en_usa`, decode base64 URL. Cần host_permissions forvo.com.
2. **TTS cross-browser** — `chrome.tts` API chính (Chrome/Edge/Brave), `speechSynthesis` fallback (Firefox/Safari). Cùng interface `TtsEngine`.
3. **Google Images scrape** — fetch HTML, regex URL `.jpg|.png|.jpeg`, filter gstatic/encrypted. Ponytail: Google có thể break regex bất kỳ lúc nào.
4. **Settings schema** — thêm `tts: { savedVoices: TtsVoiceRow[], voices: string[], enabled, maxDisplay, autoplayCount }` vào `DictionaryPopupSettings`.
5. **Logic thuần tách module** — `forvoAudioService.ts`, `imageSearchService.ts`, `ttsEngineService.ts` không side-effect, dễ unit test.

## Task List

### Phase 1: Foundation (settings + manifest)
- [ ] T1: Thêm TtsSettings + TtsVoiceRow type vào settings/types.ts + schema.ts
- [ ] T2: Thêm host_permissions forvo.com + audio00.forvo.com vào manifest.json

### Checkpoint: Foundation
- [ ] Build pass, typecheck pass

### Phase 2: Background handlers
- [ ] T3: forvoAudioService.ts (parse HTML thuần) + test
- [ ] T4: forvoAudio.ts handler (FETCH_COMMUNITY_AUDIO) + register
- [ ] T5: imageSearchService.ts (scrape Google Images thuần) + test
- [ ] T6: images.ts handler (FETCH_IMAGES) + register
- [ ] T7: ttsEngineService.ts (chrome.tts + Web Speech fallback) + test
- [ ] T8: tts.ts handler (TTS_SPEAK) + register

### Checkpoint: Background handlers
- [ ] Build pass, unit test pass

### Phase 3: Controller wiring
- [ ] T9: popupDictionaryController.renderTabPanel — wire audio fetch + TTS voices
- [ ] T10: popupDictionaryController.renderTabPanel — wire image fetch
- [ ] T11: popupDictionaryController.renderTabPanel — wire translate (reuse TRANSLATE)
- [ ] T12: popupDictionaryController.renderTabPanel — wire links (settings.externalDictLinks)
- [ ] T13: popupToolbar.ts — loading + error states cho audio/image panel

### Checkpoint: Controller wiring
- [ ] Build pass, popup mở 4 tab fetch data thật

### Phase 4: Options UI — TTS voice manager
- [ ] T14: TtsVoiceManagerPanel.tsx — voice tester (list, drag-drop, checkbox, play)
- [ ] T15: TtsVoiceManagerPanel.tsx — 3 slot selection + save button
- [ ] T16: OptionsApp.tsx — thêm tab "TTS Voices" + wire

### Checkpoint: Options UI
- [ ] Build pass, options page render TTS manager

### Phase 5: Tests + review
- [ ] T17: Unit test cho 3 service modules
- [ ] T18: Build + test:unit + lint pass
- [ ] T19: Review bằng subagent

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Forvo HTML structure đổi | High | Parse tolerant, fallback empty array, ponytail comment |
| Google Images regex break | High | Filter gstatic/encrypted, dedup, ponytail comment |
| chrome.tts không có voice cho langCode | Med | Fallback Web Speech, auto-detect voices |
| Forvo block CORS / rate-limit | Med | Background fetch (bypass CORS), 5s timeout |
| Settings migration (thêm tts field) | Low | Optional field, default undefined → auto-detect |

## Open Questions

Không — đã confirm trong interview.
