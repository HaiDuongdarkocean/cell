/**
 * Settings feature — settings UI + logic.
 *
 * Layers:
 * - ui/ — SettingsDialog, MultiSelect, SubtitlePreview, SubtitleStylePanel
 *
 * Settings types live in entities/settings/ (Settings, FilenameSource, etc).
 * Settings constants (DEFAULT_SETTINGS, STORAGE_KEYS) live in shared/config/.
 * Settings store stays in entrypoints/popup/store/ (Q2 — not split yet).
 */
export * from './ui';
