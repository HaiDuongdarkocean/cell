# Audio — Mockup v2 Design Brief

> ⚠️ **Superseded note (2026-09-08):** Tài liệu này tham chiếu Liquid Glass / glass material / blur — vật liệu này đã bị loại khỏi Cell. Luật thiết kế hiện hành: `docs/design-system/DESIGN_RATIONALE.md`; checklist: `docs/design-system/DESIGN.md`. Nội dung yêu cầu tính năng trong tài liệu vẫn hiệu lực; chỉ các mô tả visual kiểu glass/blur không còn áp dụng.

> Three new interface concepts (D · E · F) for the merged **Audio** settings section, built after studying the shipped production panel and the first A/B/C mockup iteration.

---

## 0. Context

- **Source of truth:** `docs/intent/audio-design-brief.md` (primary job, must-haves, design story).
- **Real panel:** `src/features/settings/ui/PronunciationSettingsPanel.tsx`, `LocalPronunciationSettingsPanel.tsx`, `src/features/tts/ui/TtsVoiceManagerPanel.tsx`.
- **Feature tree:** `docs/intent/audio-screen-feature-tree.md`.
- **Mockup site:** `src/entrypoints/mockup-audio/`.

## 1. Primary job

*Configure ALL audio sources seamlessly — local file, community audio, cloud TTS, browser TTS, eSpeak — with a user-ordered priority chain and a single place to test before saving.*

## 2. Dials

| Dial | Default | Why |
|---|---|---|
| `DESIGN_VARIANCE` | 6 | New concepts push the IA further than the shipped panel, but still use familiar primitives. |
| `MOTION_INTENSITY` | 4 | Step transitions, accordion chevrons, and active states are gentle; no flashy motion. |
| `VISUAL_DENSITY` | 5 | Each concept hides some content by default to keep the screen breathable. |

## 3. Three new concepts

### Concept D — Audio Stepper *(experimental, wizard)*

- **IA mental model:** A 4-step setup wizard: **Source order → Local package → TTS voices → Test & save**. The user sees only one step at a time, with a clear progress rail and Back / Next / Save footer.
- **UX flow:**
  1. Land on **Source order**, reorder engines.
  2. Next → **Local package**, choose files and build the index.
  3. Next → **TTS voices**, enable TTS, pick slots, test voices.
  4. Next → **Test & save**, use the inline tester, then save.
- **UI structure:** Horizontal stepper rail at the top; a single content area below; footer with Back / Next / Save. The tester appears on the final step (and optionally on each step later).
- **3 dials:** `DESIGN_VARIANCE: 8`, `MOTION_INTENSITY: 5`, `VISUAL_DENSITY: 4`.
- **Why it fits:** Best for first-time setup and the broad 5–80 age range; drastically reduces cognitive load by showing one decision at a time.
- **Risk:** Returning users may find clicking through steps slow; may need a "switch to full view" escape hatch.

### Concept E — Audio Accordion *(hybrid)*

- **IA mental model:** Every audio channel is an **expandable section** in one long card. The audio tester is sticky at the top so it is always reachable. The user opens only what they need.
- **UX flow:**
  1. See all four channels collapsed.
  2. Open **Source priority**, reorder.
  3. Open **Local package**, pick files.
  4. Open **TTS voices**, configure voices and run the tester.
  5. Open **Local speech packs** to manage downloads.
- **UI structure:** Card header + sticky audio tester + `<Accordion type="multiple">` with four items. Each trigger shows an icon, label, and a one-line hint.
- **3 dials:** `DESIGN_VARIANCE: 6`, `MOTION_INTENSITY: 4`, `VISUAL_DENSITY: 6`.
- **Why it fits:** Calm, scannable, mobile-friendly; respects progressive disclosure (chunking) and keeps the tester in context.
- **Risk:** Important settings may be hidden behind collapsed sections; users may miss the local TTS packs channel.

### Concept F — Audio Split Inspector *(experimental)*

- **IA mental model:** A **source list on the left, detail pane on the right**. Clicking an engine in the priority chain opens its configuration in the detail pane — like a settings inspector or small IDE.
- **UX flow:**
  1. See the priority chain in the left rail.
  2. Click **Local Forvo package** or **Community audio** → right pane shows Local package settings.
  3. Click **Supertonic / Browser TTS / eSpeak** → right pane shows TTS voices and local packs.
  4. Click **Priority chain** → right pane shows the reorderable list.
  5. Use the top tester at any time.
- **UI structure:** Top tester, then a two-column split: left rail (source list), right detail pane. On mobile the rail sits above the detail pane.
- **3 dials:** `DESIGN_VARIANCE: 9`, `MOTION_INTENSITY: 3`, `VISUAL_DENSITY: 5`.
- **Why it fits:** Directly maps the mental model "pick a source, tune it" and keeps the priority order visible while editing details.
- **Risk:** More complex on mobile; left rail may feel like a second navigation layer.

## 4. Responsive behavior

| Viewport | Concept D | Concept E | Concept F |
|---|---|---|---|
| **320 px** | Stepper rail wraps; one step fills the width; footer Back/Next stack. | Tester sticky; accordion triggers full-width; content full-width. | Tester full-width; rail + detail pane stack vertically. |
| **768 px** | Stepper rail stays in one row; content area gets more padding. | Accordion hints become visible; tester can sit beside title. | Rail and detail side-by-side; rail fixed width ~200 px. |
| **1280 px** | Stepper centered; max-width ~720 px; footer aligned right. | Same as 768, more whitespace. | Rail ~240 px; detail pane wider. |

## 5. States

- **Default:** Concept opens in its initial state (step 1, first accordion open, priority chain selected).
- **Hover:** Step buttons, rail items, accordion triggers use `var(--color-surface-hover)`.
- **Active/Selected:** Step active, rail active item, and accordion expanded use `var(--color-primary)` / `var(--color-primary-subtle)`.
- **Focus:** `focus-visible` ring with `var(--shadow-focus)`.
- **Disabled:** Back on step 1, Next on last step.
- **Playing:** Tester play button shows `pause` icon, status text updates.
- **Loading/Empty/Error/Success:** Reuse existing mock states from `common.tsx`.

## 6. Anti-patterns avoided

- No three separate sidebar items for the same audio domain.
- No long unbroken card forcing the user to scroll through everything.
- No tabs that hide the tester (Concept E keeps tester sticky; Concept F keeps it above the split).
- No glass-on-glass beyond two layers.
- No hardcoded colors or px outside tokens.

## 7. Text & i18n

All new UI copy follows the keys proposed in `audio-text-audit.md`:

- `settings.audio.*` for section labels.
- `settings.audio.priority.*` for source order.
- `settings.audio.local.*` for local package.
- `settings.audio.tts.*` for TTS configuration.
- `settings.audio.tester.*` for the inline tester.

Concept D adds minimal new copy: step labels (already covered by existing keys), "Back", "Next", "Save settings".

## 8. Design Read

> *Dàn âm thanh trên mặt hồ — từng kênh trong suốt, mở ra khi cần, cùng chảy vào một đầu ra duy nhất.*
