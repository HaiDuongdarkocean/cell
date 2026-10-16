import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/shared/ui';
import { ManagerPanelMock } from './ManagerPanelMock';
import type { AutoChain, Locale, Scenario } from './mockData';
import '@/shared/styles/document.css';
import styles from './mockup.module.css';

type Viewport = 'desktop' | 'mobile';
type Theme = 'dark' | 'light';

const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: 'default', label: 'Tracks · few' },
  { id: 'empty', label: 'Tracks · 0 (empty)' },
  { id: 'many', label: 'Tracks · many (scroll)' },
];

const AUTO_CHAINS: { id: AutoChain; label: string }[] = [
  { id: 'on', label: 'Auto-load · on' },
  { id: 'off', label: 'Auto-load · off (chain)' },
  { id: 'chain', label: 'Auto-load · ASR off' },
];

function Seg<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}): React.ReactElement {
  return (
    <div className={styles.seg} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function App(): React.ReactElement {
  const params = new URLSearchParams(location.search);
  const [scenario, setScenario] = useState<Scenario>((params.get('scenario') as Scenario) || 'default');
  const [autoChain, setAutoChain] = useState<AutoChain>((params.get('auto') as AutoChain) || 'on');
  const [viewport, setViewport] = useState<Viewport>((params.get('viewport') as Viewport) || 'desktop');
  const [theme, setTheme] = useState<Theme>((params.get('mode') as Theme) || 'dark');
  const [locale, setLocale] = useState<Locale>((params.get('lang') as Locale) || 'en');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ErrorBoundary>
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Subtitle Manager — redesign</h1>
          <p className={styles.pageSubtitle}>
            Travel-kit grammar on dark glass: track cards, pill segmented cue display, Generate as
            primary CTA, 4-slot footer, Auto-load card moved in from Settings. Panel hugs content —
            no dead space.
          </p>
          <div className={styles.controls}>
            <Seg label="Scenario" options={SCENARIOS} value={scenario} onChange={setScenario} />
            <Seg label="Auto-load chain" options={AUTO_CHAINS} value={autoChain} onChange={setAutoChain} />
            <Seg
              label="Viewport"
              options={[
                { id: 'desktop', label: 'Desktop 420' },
                { id: 'mobile', label: 'Mobile 360' },
              ]}
              value={viewport}
              onChange={setViewport}
            />
            <Seg
              label="Theme"
              options={[
                { id: 'dark', label: 'Dark' },
                { id: 'light', label: 'Light' },
              ]}
              value={theme}
              onChange={setTheme}
            />
            <Seg
              label="Language"
              options={[
                { id: 'en', label: 'EN' },
                { id: 'vi', label: 'VI' },
              ]}
              value={locale}
              onChange={setLocale}
            />
          </div>
        </header>

        <main className={styles.stage}>
          <div className={styles.frame} data-viewport={viewport}>
            <span className={styles.videoLabel}>video · {viewport === 'desktop' ? '860×680' : '360×640'}</span>
            <ManagerPanelMock
              key={`${scenario}-${autoChain}-${locale}`}
              locale={locale}
              scenario={scenario}
              autoChain={autoChain}
            />
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(<App />);
}
