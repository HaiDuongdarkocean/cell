import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/shared/ui';
import { RealPanel } from './real';
import { ConceptA } from './ConceptA';
import { ConceptB } from './ConceptB';
import { ConceptC } from './ConceptC';
import { ConceptD } from './ConceptD';
import { ConceptE } from './ConceptE';
import { ConceptG } from './ConceptG';
import { useMockResources } from './state';
import '@/shared/styles/document.css';
import styles from './mockup.module.css';

// Mockup page has no chrome.storage or ThemeProvider — set attributes directly.
document.documentElement.setAttribute('data-preset', 'dawn');
document.documentElement.setAttribute('data-theme', 'light');

type ConceptId = 'real' | 'a' | 'b' | 'c' | 'd' | 'e' | 'g';
type Viewport = 'mobile' | 'desktop';

const CONCEPTS: { id: ConceptId; label: string }[] = [
  { id: 'real', label: 'Real panel' },
  { id: 'a', label: 'A · Stillwater Shelf' },
  { id: 'b', label: 'B · Bento Garden' },
  { id: 'c', label: 'C · Stone Console' },
  { id: 'd', label: 'D · River Stream' },
  { id: 'e', label: 'E · Modular Pinboard' },
  { id: 'g', label: 'G · Catalog Storefront' },
];

const NOTES: Record<ConceptId, React.ReactNode> = {
  real: (
    <>
      Production <strong>ResourcesPanel</strong> — two stacked sections with a
      dropzone, resource cards, and a frequency-band editor. It may show a load
      error here because the background service is absent; that is expected.
    </>
  ),
  a: (
    <>
      <strong>Stillwater Shelf</strong> — an editorial bookshelf. Large section
      headings, soft solid cards stacked like books, pill dropzones as trays,
      and the frequency bands read like a ruler along the bottom of the shelf.
      Calm, ordered, minimal change from the shipped layout.
    </>
  ),
  b: (
    <>
      <strong>Bento Garden</strong> — a dashboard of tinted tiles. Dictionaries
      (blue), frequency lists (orange), and tuning (green) are separate
      compartments with counts, quick-add, and compact rows inside each tile.
    </>
  ),
  c: (
    <>
      <strong>Stone Console</strong> — a mechanical ledger. A command bar with
      two orders and status chips sits above hard-edged rows; expanding a row
      opens an inline readout, and a tuning strip of numeric dials anchors the
      bottom.
    </>
  ),
  d: (
    <>
      <strong>River Stream</strong> — a single chronological feed. Newest
      resources float to the top under Hôm nay / Hôm qua / Cũ hơn headers,
      a floating composer at the lower-right adds drops to the stream, and
      the frequency bands run along the bottom like a riverbed.
    </>
  ),
  e: (
    <>
      <strong>Modular Pinboard</strong> — a three-column board: Từ điển,
      Độ phổ biến, and Tạm tắt. Cards move between columns with buttons and
      reorder inside a column; selecting a card opens an inspector (bottom
      sheet on mobile, side drawer on desktop) with profile, sample, lookup
      tester, and bands.
    </>
  ),
  g: (
    <>
      <strong>Catalog Storefront</strong> — an app-store shelf. Search and
      category tabs sit above a grid of product cards with install toggles;
      tapping a card opens a product sheet with preview, lookup tester, and
      a Preferences block for frequency bands.
    </>
  ),
};

function App(): React.ReactElement {
  const [concept, setConcept] = useState<ConceptId>('real');
  const [viewport, setViewport] = useState<Viewport>('mobile');
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    new URLSearchParams(location.search).get('mode') === 'dark' ? 'dark' : 'light',
  );
  const controls = useMockResources();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ErrorBoundary>
      <div className={styles.mrPage}>
        <header className={styles.mrHeader}>
          <h1 className={styles.mrTitle}>Resources — redesign</h1>
          <p className={styles.mrSubtitle}>
            Compare the shipped Resources panel with three directions. Mock
            state is shared — toggles, reorder, delete, import, and frequency
            bands stay live across concepts.
          </p>
          <div className={styles.mrControls}>
            <div className={styles.mrSeg} role="group" aria-label="Concept">
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
            <div className={styles.mrSeg} role="group" aria-label="Viewport">
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
            <div className={styles.mrSeg} role="group" aria-label="Theme">
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

        <p className={styles.mrConceptNote}>{NOTES[concept]}</p>

        <main className={styles.mrStage} data-viewport={viewport}>
          {concept === 'real' && <RealPanel />}
          {concept === 'a' && <ConceptA controls={controls} />}
          {concept === 'b' && <ConceptB controls={controls} />}
          {concept === 'c' && <ConceptC controls={controls} />}
          {concept === 'd' && <ConceptD controls={controls} />}
          {concept === 'e' && <ConceptE controls={controls} />}
          {concept === 'g' && <ConceptG controls={controls} />}
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
