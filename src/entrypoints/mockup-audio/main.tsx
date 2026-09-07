import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/shared/ui';
import { ConceptG } from './ConceptG';
import { ConceptH } from './ConceptH';
import { RealPanel } from './real';
import { useMockAudio } from './state';
import '@/shared/styles/document.css';
import styles from './mockup.module.css';

// Mockup page has no chrome.storage or ThemeProvider — set attributes directly.
document.documentElement.setAttribute('data-preset', 'dawn');
document.documentElement.setAttribute('data-theme', 'light');

type ConceptId = 'real' | 'g' | 'h';
type Viewport = 'mobile' | 'desktop';

const CONCEPTS: { id: ConceptId; label: string }[] = [
  { id: 'real', label: 'Real panel' },
  { id: 'g', label: 'G · Smart mode' },
  { id: 'h', label: 'H · Pipeline' },
];

const NOTES: Record<ConceptId, React.ReactNode> = {
  real: (
    <>
      <strong>Production</strong> — the shipped <strong>Audio</strong> card
      (<code>AudioPanel</code>), built on the Concept H pipeline direction. It merges the old{' '}
      <strong>Pronunciation</strong>, <strong>Local Pronunciation</strong> and{' '}
      <strong>TTS Voices</strong> cards into one section.
    </>
  ),
  g: (
    <>
      <strong>Smart Output Mode</strong> — alternative direction, kept for reference (not chosen).
      The user picks a goal (Auto/Natural/Fast/Offline/Min data) and the system maps it to a hidden
      priority chain. Magic chips surface the next required action. Advanced controls are tucked
      behind one accordion.
    </>
  ),
  h: (
    <>
      <strong>Audio Pipeline</strong> — <em>chosen direction, now in production.</em> The priority
      chain is visualized as a horizontal pipeline. Tap any source to tune it. A bit more UI, but
      makes the fallback order transparent.
    </>
  ),
};

function App(): React.ReactElement {
  const [concept, setConcept] = useState<ConceptId>('real');
  const [viewport, setViewport] = useState<Viewport>('mobile');
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    new URLSearchParams(location.search).get('mode') === 'dark' ? 'dark' : 'light',
  );
  const controls = useMockAudio();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ErrorBoundary>
      <div className={styles.maPage}>
        <header className={styles.maHeader}>
          <h1 className={styles.maTitle}>Audio — redesign</h1>
          <p className={styles.maSubtitle}>
            Compare the production Audio card with the explored directions for merging
            Pronunciation, Local Pronunciation, and TTS Voices into one Audio section.
            Concept H shipped; Concept G is kept as an alternative.
          </p>
          <div className={styles.maControls}>
            <div className={styles.maSeg} role="group" aria-label="Concept">
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
            <div className={styles.maSeg} role="group" aria-label="Viewport">
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
            <div className={styles.maSeg} role="group" aria-label="Theme">
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

        <p className={styles.maConceptNote}>{NOTES[concept]}</p>

        <main className={styles.maStage} data-viewport={viewport}>
          {concept === 'real' && <RealPanel />}
          {concept === 'g' && <ConceptG controls={controls} />}
          {concept === 'h' && <ConceptH controls={controls} />}
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
