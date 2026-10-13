/** Deterministic fixtures for the shortcuts redesign mockup. */

import type { KeyboardShortcut, ShortcutAction } from '@/entities/settings/types';
import type { MessageKey } from '@/shared/i18n';

/** Same action → label-key map as SettingsDialogContent.SHORTCUT_ACTION_LABELS. */
export const ACTION_LABEL_KEYS: Record<ShortcutAction, MessageKey> = {
  'prev-cue': 'settings.shortcuts.action.prevCue',
  'next-cue': 'settings.shortcuts.action.nextCue',
  'replay-cue': 'settings.shortcuts.action.replayCue',
  'play-pause': 'settings.shortcuts.action.playPause',
  'toggle-overlay': 'settings.shortcuts.action.toggleOverlay',
  'toggle-panel': 'settings.shortcuts.action.togglePanel',
  'toggle-translate': 'settings.shortcuts.action.toggleTranslate',
  'generate-native': 'settings.shortcuts.action.generateNative',
  'toggle-player-mode': 'settings.shortcuts.action.togglePlayerMode',
  'quick-update': 'settings.shortcuts.action.quickUpdate',
  'edit-card': 'settings.shortcuts.action.editCard',
  'next-vocab-token': 'settings.shortcuts.action.nextVocabToken',
  'prev-vocab-token': 'settings.shortcuts.action.prevVocabToken',
  'toggle-universal-panel': 'settings.shortcuts.action.toggleUniversalPanel',
  'open-dictionary-search': 'settings.shortcuts.action.openDictionarySearch',
};

export interface ShortcutGroupFixture {
  readonly labelKey: MessageKey;
  readonly actions: readonly ShortcutAction[];
}

/** Same 5 groups / 15 actions / order as SettingsDialogContent.SHORTCUT_GROUPS. */
export const GROUPS: readonly ShortcutGroupFixture[] = [
  {
    labelKey: 'settings.shortcuts.group.navigation',
    actions: ['prev-cue', 'next-cue', 'replay-cue', 'play-pause', 'prev-vocab-token', 'next-vocab-token'],
  },
  {
    labelKey: 'settings.shortcuts.group.toggle',
    actions: ['toggle-overlay', 'toggle-panel', 'toggle-translate', 'toggle-player-mode', 'toggle-universal-panel'],
  },
  { labelKey: 'settings.shortcuts.group.generate', actions: ['generate-native'] },
  { labelKey: 'settings.shortcuts.group.dictionary', actions: ['open-dictionary-search'] },
  { labelKey: 'settings.shortcuts.group.cardCreator', actions: ['quick-update', 'edit-card'] },
];

/**
 * Demo bindings. `toggle-translate` is rebound to Shift+T — the same combo
 * `open-dictionary-search` owns — so the pair demonstrates the conflict state
 * (aria-invalid on both pills + conflict dot).
 */
export const BINDINGS: readonly KeyboardShortcut[] = [
  { action: 'prev-cue', key: 'a' },
  { action: 'next-cue', key: 'd' },
  { action: 'replay-cue', key: 's' },
  { action: 'play-pause', key: 'space' },
  { action: 'prev-vocab-token', key: 'z' },
  { action: 'next-vocab-token', key: 'x' },
  { action: 'toggle-overlay', key: 'w' },
  { action: 'toggle-panel', key: 't', ctrl: true, shift: true },
  { action: 'toggle-translate', key: 't', shift: true },
  { action: 'toggle-player-mode', key: 'g' },
  { action: 'toggle-universal-panel', key: 'u', ctrl: true },
  { action: 'generate-native', key: 'h' },
  { action: 'open-dictionary-search', key: 't', shift: true },
  { action: 'quick-update', key: 'q' },
  { action: 'edit-card', key: 'e' },
];
