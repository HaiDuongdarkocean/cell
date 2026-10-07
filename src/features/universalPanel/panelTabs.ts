import type { ICON_CATALOG } from '@/shared/icons';
import type { MessageKey } from '@/shared/i18n';
import type { UniversalPanelTab } from './types';

export interface PanelTabEntry {
  readonly key: UniversalPanelTab;
  readonly icon: keyof typeof ICON_CATALOG;
  readonly label: MessageKey;
  readonly shortLabel: MessageKey;
  /** Mobile (≤839px) placement: 'bar' = bottom rail, 'tools' = navigation
   *  row inside the Tools sheet. Desktop sidebar lists every entry. */
  readonly mobileNav: 'bar' | 'tools';
}

export const PANEL_TABS: readonly PanelTabEntry[] = [
  { key: 'dictionary', icon: 'bookOpen', label: 'panel.tab.dictionary', shortLabel: 'panel.tab.dictionary', mobileNav: 'bar' },
  { key: 'vocabulary', icon: 'scanText', label: 'panel.tab.vocabulary', shortLabel: 'panel.tab.vocabularyShort', mobileNav: 'bar' },
  { key: 'studyModes', icon: 'flame', label: 'panel.tab.studyModes', shortLabel: 'panel.tab.studyModesShort', mobileNav: 'bar' },
  { key: 'playlist', icon: 'audioWave', label: 'panel.tab.playlist', shortLabel: 'panel.tab.playlistShort', mobileNav: 'tools' },
  { key: 'recap', icon: 'clock', label: 'panel.tab.recap', shortLabel: 'panel.tab.recapShort', mobileNav: 'tools' },
  { key: 'settings', icon: 'settings', label: 'panel.tab.settings', shortLabel: 'panel.tab.settings', mobileNav: 'bar' },
];

export const PANEL_BAR_TABS: readonly PanelTabEntry[] = PANEL_TABS.filter((tab) => tab.mobileNav === 'bar');
export const PANEL_TOOLS_TABS: readonly PanelTabEntry[] = PANEL_TABS.filter((tab) => tab.mobileNav === 'tools');
