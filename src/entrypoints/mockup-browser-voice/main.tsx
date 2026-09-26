import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/shared/ui';
import { setUiLanguageOverride } from '@/shared/i18n';
import { useVoiceLab } from './voiceLab';
import { ConceptA } from './ConceptA';
import { ConceptB } from './ConceptB';
import { ConceptC } from './ConceptC';
import '@/shared/styles/document.css';
import './mockup.css';

document.documentElement.setAttribute('data-preset', 'dawn');
document.documentElement.setAttribute('data-theme', 'light');
setUiLanguageOverride(new URLSearchParams(location.search).get('lang') ?? '');

type ConceptId = 'a' | 'b' | 'c';
type Viewport = 'mobile' | 'desktop';

const CONCEPTS: { id: ConceptId; label: string }[] = [
  { id: 'a', label: 'A · Just the list' },
  { id: 'b', label: 'B · Button mirror' },
  { id: 'c', label: 'C · 3 rows' },
];

const NOTES: Record<ConceptId, React.ReactNode> = {
  a: (
    <>
      <strong>Just the list</strong> — the dictionary audio-tab pattern, nothing else: tap a
      voice row to put it on a button (numbered ①②③ in tap order), tap again to remove. The
      round ▶ previews.
    </>
  ),
  b: (
    <>
      <strong>Button mirror</strong> — the popup&rsquo;s 3 speaker buttons rendered for real on
      top. Tap a button to arm it, tap a voice to fill it (and hear it). The list is the same
      dictionary checkable row.
    </>
  ),
  c: (
    <>
      <strong>3 rows</strong> — the screen at rest is literally three lines: Button 1, 2, 3.
      Tap a row to expand the voice picker inline; pick once, it closes and saves.
    </>
  ),
};

const TARGETS = [
  { code: 'en', label: 'English' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'ja', label: 'Japanese' },
];

function StaticChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="mbv-card">
      <div className="mbv-cardhead">
        <h2 className="mbv-cardtitle">Audio</h2>
        <p className="mbv-cardsub">Pick a mode, then tap a source to tune it.</p>
      </div>
      <div className="mbv-static-label">Output mode</div>
      <div className="mbv-segline" aria-hidden="true">
        {['Auto', 'Natural', 'Fast', 'Offline', 'Minimal'].map((m) => (
          <span key={m} className={`mbv-segpill${m === 'Fast' ? ' on' : ''}`}>
            {m}
          </span>
        ))}
      </div>
      <div className="mbv-static-label">Source order</div>
      <div className="mbv-chain" aria-hidden="true">
        {['Browser voice', 'Community audio', 'Local audio files', 'Device voice'].map((s, i) => (
          <React.Fragment key={s}>
            {i > 0 && <span className="mbv-arrow">→</span>}
            <span className={`mbv-chainpill${i === 0 ? ' on' : ''}`}>
              <span className="mbv-dot" /> {s}
            </span>
          </React.Fragment>
        ))}
      </div>
      <div className="mbv-detail">{children}</div>
      <div className="mbv-foot">
        <div className="mbv-tryit">
          <span className="mbv-static-label">Try it</span>
          <span className="mbv-tryinput">Type a word…</span>
        </div>
        <div className="mbv-tryit">
          <span className="mbv-static-label">Autoplay</span>
          <span className="mbv-tryinput">0</span>
        </div>
      </div>
    </div>
  );
}

function App(): React.ReactElement {
  const [concept, setConcept] = useState<ConceptId>('a');
  const [viewport, setViewport] = useState<Viewport>('mobile');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [target, setTarget] = useState('en');

  const lab = useVoiceLab(target);
  const targetLabel = TARGETS.find((t) => t.code === target)?.label ?? target;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ErrorBoundary>
      <div className="mbv-page">
        <header className="mbv-header">
          <h1 className="mbv-title">Browser voice — redesign</h1>
          <p className="mbv-subtitle">
            One job: give each of the 3 speak buttons a voice. Voices are auto-filtered by the
            active profile&rsquo;s target language. Try mobile vs desktop, light vs dark.
          </p>
          <div className="mbv-controls">
            <div className="mbv-seg" role="group" aria-label="Concept">
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
            <div className="mbv-seg" role="group" aria-label="Viewport">
              <button type="button" aria-pressed={viewport === 'mobile'} onClick={() => setViewport('mobile')}>
                Mobile
              </button>
              <button type="button" aria-pressed={viewport === 'desktop'} onClick={() => setViewport('desktop')}>
                Desktop
              </button>
            </div>
            <div className="mbv-seg" role="group" aria-label="Theme">
              <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>
                Light
              </button>
              <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
                Dark
              </button>
            </div>
            <div className="mbv-seg" role="group" aria-label="Profile target language">
              {TARGETS.map((t) => (
                <button
                  key={t.code}
                  type="button"
                  aria-pressed={target === t.code}
                  onClick={() => setTarget(t.code)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <p className="mbv-note">{NOTES[concept]}</p>

        <main className="mbv-stage" data-viewport={viewport}>
          <StaticChrome>
            {concept === 'a' && <ConceptA lab={lab} targetLabel={targetLabel} />}
            {concept === 'b' && <ConceptB lab={lab} targetLabel={targetLabel} />}
            {concept === 'c' && <ConceptC lab={lab} targetLabel={targetLabel} />}
          </StaticChrome>
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
