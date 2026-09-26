# Browser Voice — Redesign Design Brief

> **Status: APPROVED → SHIPPED.** Anh picked **Concept A · Just the list** ("tôi dùng list ạ. phải có animation mượt"). Implemented as `src/features/audio/ui/BrowserVoicePanel.tsx` — `TtsVoiceManagerPanel` deleted; `DEFAULT_TTS_SETTINGS` moved to `shared/config/config.ts`. Popup speak buttons removed (2026-09, Anh's call — voice list no longer spawns `dictionary-play-voice-N` buttons); word + sentence playback both use voice ① via `playTerm`/`playSentence`.

> Redesign of the `browserTts` detail pane inside the Audio settings card (previously the flattened `TtsVoiceManagerPanel`). Driver: Anh's feedback — the screen shows too many features at once, the journey isn't completable without reading instructions. v2: tối giản hơn, lấy ngôn ngữ visual từ tab Dictionary của popup.

## 0. Context

- **Current UI:** `src/features/tts/ui/TtsVoiceManagerPanel.tsx` rendered inside `SourceDetailPanel` (engine `browserTts`) — 2 stacked cards (TTS settings + voice tester) plus the card-level "Try it"/"Autoplay" below it, producing duplicate testers, two save buttons, an inner-scrolling radio-slot list, a country filter, drag-and-drop ordering, and an enable toggle.
- **Directives (Anh):**
  1. Voice list comes from the system voice list **auto-filtered by the active profile's target language** (e.g. target `en`, native `vi` → only `en-*` voices). No "filter by country".
  2. **No "Enable TTS"** toggle — TTS is always on.
  3. **No "Show buttons"** setting — always 3 buttons.
  4. Layout by **proximity** — nothing clipped inside nested scroll areas, nothing hidden off-screen.
  5. v2: even more minimal, **inspired by the dictionary tab** (`PronunciationAudioPanel` + `DictionaryCheckable` rows).
- **Existing logic to reuse:** `getTtsVoiceRows(savedVoices, allVoices, langCode)` in `ttsEngineService.ts` already implements lang-prefix auto-detect; `tts.voices` (3 priority slot names) is the only persisted field the new UI needs to write.
- **Visual source:** the dictionary popup's checkable row — `cellAudioItem` (round primary ▶ | two-line label | reserved check slot with idle dot → checked morph) from `DictionaryCheckable.module.css` + `PronunciationAudioPanel`.
- **Mockup:** `src/entrypoints/mockup-browser-voice/` — live `speechSynthesis` voices, target-language switcher to prove auto-filtering.

## 1. Primary job

*Assign one voice to each of the 3 speak buttons shown on a word — hear it before choosing.* Everything else (enable, button count, country filter, second tester list, drag ordering) is deleted or absorbed.

## 2. Dials

| Dial | Default | Why |
|---|---|---|
| `DESIGN_VARIANCE` | 8 | Three genuinely different IA models, not skins. |
| `MOTION_INTENSITY` | 2 | Selection + saved flash only; dictionary-row hover. |
| `VISUAL_DENSITY` | 3 | One job per screen region; proximity grouping. |

## 3. Three concepts (v2 — dictionary-tab visual language)

All three reuse the popup dictionary's checkable-row atom: round primary ▶ | two-line label (name + `lang · Natural`) | reserved check slot (idle dot → hover ring → numbered badge ①②③). They diverge in **IA chrome**, not in the row.

### Concept A — Just the list *(destination implicit)*

- **IA mental model:** the list IS the picker. Tap a voice row → it takes the next free button (numbered badge, tap order); tap again → removed. ▶ previews without assigning.
- **UI structure:** one header line (`English voices` + `n of 3 buttons set` + inline `✓ Saved`) → flat rows. Nothing else on screen.
- **3 dials:** `DESIGN_VARIANCE: 6`, `MOTION_INTENSITY: 2`, `VISUAL_DENSITY: 3`.
- **Why it fits:** minimal possible surface — identical to the audio tab users already know; zero new vocabulary.
- **Risk:** reorder = remove + re-tap; which button a pick lands on is implicit (mitigated by badge numbers + "n of 3" counter).

### Concept B — Button mirror *(destination explicit, WYSIWYG)*

- **IA mental model:** the popup's circular speaker-button row is rendered for real on top. Tap a button to arm it (ring highlight) — tapping a filled button previews it — then tap a voice row to fill the armed button; armed auto-advances to the next empty.
- **UI structure:** 3 round buttons (numbered badge, caption = voice name / "empty" / "pick ↓") → divider → `English voices` header → same checkable list.
- **3 dials:** `DESIGN_VARIANCE: 7`, `MOTION_INTENSITY: 3`, `VISUAL_DENSITY: 4`.
- **Why it fits:** the thing being configured is visible as the thing itself — direct mapping to what appears on a word.
- **Risk:** two gestures per assignment (arm, then pick).

### Concept C — 3 rows *(progressive disclosure)*

- **IA mental model:** at rest the screen is three lines: Button 1 / 2 / 3 with the assigned voice (or "Pick a voice"). Tapping a row expands the voice list inline (accordion); pick once → closes, previews, saves. Voice already on another button is annotated `· button N`.
- **UI structure:** `Speak buttons` header + Saved flash → 3 rows (numbered circle | ▶ preview | name + meta | chevron) → inline picker list under the open row.
- **3 dials:** `DESIGN_VARIANCE: 8`, `MOTION_INTENSITY: 3`, `VISUAL_DENSITY: 2`.
- **Why it fits:** smallest possible resting state — nothing to read; picker exists only while choosing.
- **Risk:** hidden list = one extra tap to discover voices.

## 4. Responsive behavior

| Viewport | A | B | C |
|---|---|---|---|
| **320 px** | Header wraps to two lines; rows keep 44px touch. | 3 buttons keep equal thirds; captions ellipsize. | 3 rows full-width; picker rows same. |
| **560 px+** | Same, more breathing room. | Same; strip may sit beside the list. | Same; picker has more room. |

## 5. States

- **Idle check slot** — small dot (dictionary `cellDefCheck` idiom); hover reveals ring.
- **In use** — numbered badge ①②③ on the row + primary-subtle row tint.
- **Armed (B)** — button ring + `pick ↓` caption.
- **Open (C)** — row expands; chevron flips; picker slides under.
- **Playing** — play icon swaps to pause; only one voice plays at a time.
- **Saved** — inline `✓ Saved` pulse on every mutation (auto-persist; no save buttons).
- **Loading voices** — single muted line; **no voices for target lang** → fall back to full list (never an empty screen).
- **All 3 filled (A)** — extra taps flash a one-line hint "remove one first".

## 6. Anti-patterns avoided

- No inner scroll list inside a card inside a dialog (voice list uses the pane's own height).
- No duplicate tester — per-voice ▶ previews use one sample sentence; the card-level "Try it" keeps testing the whole pipeline.
- No enable toggle, no button-count select, no country filter, no drag-and-drop, no double save.
- No hardcoded colors/px — `tokens.json` names only; row atom mirrors `DictionaryCheckable` geometry.

## 7. Text & i18n

New keys (proposed): `audio.voice.count` (`$1 of 3 buttons set`), `audio.voice.saved`, `audio.voice.full`, `audio.voice.pick`, `audio.voice.empty`, `audio.voice.button`, `audio.voice.onButton` (`button $1`). All routed through `src/shared/i18n/messages/*` at implementation time.

## 8. Design Read

> *Như tab Dictionary: một hàng tròn ▶, một hàng chữ, một dấu chọn — chạm là có giọng, chạm lại là bỏ. Màn hình chỉ còn đúng một danh sách.*
