# Audio Screen — Feature Directory Map

> Sơ đồ thư mục tính năng của màn hình **Audio** trong Cell Settings.
> Nguồn sự thật: screenshot `chrome_DN3MZkQg73.png`, production panels, `docs/intent/audio-design-brief.md`.

---

## 1. Feature tree (logical)

```
Audio (Settings section)
│
├── Header
│   ├── Title: "Audio"
│   └── Description: "Production panels for pronunciation, local package, and TTS voices."
│
├── Audio Source Priority
│   ├── Description: "Engines are tried in order. Drag is not supported; use the up/down buttons to reorder."
│   ├── Engine list (ordered fallback chain)
│   │   ├── Local Forvo package
│   │   ├── Community audio (Wikimedia)
│   │   ├── Supertonic cloud TTS
│   │   ├── Browser / Google TTS
│   │   └── eSpeak on-device TTS
│   ├── Reorder actions: Up / Down per engine
│   └── Download eSpeak TTS data toggle
│
├── Local Audio Package
│   ├── Package type selector
│   │   ├── Single .dsl files.zip
│   │   └── Split zips (per first letter)
│   ├── Lingvo DSL index file picker
│   ├── Audio archive / folder picker
│   ├── Archive name pattern input (split mode)
│   ├── Build index button
│   ├── Status / error messages
│   └── Last indexed timestamp
│
├── Text-to-Speech (TTS)
│   ├── Enable TTS toggle
│   ├── Show buttons (max display) selector: 1 / 2 / 3
│   ├── Voice selection with 3 priority slots
│   │   ├── Play button per voice
│   │   ├── Radio slot 1 / 2 / 3 per voice
│   │   └── Voice name + lang tag
│   ├── Autoplay count selector: 0 / 1 / 2 / 3
│   └── Save settings button
│
├── TTS Tester
│   ├── Test sentence textarea
│   ├── Filter by language/country selector
│   ├── Voice list
│   │   ├── Drag handle
│   │   ├── Order number input
│   │   ├── Play button
│   │   ├── Checkbox + voice name + lang tag
│   │   └── Pagination (if list is long)
│   └── Bulk actions
│       ├── Clear selection (N)
│       ├── Play all audios
│       └── Save TTS voice list
│
└── Local TTS (Supertonic v3)
    ├── Enable local TTS toggle
    ├── Default playback language selector
    ├── Downloaded voice packs list
    │   ├── Hide / show pack
    │   ├── Re-download pack
    │   └── Delete pack
    └── Add language selector + Download button
```

---

## 2. Physical directory map (repo)

```
cell/
├── docs/intent/
│   ├── audio-design-brief.md          # 3 concept directions + design decisions
│   ├── audio-text-audit.md            # i18n/copy audit for all audio strings
│   ├── ocean-pronunciation-engine.md  # engine fallback + eSpeak integration intent
│   └── audio-screen-feature-tree.md   # this file
│
├── src/entrypoints/mockup-audio/      # interactive mockup site (idea-to-interface output)
│   ├── index.html
│   ├── main.tsx                       # shell: concept / viewport / theme switchers
│   ├── real.tsx                       # production panels mounted live
│   ├── ConceptD.tsx                   # Audio Stepper
│   ├── ConceptE.tsx                   # Audio Accordion
│   ├── ConceptF.tsx                   # Audio Split Inspector
│   ├── common.tsx                     # shared mock pieces (tester, chain, local, tts)
│   ├── mockData.ts                    # mock state + helpers
│   ├── state.ts                       # useMockAudio hook
│   ├── mockup.module.css
│   └── (ConceptA/B/C are archived in git history but no longer imported)
│
├── src/features/settings/ui/          # production settings panels
│   ├── PronunciationSettingsPanel.tsx       # audio source priority + eSpeak toggle
│   ├── PronunciationSettingsPanel.module.css
│   ├── PronunciationSettingsPanel.test.tsx
│   ├── LocalPronunciationSettingsPanel.tsx  # local package file/index UI
│   ├── SettingsDialog.tsx
│   ├── SettingsDialog.module.css
│   ├── SettingsDialogContent.tsx      # cards 7.4, 7.5, 10 + sidebar nav
│   └── mountSettingsDialog.ts
│
├── src/features/tts/ui/               # TTS production panels
│   ├── TtsVoiceManagerPanel.tsx       # TTS settings + tester + local packs
│   ├── TtsVoiceManagerPanel.module.css
│   ├── TtsVoiceManagerPanel.showcase.tsx
│   ├── TtsVoiceManagerPanel.showcase.module.css
│   └── TtsLanguagePanel.tsx           # local Supertonic v3 language packs
│
├── src/entities/settings/types.ts     # PronunciationSettings, TtsSettings, TtsVoiceRow, AudioEngineKind
│
├── src/shared/config/config.ts        # DEFAULT_PRONUNCIATION_SETTINGS
│
├── src/shared/ui/                     # shared UI primitives used by audio panels
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Checkbox.tsx
│   ├── Heading.tsx
│   ├── Icon.tsx
│   ├── Input.tsx
│   ├── Select.tsx
│   ├── SettingsRow.tsx
│   ├── Stack.tsx (HStack / VStack)
│   ├── Text.tsx
│   ├── Textarea.tsx
│   ├── Toggle.tsx
│   └── ...
│
└── src/shared/i18n/messages/          # text source of truth (target per audio-text-audit.md)
    ├── en.json
    └── vi.json
```

---

## 3. Data flow

```
SettingsDialogContent.tsx
    ├── renders PronunciationSettingsPanel  ─����──▶ PronunciationSettings
    │       └── fallbackEngines: AudioEngineKind[]
    │       └── downloadEspeakTtsData: boolean
    │
    ├── renders LocalPronunciationSettingsPanel ──▶ PronunciationSettings.localFile
    │       └── packageType / dslFileHandleId / audioArchiveHandleId
    │       └── splitArchiveDirectoryHandleId / splitArchivePattern / lastIndexedAt
    │
    └── renders TtsVoiceManagerPanel  ──▶ TtsSettings
            ├── enabled / maxDisplay / autoplayCount / voices
            ├── savedVoices: TtsVoiceRow[]
            ├── localTtsEnabled / localTtsLanguage
            ├── downloadedLanguages / hiddenLanguages
            └── TtsLanguagePanel (local packs)
```

---

## 4. Key entities

| Entity | File | Purpose |
|--------|------|---------|
| `AudioEngineKind` | `src/entities/settings/types.ts:118` | 5 audio source identifiers |
| `PronunciationSettings` | `src/entities/settings/types.ts:145` | Fallback chain + eSpeak + local package |
| `LocalFileAudioSettings` | `src/entities/settings/types.ts:129` | File handle IDs and package type |
| `TtsSettings` | `src/entities/settings/types.ts:155` | Master TTS config, voice slots, local packs |
| `TtsVoiceRow` | `src/entities/settings/types.ts:110` | Saved voice with sort order |

---

## 5. Notes

- The screenshot shows the **shipped production UI**: three separate panels stacked inside one `Audio` card.
- The redesign goal is to merge `Pronunciation`, `Local Pronunciation`, and `TTS Voices` into a single **Audio** section with a unified audio tester.
- The mockup at `src/entrypoints/mockup-audio/` is the decision surface for comparing the real panel against three new interface concepts.
- v2 design brief and component mapping: `docs/intent/audio-mockup-v2-design-brief.md`, `docs/intent/audio-mockup-v2-component-mapping.md`.
