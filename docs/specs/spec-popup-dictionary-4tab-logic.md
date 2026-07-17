# Spec: Popup Dictionary — 4 Tab Logic (Audio / Image / Translate / Links)

## Objective

Hiện thực lớp data-fetch + wiring cho 4 tab popup dictionary (audio, image, translate, links) + TTS voice manager UI trong options page. Tham khảo `project-reference/theocean-extension-dictionary`.

**User story:** Anh yêu mở popup tra từ → 4 tab fetch data thật (Forvo audio, Google Images, Google Translate, external dict links) → chọn item → Quick Add vào Anki.

**Success criteria:**
- Audio tab: fetch Forvo (crawl HTML) + TTS voices từ `settings.tts.savedVoices`, play qua chrome.tts (fallback Web Speech), selection → Quick Add
- Image tab: scrape Google Images → render filmstrip, selection → Quick Add
- Translate tab: reuse `translate.ts` handler đã có, wire selection state → Quick Add
- Links tab: wire `settings.externalDictLinks` → `fillExternalDictLinks` (đã có)
- Options page: TTS voice manager UI (tester + drag-drop reorder + checkbox select + 3 slot selection)
- `npm run build` pass, `npm run test:unit` pass

## Tech Stack

- TypeScript strict, Vite, React (options page), vanilla DOM (content script popup)
- Chrome Extension MV3, `chrome.tts` API + Web Speech API fallback
- Zod schema validation tại message boundary
- Jest cho unit test

## Commands

```bash
Build:    npm run build
Test:     npm run test:unit
Lint:     npm run lint
Typecheck: npx tsc --noEmit
```

## Project Structure (files sẽ tạo/sửa)

```
src/
├── entities/settings/
│   └── types.ts                          # Sửa: thêm TtsSettings, TtsVoiceRow
├── entities/message/
│   └── types.ts                          # Đã có: FETCH_COMMUNITY_AUDIO, FETCH_IMAGES, TTS_SPEAK
├── features/
│   ├── dictionaryPopup/
│   │   ├── schema.ts                     # Sửa: thêm TtsVoiceSchema, TtsSettingsSchema
│   │   ├── types.ts                      # Sửa: thêm TtsVoice, TtsSettings type
│   │   ├── services/
│   │   │   ├── forvoAudioService.ts      # MỚI: crawl HTML forvo.com → AudioItem[]
│   │   │   ├── imageSearchService.ts     # MỚI: scrape Google Images → ImageItem[]
│   │   │   └── ttsEngineService.ts       # MỚI: chrome.tts + Web Speech fallback
│   │   └── ui/
│   │       ├── popupDictionaryController.ts  # Sửa: wire renderTabPanel fetch
│   │       └── popupToolbar.ts               # Sửa: loading/error states cho audio/image
│   └── tts/
│       └── ui/
│           └── TtsVoiceManagerPanel.tsx      # MỚI: options page TTS voice manager
├── entrypoints/
│   ├── background/
│   │   ├── handlers/
│   │   │   ├── forvoAudio.ts             # MỚI: FETCH_COMMUNITY_AUDIO handler
│   │   │   ├── images.ts                 # MỚI: FETCH_IMAGES handler
│   │   │   └── tts.ts                    # MỚI: TTS_SPEAK handler
│   │   └── index.ts                      # Sửa: register 3 handlers mới
│   └── options/
│       ├── OptionsApp.tsx                # Sửa: thêm tab "TTS Voices"
│       └── types.ts                      # Sửa: thêm 'tts' vào Tab union
└── shared/
    └── config/
        └── messages.ts                   # Đã có: message type constants
```

## Code Style

```typescript
// Named export, không default export
export function fetchForvoAudio(term: string, langCode: string): Promise<AudioItem[]> { ... }

// Logic tách hàm thuần, dễ test, không side effect
export function parseForvoHtml(html: string, langCode: string): AudioItem[] { ... }

// TypeScript strict, không any
export function scoreAudioByAccent(
  items: readonly AudioItem[],
  preferredAccent: 'US' | 'UK',
): AudioItem[] { ... }
```

## Testing Strategy

- **Unit test** cho logic thuần: `forvoAudioService.test.ts` (parse HTML), `imageSearchService.test.ts` (parse URLs), `ttsEngineService.test.ts` (engine selection)
- **Colocate test**: `forvoAudioService.ts` → `forvoAudioService.test.ts`
- **Integration**: background handler test với mock fetch
- Coverage: logic thuần ≥ 80%, UI handler smoke test

## Boundaries

- **Always:** Run `npm run test:unit` trước commit, follow naming conventions, validate message payload bằng Zod schema, ICON_CATALOG cho icon, tokens.css cho color
- **Ask first:** Thêm dependency mới, sửa manifest.json, thay đổi message type union
- **Never:** Inline SVG trong component, hardcode color, commit secrets, skip Zod validation tại message boundary

## Success Criteria (chi tiết)

### Audio tab
- [ ] `FETCH_COMMUNITY_AUDIO` handler crawl `https://forvo.com/word/{term}/#en`, parse HTML, trả `AudioItem[]`
- [ ] `TTS_SPEAK` handler: thử `chrome.tts.speak`, fallback `speechSynthesis.speak`
- [ ] Audio panel render: Forvo items (nếu có) + TTS voices từ `settings.tts.savedVoices`
- [ ] Play button: gọi `TTS_SPEAK` hoặc play Forvo URL qua `<audio>` element
- [ ] Selection → `audioSelection` Map → Quick Add payload

### Image tab
- [ ] `FETCH_IMAGES` handler scrape `https://www.google.com/search?q={term}&tbm=isch`, regex URL ảnh, filter gstatic/encrypted
- [ ] Image panel render filmstrip từ `ImageItem[]`
- [ ] Selection → `imageSelection` Map → Quick Add payload

### Translate tab
- [ ] Reuse `TRANSLATE` handler đã có (translate.ts)
- [ ] `renderTranslatePanel` wire `onTranslate` → gửi `TRANSLATE` message
- [ ] Selection toggle → `translationSelected` → Quick Add payload

### Links tab
- [ ] `renderLinksPanel` đọc `settings.externalDictLinks` → `fillExternalDictLinks` → render
- [ ] Click link mở new tab (`target=_blank`, `rel=noopener noreferrer`)

### Options page — TTS voice manager
- [ ] Tab "TTS Voices" trong sidebar options
- [ ] Voice tester: list all `chrome.tts.getVoices()`, drag-drop reorder, checkbox select, play button
- [ ] Country filter dropdown
- [ ] Save button → `settings.tts.savedVoices: {voiceName, lang, order}[]`
- [ ] 3 slot selection (Voice 1, 2, 3) → `settings.tts.voices: string[]`

## Open Questions

Không — đã confirm trong interview.
