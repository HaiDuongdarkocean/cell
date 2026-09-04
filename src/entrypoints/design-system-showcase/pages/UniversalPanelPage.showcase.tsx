import { useState, useMemo, type ReactElement } from 'react';
import { UniversalPanel } from '@/features/universalPanel/UniversalPanel';
import { DictionaryTab } from '@/features/universalPanel/tabs/DictionaryTab';
import { SettingsTab } from '@/features/universalPanel/tabs/SettingsTab';
import type { UniversalPanelTab } from '@/features/universalPanel/types';
import type { TokenizePanelState } from '@/features/tokenize/types';
import { installMockDictionarySendMessage } from '../mockDictionary';
import styles from './UniversalPanelPage.module.css';

// Install mock sendMessage so DictionaryPanelView can fetch mock data
installMockDictionarySendMessage();

const INITIAL_TOKENIZE: TokenizePanelState = {
  enabled: true,
  showStatus: true,
  showFrequency: false,
  subtitleEnabled: false,
};

const LANGUAGE_PROFILES = [
  { id: 'vi-en', name: 'vietnamese → english', target: 'vi' },
  { id: 'en-vi', name: 'english → vietnamese', target: 'en' },
  { id: 'ja-en', name: 'japanese → english', target: 'ja' },
];

const VALID_TABS: UniversalPanelTab[] = ['dictionary', 'studyModes', 'settings'];

function readShowcaseParams(): { isOpen: boolean; tab: UniversalPanelTab } {
  const params = new URLSearchParams(window.location.search);
  const openParam = params.get('open');
  const tabParam = params.get('tab');
  return {
    isOpen: openParam !== 'false',
    tab: VALID_TABS.includes(tabParam as UniversalPanelTab) ? (tabParam as UniversalPanelTab) : 'dictionary',
  };
}

export function Showcase(): ReactElement {
  const initial = useMemo(() => readShowcaseParams(), []);
  const [isOpen, setIsOpen] = useState(initial.isOpen);
  const [activeTab, setActiveTab] = useState<UniversalPanelTab>(initial.tab);
  const [tokenizeState, setTokenizeState] = useState<TokenizePanelState>(INITIAL_TOKENIZE);
  const [hasMedia, setHasMedia] = useState(true);
  const [activeProfileId, setActiveProfileId] = useState('vi-en');

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
      <div className={styles.pageFrame}>
        <div className={styles.pagePlaceholder}>
          <span>Web Page Content (behind panel)</span>
        </div>
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
          studyModesPanel={<div data-cell-id="study-modes-panel">Study Modes</div>}
          settingsPanel={<SettingsTab />}
        />
      </div>
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
