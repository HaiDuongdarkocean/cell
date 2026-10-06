import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/shared/ui';
import { ConceptTarget } from './ConceptTarget';
import { RealPanel } from './real';
import '@/shared/styles/document.css';
import styles from './mockup.module.css';

type ConceptId = 'real' | 'target';
type Viewport = 'mobile' | 'desktop';
type Theme = 'dark' | 'light';

const CONCEPTS: { id: ConceptId; label: string }[] = [
  { id: 'real', label: 'Real · current overlay' },
  { id: 'target', label: 'Target · mockup layout' },
];

const NOTES: Record<ConceptId, React.ReactNode> = {
  real: (
    <>
      Production <strong>PlayerModeOverlay</strong> as shipped — mobile branch crams NavCluster
      (6 buttons) + subtitle text + right toolbar (8 buttons) into a 160px dock. Screenshot the
      page at a ≤600px browser window to see the real mobile crowding.
    </>
  ),
  target: (
    <>
      <strong>Target layout</strong> — the approved mockup mapped to tokens: cue cards as the
      reading surface, mono-hue pill-style buttons (bg = subtle tint của gốc, icon = gốc
      thuần — đúng cặp comprehension-pill), hero play, ⋯ overflow via shared Menu. Scheme A
      semantic: primary / error / warning, neutral tint-gray.
    </>
  ),
};

function App(): React.ReactElement {
  const params = new URLSearchParams(location.search);
  const bare = params.has('bare');
  const initialConcept = params.get('concept') === 'real' ? 'real' : 'target';
  const [concept, setConcept] = useState<ConceptId>(initialConcept);
  const [viewport, setViewport] = useState<Viewport>('mobile');
  const [theme, setTheme] = useState<Theme>(() =>
    new URLSearchParams(location.search).get('mode') === 'light' ? 'light' : 'dark',
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-preset', 'ocean');
  }, [theme]);

  if (bare) {
    return (
      <ErrorBoundary>{concept === 'real' ? <RealPanel /> : <ConceptTarget />}</ErrorBoundary>
    );
  }

  return (
    <div className={styles.shell}>
      <div className={styles.controls}>
        <div className={styles.ctrlGroup}>
          <span className={styles.ctrlLabel}>Concept</span>
          {CONCEPTS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`${styles.ctrlBtn} ${concept === c.id ? styles.ctrlBtnActive : ''}`}
              onClick={() => setConcept(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className={styles.ctrlGroup}>
          <span className={styles.ctrlLabel}>Viewport</span>
          <button
            type="button"
            className={`${styles.ctrlBtn} ${viewport === 'mobile' ? styles.ctrlBtnActive : ''}`}
            onClick={() => setViewport('mobile')}
          >
            Mobile 390
          </button>
          <button
            type="button"
            className={`${styles.ctrlBtn} ${viewport === 'desktop' ? styles.ctrlBtnActive : ''}`}
            onClick={() => setViewport('desktop')}
          >
            Desktop 960
          </button>
        </div>
        <div className={styles.ctrlGroup}>
          <span className={styles.ctrlLabel}>Theme</span>
          <button
            type="button"
            className={`${styles.ctrlBtn} ${theme === 'dark' ? styles.ctrlBtnActive : ''}`}
            onClick={() => setTheme('dark')}
          >
            Dark
          </button>
          <button
            type="button"
            className={`${styles.ctrlBtn} ${theme === 'light' ? styles.ctrlBtnActive : ''}`}
            onClick={() => setTheme('light')}
          >
            Light
          </button>
        </div>
      </div>
      <p className={styles.note}>{NOTES[concept]}</p>
      <div className={styles.stageWrap}>
        <div className={`${styles.stage} ${viewport === 'mobile' ? styles.stageMobile : styles.stageDesktop}`}>
          <ErrorBoundary>{concept === 'real' ? <RealPanel /> : <ConceptTarget />}</ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
