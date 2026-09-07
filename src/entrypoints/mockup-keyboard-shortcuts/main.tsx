import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/shared/ui';
import { setUiLanguageOverride } from '@/shared/i18n';
import { RealPanel } from './real';
import { ConceptA } from './ConceptA';
import { ConceptB } from './ConceptB';
import { ConceptC } from './ConceptC';
import { ConceptD } from './ConceptD';
import { ConceptE } from './ConceptE';
import { ConceptF } from './ConceptF';
import { DEFAULT_SHORTCUTS, setShortcut, type ShortcutMap } from './mockData';
import type { ShortcutValue } from '@/shared/ui/ShortcutInput';
import '@/shared/styles/document.css';
import styles from './mockup.module.css';

document.documentElement.setAttribute('data-preset', 'dawn');
document.documentElement.setAttribute('data-theme', 'light');
setUiLanguageOverride(new URLSearchParams(location.search).get('lang') ?? '');

type ConceptId = 'real' | 'a' | 'b' | 'c' | 'd' | 'e' | 'f';
type Viewport = 'mobile' | 'desktop';

const CONCEPTS: { id: ConceptId; label: string }[] = [
  { id: 'real', label: 'Real panel' },
  { id: 'a', label: 'A · Refined List' },
  { id: 'b', label: 'B · Keyboard Map' },
  { id: 'c', label: 'C · Action Lanes' },
  { id: 'd', label: 'D · Two-Pane' },
  { id: 'e', label: 'E · Press-First' },
  { id: 'f', label: 'F · Bento' },
];

const NOTES: Record<ConceptId, React.ReactNode> = {
  real: (
    <>
      Production <strong>Keyboard Shortcuts</strong> panel — label above the pill,
      1 column on mobile, 2 columns on desktop. Live for comparison.
    </>
  ),
  a: (
    <>
      <strong>Refined List</strong> — one scannable list, group headers stand out, rows
      highlight on hover, and a red dot warns when two actions share the same binding.
    </>
  ),
  b: (
    <>
      <strong>Keyboard Map</strong> — a visual QWERTY map where assigned keys light up.
      Search and group chips filter the editable action list below.
    </>
  ),
  c: (
    <>
      <strong>Action Lanes</strong> — each category is a lane with a key rail; the bead
      for each action slides to its assigned key. More tactile, more motion.
    </>
  ),
  d: (
    <>
      <strong>Two-Pane Editor</strong> — left: list of actions; right: live mini-keyboard.
      Select an action, then press or click a key. Master–detail for desktop.
    </>
  ),
  e: (
    <>
      <strong>Press-First Recorder</strong> — press a key first, then pick which action it
      should drive. Flips the flow and makes free keys obvious.
    </>
  ),
  f: (
    <>
      <strong>Bento Cards</strong> — each action is a tile with a group-tinted accent;
      click the pill inside the tile to record. Dashboard-like and touch-friendly.
    </>
  ),
};

function App(): React.ReactElement {
  const [concept, setConcept] = useState<ConceptId>('real');
  const [viewport, setViewport] = useState<Viewport>('mobile');
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    new URLSearchParams(location.search).get('mode') === 'dark' ? 'dark' : 'light',
  );
  const [map, setMap] = useState<ShortcutMap>(DEFAULT_SHORTCUTS);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleChange = (action: keyof ShortcutMap, value: ShortcutValue | null): void => {
    setMap(setShortcut(map, action, value));
  };

  return (
    <ErrorBoundary>
      <div className={styles.mksPage}>
        <header className={styles.mksHeader}>
          <h1 className={styles.mksTitle}>Keyboard Shortcuts — redesign</h1>
          <p className={styles.mksSubtitle}>
            Compare the shipped shortcut panel with six directions. Tap a pill and press a
            key to remap; conflicts are highlighted live.
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
          {concept === 'real' && <RealPanel map={map} onChange={handleChange} />}
          {concept === 'a' && <ConceptA map={map} onChange={setMap} />}
          {concept === 'b' && <ConceptB map={map} onChange={setMap} />}
          {concept === 'c' && <ConceptC map={map} onChange={setMap} />}
          {concept === 'd' && <ConceptD map={map} onChange={setMap} />}
          {concept === 'e' && <ConceptE map={map} onChange={setMap} />}
          {concept === 'f' && <ConceptF map={map} onChange={setMap} />}
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
