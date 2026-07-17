# TODO: Popup Dictionary 4 Tab Logic

## Phase 1: Foundation
- [ ] T1: Thêm TtsSettings + TtsVoiceRow type vào settings/types.ts + schema.ts
- [ ] T2: Thêm host_permissions forvo.com vào manifest.json

## Phase 2: Background handlers
- [ ] T3: forvoAudioService.ts (parse HTML thuần) + test
- [ ] T4: forvoAudio.ts handler (FETCH_COMMUNITY_AUDIO) + register
- [ ] T5: imageSearchService.ts (scrape Google Images thuần) + test
- [ ] T6: images.ts handler (FETCH_IMAGES) + register
- [ ] T7: ttsEngineService.ts (chrome.tts + Web Speech fallback) + test
- [ ] T8: tts.ts handler (TTS_SPEAK) + register

## Phase 3: Controller wiring
- [ ] T9: renderTabPanel — wire audio fetch + TTS voices
- [ ] T10: renderTabPanel — wire image fetch
- [ ] T11: renderTabPanel — wire translate (reuse TRANSLATE)
- [ ] T12: renderTabPanel — wire links (settings.externalDictLinks)
- [ ] T13: popupToolbar.ts — loading + error states

## Phase 4: Options UI — TTS voice manager
- [ ] T14: TtsVoiceManagerPanel.tsx — voice tester
- [ ] T15: TtsVoiceManagerPanel.tsx — 3 slot selection + save
- [ ] T16: OptionsApp.tsx — thêm tab "TTS Voices"

## Phase 5: Tests + review
- [ ] T17: Unit test cho 3 service modules
- [ ] T18: Build + test:unit + lint pass
- [ ] T19: Review bằng subagent
