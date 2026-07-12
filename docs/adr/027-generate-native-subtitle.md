# ADR-027: Generate Native Subtitle (button + shortcut)

## Status
Accepted

## Context
ADR-021 adds automatic target→native translation via `BackgroundPrefillController` when the user enables `subtitleOverlayAutoTranslate` and no native track is found. Users also want a manual trigger to translate the currently active target subtitle into their native language on demand, independent of the auto-translate setting.

## Decision
Add a manual "Generate native subtitle" action, reachable by both a button in the subtitle block and a keyboard shortcut (`g` default).

- The action reuses `BackgroundPrefillController` and the existing Google Translate unofficial endpoint (ADR-021).
- The target language (`sl`) is the active subtitle language / `subtitleOverlayTargetLanguage` setting.
- The output language (`tl`) is `subtitleOverlayNativeLanguage`.
- The translated result is kept in an in-memory **virtual replacement slot** (`TranslatedNativeSlot`) in `contentScriptController.ts` for the current video session only.
- The slot is shown as a `source: 'translated'` item in the Subtitle Manager Panel with a `TRANSLATED` badge.
- The virtual slot is cleared on target change, import, or SPA navigation, but it does **not** toggle or change the auto-translate state.
- The `BackgroundPrefillController` options get an optional `onComplete` callback so the UI can re-enable the button and show a success toast.

## Consequences
- Users can manually generate native subtitles without enabling the auto-translate setting.
- Reusing the existing prefill pipeline avoids duplication and keeps rate-limit/backoff behavior consistent.
- The virtual slot means no settings or persistent storage is modified; the generated subtitle is scoped to one video session.
- A new `generate-native` `ShortcutAction` is added to `entities/settings/types.ts` and default shortcuts.
- Settings schema is bumped to v12 so legacy users without the shortcut get it migrated in.

## Related
- Spec: `docs/specs/spec-generate-native-subtitle.md`
- ADR-021: `docs/adr/021-translate-subtitle-background-prefill.md`
