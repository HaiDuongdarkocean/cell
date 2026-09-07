import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/shared/ui';
import { ConceptA } from './ConceptA';
import { ConceptB } from './ConceptB';
import { ConceptC } from './ConceptC';
import { ConceptC2 } from './ConceptC2';
import { ConceptC3 } from './ConceptC3';
import { ConceptD } from './ConceptD';
import { OrbitalCard } from './OrbitalCard';
import { RealPanel } from './real';
import { useMockDictionaryPopup } from './state';
import '@/shared/styles/document.css';
import styles from './mockup.module.css';

// Mockup page has no chrome.storage or ThemeProvider — set attributes directly.
document.documentElement.setAttribute('data-preset', 'dawn');
document.documentElement.setAttribute('data-theme', 'light');

type ConceptId = 'real' | 'a' | 'b' | 'c1' | 'c2' | 'c3' | 'd';
type Viewport = 'mobile' | 'desktop';

const CONCEPTS: { id: ConceptId; label: string }[] = [
  { id: 'real', label: 'Real panel' },
  { id: 'a', label: 'A · 3 rows' },
  { id: 'b', label: 'B · Mode dial' },
  { id: 'c1', label: 'C1 · Timeline minimal' },
  { id: 'c2', label: 'C2 · Timeline connected' },
  { id: 'c3', label: 'C3 · Step cards' },
  { id: 'd', label: 'D · 1-tap presets' },
];

const NOTES: Record<ConceptId, React.ReactNode> = {
  real: (
    <>
      Production <strong>Dictionary Popup</strong> panel with all current controls. This is the shipped baseline.
    </>
  ),
  a: (
    <>
      <strong>Three clean rows</strong> — Open with, Show first, Save words to. The minimal expression of the new IA.
    </>
  ),
  b: (
    <>
      <strong>Mode dial</strong> — trigger mode is a segmented row of pills. Default tab and SRS sit below as follow-ups.
    </>
  ),
  c1: (
    <>
      <strong>Timeline minimal</strong> — 1. Open a word, 2. Show first, 3. Save words to. Clean numbered rows with no connecting line.
    </>
  ),
  c2: (
    <>
      <strong>Timeline connected</strong> — the same 3 steps, but a vertical line links the dots so the journey feels continuous.
    </>
  ),
  c3: (
    <>
      <strong>Step cards</strong> — each step becomes its own card, giving more visual separation and a slightly more guided feel.
    </>
  ),
  d: (
    <>
      <strong>Smart presets</strong> — one tap picks a learning scenario and sets all three fields. Manual tuning still available.
    </>
  ),
};

function App(): React.ReactElement {
  const [concept, setConcept] = useState<ConceptId>('real');
  const [viewport, setViewport] = useState<Viewport>('mobile');
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    new URLSearchParams(location.search).get('mode') === 'dark' ? 'dark' : 'light',
  );
  const { state, update, applyPreset } = useMockDictionaryPopup();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ErrorBoundary>
      <div className={styles.maPage}>
        <header className={styles.maHeader}>
          <h1 className={styles.maTitle}>Dictionary Popup — redesign</h1>
          <p className={styles.maSubtitle}>
            Reduce Dictionary Popup to three decisions, move sizing to a separate Word badge card,
            and let users configure everything in one tap with presets.
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
          <div className={styles.maStageCol}>
            {concept === 'real' && <RealPanel settings={state.settings} onChange={(next) => update(next)} />}
            {concept === 'a' && <ConceptA settings={state.settings} update={update} />}
            {concept === 'b' && <ConceptB settings={state.settings} update={update} />}
            {concept === 'c1' && <ConceptC settings={state.settings} update={update} />}
            {concept === 'c2' && <ConceptC2 settings={state.settings} update={update} />}
            {concept === 'c3' && <ConceptC3 settings={state.settings} update={update} />}
            {concept === 'd' && <ConceptD settings={state.settings} update={update} applyPreset={applyPreset} />}
          </div>

          <aside className={styles.maStageCol}>
            <OrbitalCard
              badgePointerTrigger={state.settings.badgePointerTrigger}
              onChange={(next) => update({ badgePointerTrigger: next })}
            />
          </aside>
        </main>
      </div>
    </ErrorBoundary>
  );
}

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
