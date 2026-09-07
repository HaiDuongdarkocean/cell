import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/shared/ui';
import { RealPanel } from './real';
import { ConceptA } from './ConceptA';
import { ConceptB } from './ConceptB';
import { ConceptC } from './ConceptC';
import {
  DEFAULT_DOWNLOAD_SETTINGS,
  applyValue,
  type DownloadSettings,
  type SettingKey,
} from './mockData';
import '@/shared/styles/document.css';
import styles from './mockup.module.css';

document.documentElement.setAttribute('data-preset', 'dawn');
document.documentElement.setAttribute('data-theme', 'light');

type ConceptId = 'real' | 'a' | 'b' | 'c';
type Viewport = 'mobile' | 'desktop';

const CONCEPTS: { id: ConceptId; label: string }[] = [
  { id: 'real', label: 'Real panel' },
  { id: 'a', label: 'A · Proximity Groups' },
  { id: 'b', label: 'B · Nature Tiles' },
  { id: 'c', label: 'C · Accordion' },
];

const NOTES: Record<ConceptId, React.ReactNode> = {
  real: (
    <>
      Production <strong>Download</strong> card — grouped rows with the label on
      the left and the select on the right (stacked for the Format &amp;
      Quality pair). Live for comparison.
    </>
  ),
  a: (
    <>
      <strong>Proximity Groups</strong> — the same grouped layout, but each
      section is defined only by whitespace and a small uppercase title. No
      cards, no borders, no glass. Labels sit above the selects; Format &amp;
      Quality goes 2-column on desktop. Plain, calm, and the simplest to ship.
    </>
  ),
  b: (
    <>
      <strong>Nature Dashboard Tiles</strong> — every setting is a glass tile
      tinted with a nature accent (sky, leaf, sun, stone) carrying an icon, the
      current value, and the select. More visual density, still quiet.
    </>
  ),
  c: (
    <>
      <strong>Progressive Accordion</strong> — groups are collapsed by default;
      a sticky summary bar keeps the current choices visible. The advanced
      Workers field stays hidden inside Conversion until Manual is picked.
    </>
  ),
};

function App(): React.ReactElement {
  const [concept, setConcept] = useState<ConceptId>('real');
  const [viewport, setViewport] = useState<Viewport>('mobile');
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    new URLSearchParams(location.search).get('mode') === 'dark' ? 'dark' : 'light',
  );
  const [settings, setSettings] = useState<DownloadSettings>(DEFAULT_DOWNLOAD_SETTINGS);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleChange = (key: SettingKey, raw: string): void => {
    setSettings((prev) => applyValue(prev, key, raw));
  };

  return (
    <ErrorBoundary>
      <div className={styles.mksPage}>
        <header className={styles.mksHeader}>
          <h1 className={styles.mksTitle}>Download Settings — redesign</h1>
          <p className={styles.mksSubtitle}>
            Compare the shipped Download card with three directions. Every
            select is live — changes update the shared state across concepts.
          </p>
          <div className={styles.mksControls}>
            <div className={styles.mksSeg} role="group" aria-label="Concept">
              {CONCEPTS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={concept === c.id}
                  onClick={() => setConcept(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className={styles.mksSeg} role="group" aria-label="Viewport">
              <button
                type="button"
                aria-pressed={viewport === 'mobile'}
                onClick={() => setViewport('mobile')}
              >
                Mobile
              </button>
              <button
                type="button"
                aria-pressed={viewport === 'desktop'}
                onClick={() => setViewport('desktop')}
              >
                Desktop
              </button>
            </div>
            <div className={styles.mksSeg} role="group" aria-label="Theme">
              <button
                type="button"
                aria-pressed={theme === 'light'}
                onClick={() => setTheme('light')}
              >
                Light
              </button>
              <button
                type="button"
                aria-pressed={theme === 'dark'}
                onClick={() => setTheme('dark')}
              >
                Dark
              </button>
            </div>
          </div>
        </header>

        <p className={styles.mksConceptNote}>{NOTES[concept]}</p>

        <main className={styles.mksStage} data-viewport={viewport}>
          {concept === 'real' && <RealPanel settings={settings} onChange={handleChange} />}
          {concept === 'a' && <ConceptA settings={settings} onChange={handleChange} />}
          {concept === 'b' && <ConceptB settings={settings} onChange={handleChange} />}
          {concept === 'c' && <ConceptC settings={settings} onChange={handleChange} />}
        </main>
      </div>
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
