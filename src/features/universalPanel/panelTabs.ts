import type { ICON_CATALOG } from '@/shared/icons';
import type { MessageKey } from '@/shared/i18n';
import type { UniversalPanelTab } from './types';

export interface PanelTabEntry {
  readonly key: UniversalPanelTab;
  readonly icon: keyof typeof ICON_CATALOG;
  readonly label: MessageKey;
  readonly shortLabel: MessageKey;
}

export const PANEL_TABS: readonly PanelTabEntry[] = [
  { key: 'dictionary', icon: 'bookOpen', label: 'panel.tab.dictionary', shortLabel: 'panel.tab.dictionary' },
  { key: 'vocabulary', icon: 'scanText', label: 'panel.tab.vocabulary', shortLabel: 'panel.tab.vocabularyShort' },
  { key: 'studyModes', icon: 'slidersHorizontal', label: 'panel.tab.studyModes', shortLabel: 'panel.tab.studyModesShort' },
  { key: 'playlist', icon: 'audioWave', label: 'panel.tab.playlist', shortLabel: 'panel.tab.playlistShort' },
  { key: 'recap', icon: 'clock', label: 'panel.tab.recap', shortLabel: 'panel.tab.recapShort' },
  { key: 'settings', icon: 'settings', label: 'panel.tab.settings', shortLabel: 'panel.tab.settings' },
];
