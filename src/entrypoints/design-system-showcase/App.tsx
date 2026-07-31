import { useState, useEffect } from 'react';
import { Icon } from '@/shared/icons/Icon';
import { ShowcaseGallery } from './ShowcaseGallery';
import { installMockDictionarySendMessage } from './mockDictionary';
import styles from './App.module.css';

installMockDictionarySendMessage();

type ShowcaseMode = 'light' | 'dark';

function ThemeToggle({ mode, onToggle }: { mode: ShowcaseMode; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={styles.themeToggle}
      onClick={onToggle}
      aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}
    >
      <Icon name={mode === 'light' ? 'moon' : 'sun'} size={18} />
      <span>{mode === 'light' ? 'Dark' : 'Light'}</span>
    </button>
  );
}

export function App() {
  const [mode, setMode] = useState<ShowcaseMode>('light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const toggleMode = () => setMode((m) => (m === 'light' ? 'dark' : 'light'));

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Design System Library</h1>
          <p className={styles.subtitle}>Foundations → Atoms</p>
        </div>
        <ThemeToggle mode={mode} onToggle={toggleMode} />
      </header>

      <main className={styles.main}>
        <ShowcaseGallery />
      </main>
    </div>
  );
}
