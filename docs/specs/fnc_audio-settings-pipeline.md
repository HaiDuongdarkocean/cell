# Spec: Audio Settings — Pipeline (fnc_audio-settings-pipeline)

## Assumptions (correct me now)

1. The refactor is **UI/IA only** in Settings; it does not change the runtime audio orchestration or the `PronunciationAudioOrchestrator` fallback contract.
2. The existing data model (`settings.pronunciation` + `settings.dictionaryPopup.tts`) is kept. No schema migration is required for this phase.
3. The new panel is the **Audio** card inside `SettingsDialogContent`, replacing three existing cards (`Pronunciation`, `Local Pronunciation`, `TTS Voices`).
4. The user has chosen **Concept H (Audio Pipeline)** from the mockup at `src/entrypoints/mockup-audio/`.
5. Sidebar/nav labels remain hardcoded English for now; i18n strings will be added as a follow-up using `docs/intent/audio-text-audit.md`.
6. Voice packs remain limited to English (`en`) for Supertonic v3 until `fnc_tts.md` expands languages.
7. No new runtime TTS engine is added; the refactor only exposes existing engines in a new layout.

---

## Objective

Merge the three Audio-related Settings sections (`Pronunciation`, `Local Pronunciation`, `TTS Voices`) into a single **Audio** section with a **pipeline** mental model. The user selects an output mode, sees the priority chain as a horizontal pipeline, and taps any source to inspect/tune it.

### Success criteria

- One sidebar item `Audio` replaces `Pronunciation`, `Local Pronunciation`, and `TTS Voices`.
- One Settings card renders the merged UI using Concept H layout.
- Output modes (`Auto`, `Natural`, `Fast`, `Offline`, `Minimal data`) map to a hidden priority chain.
- The pipeline visualizes the current fallback order with status dots (`ready` / `missing` / `disabled`).
- Tapping a pipeline source opens its detail pane for configuration.
- Local package, TTS voices, and Supertonic pack configuration still work as before.
- All existing audio unit tests pass after the refactor.
- Build, typecheck, and unit tests pass.

---

## Tech Stack

- **Framework**: React 18 + TypeScript
- **State**: Local component state + callbacks propagated to parent (`onChange` pattern in `SettingsDialogContent`)
- **UI library**: `src/shared/ui` (`Button`, `Card`, `Heading`, `Icon`, `Select`, `SettingsRow`, `Text`, `Toggle`, `VStack`)
- **CSS**: CSS Modules + design tokens from `tokens.json`
- **Tests**: Jest + Testing Library + jsdom
- **Icons**: Reuse existing icons from `ICON_CATALOG` (`folderOpen`, `audioWave`, `download`, `play`, `settings`)

---

## Commands

```bash
# Dev server
npm run dev

# Open mockup in browser
http://localhost:3000/src/entrypoints/mockup-audio/index.html

# Type check
npx tsc --noEmit

# Unit tests (audio scope)
npx jest --selectProjects unit --testPathPatterns "audio|tts|pronunciation"

# Full build
npm run build

# Lint touched files
npx eslint src/features/audio src/features/settings/ui/SettingsDialogContent.tsx
```

---

## Project Structure

```
src/
├── features/
│   └── audio/
│       └── ui/
│           ├── AudioPanel.tsx              # new: main Audio card
│           ├── AudioPanel.module.css       # new: pipeline + detail styles
│           ├── AudioPanel.test.tsx         # new: unit tests
│           ├── AudioPipeline.tsx           # new: horizontal pipeline component
│           ├── SourceDetailPanel.tsx       # new: detail pane per engine
│           ├── SourceDetailPanel.module.css
│           ├── AudioTester.tsx             # new: compact inline tester
│           ├── VoiceSettings.tsx           # new: voice char + autoplay
│           └── VoiceSettings.module.css
├── features/settings/ui/
│   ├── SettingsDialogContent.tsx           # update: replace 3 cards with AudioPanel
│   └── SettingsDialogContent.test.tsx      # update: reflect new labels
├── features/tts/ui/
│   ├── TtsVoiceManagerPanel.tsx            # keep (may be rendered inside detail pane)
│   └── TtsLanguagePanel.tsx                # keep
├── features/pronunciation/services/
│   └── pronunciationAudioOrchestrator.ts   # unchanged runtime contract
├── shared/i18n/messages/
│   ├── en.json                             # future: add audio keys
│   └── vi.json                             # future: add audio keys
└── docs/intent/audio-text-audit.md         # source of i18n keys
```

---

## Code Style

```tsx
// Named export, no default export
export function AudioPanel(): React.JSX.Element { ... }

// Props use the existing Settings onChange pattern
export interface AudioPanelProps {
  readonly pronunciation: PronunciationSettings;
  readonly tts: TtsSettings;
  readonly onPronunciationChange: (next: PronunciationSettings) => void;
  readonly onTtsChange: (next: TtsSettings) => void;
}

// Mapping function is a pure utility, not a side effect
function getOutputModeChain(mode: OutputMode): AudioEngineKind[] { ... }

// CSS modules use token variables
.pipelineTrack {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}
```

- No `any`.
- Prefer existing shared UI components.
- CSS uses design tokens only; no hardcoded colors or pixel values.
- Files named with PascalCase for components, camelCase for utilities.

---

## Testing Strategy

- **Unit tests** (`AudioPanel.test.tsx`):
  - Output mode selection updates `fallbackEngines`.
  - Pipeline renders correct number of steps.
  - Tapping a pipeline step opens the detail pane.
  - Local package detail pane opens and builds index.
  - TTS detail pane toggles enabled and sets autoplay count.
- **SettingsDialogContent tests**: update to assert single `Audio` card and removed old cards.
- **No E2E for this phase**; browser mockup at `src/entrypoints/mockup-audio/` is the visual verification.

---

## Boundaries

### Always do
- Run `npx tsc --noEmit` before commit.
- Run `npx jest --selectProjects unit --testPathPatterns "audio|tts|pronunciation"` after UI changes.
- Reuse `src/shared/ui` components before writing custom markup.
- Keep `PronunciationAudioOrchestrator` contract unchanged.

### Ask first
- Changing `entities/settings/types.ts` schema.
- Adding a new dependency.
- Moving `TtsSettings` out of `settings.dictionaryPopup.tts`.

### Never do
- Remove existing audio tests without approval.
- Commit secrets or local file handles.
- Break the runtime fallback chain contract.

---

## Success Criteria

| # | Criterion | How to verify |
|---|---|---|
| 1 | `SettingsDialogContent` renders exactly one `Audio` card | Unit test assert |
| 2 | Sidebar has exactly one `Audio` nav item | Unit test / manual |
| 3 | Pipeline shows 5 sources in default `Auto` mode | `AudioPanel.test.tsx` |
| 4 | Output mode `Offline` maps to `['localFile', 'espeak', 'supertonic']` | Unit test |
| 5 | Tapping `localFile` step opens Local package detail | Unit test |
| 6 | Tapping `browserTts` step opens TTS voices detail | Unit test |
| 7 | Local package build index still works | Unit test |
| 8 | Build, typecheck, unit tests pass | CI / local commands |
| 9 | No regression in `PronunciationAudioOrchestrator` | Existing tests pass |

---

## Definition of Done

- [ ] Spec reviewed and approved by human.
- [ ] All acceptance criteria pass.
- [ ] Unit tests added/updated for `AudioPanel` and `SettingsDialogContent`.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npx jest --selectProjects unit --testPathPatterns "audio|tts|pronunciation"` passes.
- [ ] `npm run build` passes.
- [ ] Mockup `ConceptH` matches production UI within design tolerance.
- [ ] No double-card nesting in Audio panel.
- [ ] Accessibility: pipeline steps are focusable buttons with `aria-label`.
- [ ] UI uses design tokens, no hardcoded values.

---

## Open Questions

1. Should the new `AudioPanel` live in `src/features/audio/ui/` or `src/features/settings/ui/`?
2. Do we keep the old `PronunciationSettingsPanel`, `LocalPronunciationSettingsPanel`, and `TtsVoiceManagerPanel` files for reuse inside detail panes, or inline their logic?
3. Should the i18n string migration happen in this PR or a follow-up?
4. Do we need a settings migration if sidebar `id` changes from `pronunciation`/`localPronunciation`/`tts` to `audio`?
