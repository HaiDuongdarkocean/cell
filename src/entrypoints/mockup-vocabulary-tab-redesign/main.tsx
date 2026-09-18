import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/shared/ui';
import { ConceptA } from './ConceptA';
import { ConceptB } from './ConceptB';
import { ConceptC } from './ConceptC';
import { RealPanel } from './real';
import { useVocabMock } from './state';
import '@/shared/styles/document.css';
import styles from './mockup.module.css';

document.documentElement.setAttribute('data-preset', 'dawn');
document.documentElement.setAttribute('data-theme', 'light');

type ConceptId = 'real' | 'a' | 'b' | 'c';
type Viewport = 'mobile' | 'desktop';

const CONCEPTS: { id: ConceptId; label: string }[] = [
  { id: 'real', label: 'Real tab' },
  { id: 'a', label: 'A · Chapter tabs' },
  { id: 'b', label: 'B · Compact toolbar' },
  { id: 'c', label: 'C · Inbox rail' },
];

const NOTES: Record<ConceptId, React.ReactNode> = {
  real: (
    <>
      Production <strong>Vocabulary tab</strong> as shipped — wrapping filter chips, search +
      sort squeezed in one row, delete always visible, permanent delete only.
    </>
  ),
  a: (
    <>
      <strong>Chapter tabs</strong> — notebook sections as one segmented row
      (All · Tracking · Known · Ignored · Trash). Search owns a full row; sort + Edit sit
      below. Same visual language as the Dictionary toolbar.
    </>
  ),
  b: (
    <>
      <strong>Compact toolbar</strong> — one slim toolbar; filter and sort live in popover
      menus with counts. Maximum vertical space for the list.
    </>
  ),
  c: (
    <>
      <strong>Inbox rail</strong> — a folder rail (All · Tracking · Known · Ignored · Trash)
      beside the list on wide panels, collapsing to a scroll strip on narrow ones.
    </>
  ),
};

function App(): React.ReactElement {
  const [concept, setConcept] = useState<ConceptId>('a');
  const [viewport, setViewport] = useState<Viewport>('mobile');
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    new URLSearchParams(location.search).get('mode') === 'dark' ? 'dark' : 'light',
  );
  const mock = useVocabMock();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ErrorBoundary>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Vocabulary tab — redesign</h1>
          <p className={styles.subtitle}>
            Responsive IA at every panel width, a view/edit split so delete is only on demand,
            and a 24h Trash for removed words — in the Universal Panel + Dictionary language.
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
            {concept === 'a' && <ConceptA mock={mock} />}
            {concept === 'b' && <ConceptB mock={mock} />}
            {concept === 'c' && <ConceptC mock={mock} />}
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
