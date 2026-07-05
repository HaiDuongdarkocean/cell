import { useState, useCallback, type ReactElement } from 'react';
import { ResourcesPanel } from '@/features/dictionary/ui/ResourcesPanel';
import { ThemePanel } from '@/features/theme/ui/ThemePanel';
import styles from './OptionsApp.module.css';

type Tab = 'resources' | 'theme' | 'settings';

interface TabButtonProps {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly children: string;
}

function TabButton({ active, onClick, children }: TabButtonProps): ReactElement {
  return (
    <button
      type="button"
      className={`${styles.tabButton} ${active ? styles.tabButtonActive : ''}`}
      onClick={onClick}
      aria-selected={active}
      role="tab"
    >
      {children}
    </button>
  );
}

export function OptionsApp(): ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>('resources');

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
  }, []);

  return (
    <div className={styles.container} data-testid="options-app">
      <header className={styles.header}>
        <h1 className={styles.title}>Cell — Tùy chọn</h1>
        <nav className={styles.tabs} role="tablist">
          <TabButton active={activeTab === 'resources'} onClick={() => handleTabChange('resources')}>
            Tài nguyên
          </TabButton>
          <TabButton active={activeTab === 'theme'} onClick={() => handleTabChange('theme')}>
            Giao diện
          </TabButton>
          <TabButton active={activeTab === 'settings'} onClick={() => handleTabChange('settings')}>
            Cài đặt
          </TabButton>
        </nav>
      </header>
      <main className={styles.content} role="tabpanel">
        {activeTab === 'resources' && <ResourcesPanel langCode="en" />}
        {activeTab === 'theme' && <ThemePanel />}
        {activeTab === 'settings' && <SettingsPlaceholder />}
      </main>
    </div>
  );
}

function SettingsPlaceholder(): ReactElement {
  return (
    <div className={styles.placeholder}>
      <p>Cài đặt — chuyển từ SettingsDialog sang đây (M11 ponytail).</p>
    </div>
  );
}
