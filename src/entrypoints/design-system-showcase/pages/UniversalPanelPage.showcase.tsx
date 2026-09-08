import { useState, useMemo, type ReactElement } from 'react';
import { UniversalPanel } from '@/features/universalPanel/UniversalPanel';
import { DictionaryTab } from '@/features/universalPanel/tabs/DictionaryTab';
import { SettingsTab } from '@/features/universalPanel/tabs/SettingsTab';
import { StudyModesTab } from '@/features/studyModes/ui/StudyModesTab';
import type { UniversalPanelTab } from '@/features/universalPanel/types';
import type { TokenizePanelState } from '@/features/tokenize/types';
import type { PresetName } from '@/entities/theme';
import { ViewportFrame, type ViewportWidth } from '../ViewportFrame';
import { SHOWCASE_VIEWPORT, getViewportHeight } from '../showcaseParams';
import { installMockDictionarySendMessage } from '../mockDictionary';
import { getMockUniversalPanelProfiles } from '../showcaseFixtures';
import styles from './UniversalPanelPage.module.css';

// Install mock sendMessage so DictionaryPanelView can fetch mock data
installMockDictionarySendMessage();

const INITIAL_TOKENIZE: TokenizePanelState = {
  enabled: true,
  showStatus: true,
  showFrequency: false,
  subtitleEnabled: false,
};

const LANGUAGE_PROFILES = getMockUniversalPanelProfiles();

const VALID_TABS: UniversalPanelTab[] = ['dictionary', 'studyModes', 'settings'];
const VALID_PRESETS: PresetName[] = ['dawn', 'forest', 'ocean', 'warmth'];

function readShowcaseParams(): { isOpen: boolean; tab: UniversalPanelTab; mode: 'light' | 'dark'; preset: PresetName; viewport: ViewportWidth; viewportHeight: number | undefined } {
  const params = new URLSearchParams(window.location.search);
  const openParam = params.get('open');
  const tabParam = params.get('tab');
  const modeParam = params.get('mode');
  const presetParam = params.get('preset') as PresetName | null;
  return {
    isOpen: openParam !== 'false',
    tab: VALID_TABS.includes(tabParam as UniversalPanelTab) ? (tabParam as UniversalPanelTab) : 'dictionary',
    mode: modeParam === 'dark' ? 'dark' : 'light',
    preset: presetParam && VALID_PRESETS.includes(presetParam) ? presetParam : 'dawn',
    viewport: SHOWCASE_VIEWPORT,
    viewportHeight: getViewportHeight(SHOWCASE_VIEWPORT),
  };
}

export function Showcase(): ReactElement {
  const initial = useMemo(() => readShowcaseParams(), []);
  const [isOpen, setIsOpen] = useState(initial.isOpen);
  const [activeTab, setActiveTab] = useState<UniversalPanelTab>(initial.tab);
  const [tokenizeState, setTokenizeState] = useState<TokenizePanelState>(INITIAL_TOKENIZE);
  const [hasMedia, setHasMedia] = useState(true);
  const [activeProfileId, setActiveProfileId] = useState(LANGUAGE_PROFILES[0]?.id ?? '');

  const handleToggleTokenize = (key: 'enabled' | 'showStatus' | 'showFrequency' | 'subtitleEnabled'): void => {
    setTokenizeState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.controls}>
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className={styles.toggleBtn}
        >
          {isOpen ? 'Close Panel' : 'Open Panel'}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab((t) => (t === 'dictionary' ? 'settings' : 'dictionary'))}
          className={styles.toggleBtn}
        >
          Switch to {activeTab === 'dictionary' ? 'Settings' : 'Dictionary'}
        </button>
        <button
          type="button"
          onClick={() => setHasMedia((v) => !v)}
          className={styles.toggleBtn}
        >
          {hasMedia ? 'Simulate no video' : 'Simulate video present'}
        </button>
      </div>
      <ViewportFrame
        width={initial.viewport}
        height={initial.viewportHeight}
        theme={initial.mode}
      >
        <div className={styles.pageFrame}>
          <div className={styles.pagePlaceholder}>
            <span>Web Page Content (behind panel)</span>
          </div>
          {/* Theme boundary — mirrors the shadow-root container that
              ShadowThemeProvider themes in the real extension. `?mode=`/`?preset=`
              scope the panel subtree without touching document.documentElement. */}
          <div className={styles.themeBoundary} data-theme={initial.mode} data-preset={initial.preset}>
            <UniversalPanel
              isOpen={isOpen}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onClose={() => setIsOpen(false)}
              tokenizeState={tokenizeState}
              onToggleTokenize={handleToggleTokenize}
              hasMedia={hasMedia}
              languageProfiles={LANGUAGE_PROFILES}
              activeProfileId={activeProfileId}
              onProfileChange={setActiveProfileId}
              dictionaryPanel={
                <DictionaryTab
                  langCode="en"
                  sourceLang="en"
                  targetLang="vi"
                  isOpen={isOpen}
                  initialTerm="serendipity"
                />
              }
              studyModesPanel={<StudyModesTab />}
              settingsPanel={<SettingsTab />}
            />
          </div>
        </div>
      </ViewportFrame>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Universal Panel Page',
  description: 'Slide-in side panel with Dictionary, Study and Settings tabs. Desktop: L-shape collapsible sidebar on the left, surface-elevated header, stretchable tokenize pill. Mobile: bottom nav bar with a tools sheet. Media half disables when no video is present.',
  level: 'pages' as const,
  category: 'Side Panel',
  order: 30,
};
