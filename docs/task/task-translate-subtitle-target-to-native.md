# Task: Translate Subtitle Target → Native (G4 Implementation)

> Phase G4 — Task breakdown. Input: spec + plan + ADR-021.
> TDD: write test first, then implement. Atomic commit per task group.

## Tasks (ordered by dependency)

### T1: Settings + message types (M1)
- Add `subtitleOverlayAutoTranslate: boolean` to Settings (default true)
- Add `'toggle-translate'` to ShortcutAction
- Extend KeyboardShortcut: optional `ctrl?, shift?, alt?` (combo support, backward compat)
- Add `'TRANSLATE'` to MessageType + MESSAGE_TYPES
- Add `TranslatePayload { text, sl, tl }` + `TranslateResult { translated: string[] }`
- Verify: `npx tsc --noEmit`

### T2: translateService (M2)
- `src/features/translate/service/translateService.ts` — `parseGoogleResponse(response): string[]` pure
- `translateService.test.ts` — mock response (valid, empty, malformed)
- Verify: `npm run test:unit -- --testPathPatterns=translateService`

### T3: translateChunker (M3)
- `src/features/translate/logic/translateChunker.ts` — `chunkCuesByCharBudget(cues, indices, budget): number[][]` pure
- `translateChunker.test.ts` — edge cases (empty, single > budget, exact budget)
- Verify: `npm run test:unit -- --testPathPatterns=translateChunker`

### T4: translatePrefill controller (M3)
- `src/features/translate/logic/translatePrefill.ts` — `BackgroundPrefillController` (queue + cache + guards + backoff)
- `translatePrefill.test.ts` — mock fetch, test sequential, cache hit/miss, guards (play, hidden, SPA nav), backoff
- Verify: `npm run test:unit -- --testPathPatterns=translatePrefill`

### T5: Background TRANSLATE handler (M2)
- `src/entrypoints/background/handlers/translate.ts` — `registerTranslateHandlers(ctx)` fetch Google
- Register in `background/index.ts`
- Verify: `npx tsc --noEmit`

### T6: subtitleService + subtitleAutoLoad trigger (M4)
- `subtitleService.ts` — `findSubtitlesForOverlay` already returns `{ target, native }`, native=null = trigger
- `subtitleAutoLoad.ts` — when native=null + autoTranslate ON → start prefill, feed `loadBilingualCues(targetCues, translatedCues)`
- Verify: `npm run test:unit`

### T7: ShortcutInput combo (M5)
- `ShortcutInput.tsx` — capture keydown combo, store `{ctrl, shift, alt, key}`, render pill with kbd chips
- All shortcut input same width (pill radius-full, min-width)
- Backward compat 5 old shortcuts
- `ShortcutInput.test.tsx` — combo capture, single-char backward compat
- Verify: `npm run test:unit -- --testPathPatterns=ShortcutInput`

### T8: SettingsDialog UI (M5)
- Add toggle "Auto-translate when native missing" in Subtitle Overlay section
- Add "Toggle auto-translate" shortcut row in Keyboard tab (combo pill)
- Verify: `npx tsc --noEmit` + browser screenshot vs mockup v6

### T9: Integration + browser verify (M6)
- `npm run test:unit` + `npx tsc --noEmit` + `npm run lint`
- Edge MCP: real YouTube en→vi, seek instant, SPA nav clear, tab hidden, shortcut toggle
- C1-C9 acceptance criteria

### T10: Docs update + commit
- Update `docs/2-architechture-system.md` (3 chỗ: tree, dependency table, function index)
- Atomic commits per task group
