import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/shared/ui';
import { buildTokenSpanCss } from '@/features/tokenize/ui/tokenSpanCss';
import { ConceptA } from './ConceptA';
import { ConceptB } from './ConceptB';
import { ConceptC } from './ConceptC';
import { RealPanel } from './real';
import '@/shared/styles/document.css';
import styles from './mockup.module.css';

document.documentElement.setAttribute('data-preset', 'dawn');
document.documentElement.setAttribute('data-theme', 'light');

type ConceptId = 'real' | 'a' | 'b' | 'c';
type Viewport = 'mobile' | 'desktop';

const CONCEPTS: { id: ConceptId; label: string }[] = [
  { id: 'real', label: 'Real cue list' },
  { id: 'a', label: 'A · Tick mark' },
  { id: 'b', label: 'B · Water wash' },
  { id: 'c', label: 'C · Pebble ring' },
];

const NOTES: Record<ConceptId, React.ReactNode> = {
  real: (
    <>
      Production <strong>CueList</strong> as shipped — tokens carry status underlines and
      frequency pills, but ctrl+click has no visible selected state anywhere.
    </>
  ),
  a: (
    <>
      <strong>Tick mark</strong> — a thin accent bar on the token&apos;s top edge, the mirror
      image of the status underline on the bottom edge. A new mark grammar that never fights
      status or frequency.
    </>
  ),
  b: (
    <>
      <strong>Water wash</strong> — a soft primary-subtle fill inside the token, like a
      highlighter pass. The OS text-selection idiom; tints frequency pills without hiding them.
    </>
  ),
  c: (
    <>
      <strong>Pebble ring</strong> — the system&apos;s existing <code>inset-selected</code>{' '}
      outline grammar hugging the token. The classic &quot;selected item&quot; read; status bar
      stays visible inside the ring.
    </>
  ),
};

function App(): React.ReactElement {
  const [concept, setConcept] = useState<ConceptId>('a');
  const [viewport, setViewport] = useState<Viewport>('mobile');
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    new URLSearchParams(location.search).get('mode') === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ErrorBoundary>
      <div className={styles.page}>
        <style>{buildTokenSpanCss()}</style>
        <header className={styles.header}>
          <h1 className={styles.title}>Subtitle bulk status — selected state</h1>
          <p className={styles.subtitle}>
            One new visual: how a token reads as selected when ctrl/cmd+clicked, across every
            status × frequency combination — on the subtitle block and the cue-list panel.
            Ctrl/cmd+click a word to select it, Esc clears.
          </p>
          <div className={styles.controls}>
            <div className={styles.seg} role="group" aria-label="Concept">
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
            <div className={styles.seg} role="group" aria-label="Viewport">
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
            <div className={styles.seg} role="group" aria-label="Theme">
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

        <p className={styles.conceptNote}>{NOTES[concept]}</p>

        <main className={styles.stage} data-viewport={viewport}>
          <div className={styles.stageCol}>
            {concept === 'real' && <RealPanel />}
            {concept === 'a' && <ConceptA />}
            {concept === 'b' && <ConceptB />}
            {concept === 'c' && <ConceptC />}
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
