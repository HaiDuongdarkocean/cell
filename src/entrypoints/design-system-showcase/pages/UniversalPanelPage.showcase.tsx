import { useState, type ReactElement } from 'react';
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

export function Showcase(): ReactElement {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<UniversalPanelTab>('dictionary');
  const [tokenizeState, setTokenizeState] = useState<TokenizePanelState>(INITIAL_TOKENIZE);

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
          dictionaryPanel={
            <DictionaryTab
              langCode="en"
              sourceLang="en"
              targetLang="vi"
              isOpen={isOpen}
              initialTerm="serendipity"
            />
          }
          settingsPanel={<SettingsTab />}
        />
      </div>
    </div>
  );
}

export const showcaseMeta = {
  title: 'Universal Panel Page',
  description: 'Slide-in side panel with Dictionary tab (DictionaryPanelView + integrated CardCreatorPanel) and Settings tab (12-section SettingsDialogContent). Header has tokenize toggles (Status/Frequency/Tokenize). Desktop: vertical tab bar left. Mobile: full-screen with bottom tabs.',
  level: 'pages' as const,
  category: 'Side Panel',
  order: 30,
};
