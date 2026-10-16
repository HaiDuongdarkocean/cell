# Delivery plan — ai-bridge-dictionary

Spec: `docs/specs/ai-bridge-dictionary.md` · Design: `docs/intent/ai-bridge-dictionary-design-brief.md` · Mode: `all`

## Lanes

### Lane 1 — provider bridge core (worktree `ai-bridge-dictionary-lane-1`, branch `poc/ai-bridge-lane-1`)
Owns: `src/features/aiBridge/**`, `src/entrypoints/content/**`, `src/entrypoints/background/handlers/aiBridge.ts`, `src/entities/message/**`, `src/entrypoints/ai-lab/**`, `public/manifest.json`.

- Genericize `chatgptDom.ts` into a config-driven module + `providers.ts` SSOT (4 providers).
- Generic content script for all 4 origins; manifest matches for gemini/deepseek/claude.
- BG handler: provider param, per-attempt ≤90s timeout, failover walk over providerOrder, typed failure classes.
- `AI_ASK` payload: `{ prompt, provider? }`; response `{ success, text?, provider?, error? }`.
- ai-lab: provider dropdown + ask test stays working.
- Unit tests for adapter config + generic observer + failover chain logic.

### Lane 2 — AI settings slice (worktree `ai-bridge-dictionary-lane-2`, branch `poc/ai-bridge-lane-2`)
Owns: `src/entities/settings/types.ts`, `src/shared/config/config.ts` (DEFAULT_AI_BRIDGE_SETTINGS + DEFAULT_SETTINGS entry), `src/features/aiBridge/prompts*.ts`, `src/features/sync/domain/settingsRegistry.ts`, related tests.

- `AiBridgeSettings` slice: `defaultProvider`, `providerOrder`, `prompts{wordExplain,sentenceBreakdown,sentenceTranslate}{system,user}`, `sentenceTranslateEngine`, `autoOpenOnMiss`.
- `prompts.ts`: DEFAULT_PROMPTS (user-approved copies), `fillPrompt`, `validatePromptPlaceholders` (omittable, not renamable).
- Sync: add `['aiBridge']` to `syncedPaths`.
- Tests: validation, fill, defaults merge.

### Lane 3 — popup + settings UI + notes + i18n (main worktree, orchestrator)
Owns: `src/features/dictionaryPopup/**`, `src/features/settings/**`, `src/shared/i18n/**`, `src/features/dictionaryPopup/controller/cardCreatorBridge.ts`, `src/entities/message/types.ts` PopupTab union.

Depends on lanes 1+2 contracts. Sequential after merges.

## Merge order

1. lane-1 → verify → merge → `typecheck && test:unit && build`
2. lane-2 → verify → merge → same gates
3. lane-3 implementation in main worktree
4. Fresh-context verify all ACs → review → ADR → ship prep
