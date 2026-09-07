import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/shared/ui';
import { setUiLanguageOverride } from '@/shared/i18n';
import { MultiSelect } from '@/shared/ui/MultiSelect';
import { SUBTITLE_LANGUAGES } from '@/shared/config/languageRegistry';
import { ConceptA } from './ConceptA';
import { ConceptB } from './ConceptB';
import { ConceptC } from './ConceptC';
import '@/shared/styles/document.css';
import './mockup.css';

document.documentElement.setAttribute('data-preset', 'dawn');
document.documentElement.setAttribute('data-theme', 'light');
setUiLanguageOverride(new URLSearchParams(location.search).get('lang') ?? '');

type ConceptId = 'real' | 'a' | 'b' | 'c';
type Viewport = 'mobile' | 'desktop';

const CONCEPTS: { id: ConceptId; label: string }[] = [
  { id: 'real', label: 'Real panel' },
  { id: 'a', label: 'A · Checklist' },
  { id: 'b', label: 'B · Collapsed' },
  { id: 'c', label: 'C · Tag field' },
];

const NOTES: Record<ConceptId, React.ReactNode> = {
  real: (
    <>
      Production <strong>MultiSelect</strong>, live — now the shipped tag-field (Concept C):
      exclusive &quot;All&quot; chip, in-flow suggestions, shared atoms only.
    </>
  ),
  a: (
    <>
      <strong>Checklist</strong> — same open list, fixed: &quot;All&quot; is an exclusive mode row
      (not a sibling item), rows use the shared Toggle atom, single focus ring.
    </>
  ),
  b: (
    <>
      <strong>Collapsed picker</strong> — closed = one summary row like every other setting.
      Expands in-flow so the section card grows (today&apos;s convention). Search inside.
    </>
  ),
  c: (
    <>
      <strong>Tag field</strong> — selected languages are removable chips in the input; typing
      filters suggestions; popular row for the common 1–3 language case.
    </>
  ),
};

function SectionFrame({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="msl-card">
      <div className="msl-cardHeader">
        <strong className="msl-cardTitle">Media Selection</strong>
        <span className="msl-cardDesc">Configure how media is automatically selected.</span>
      </div>
      <div className="msl-cardBody">{children}</div>
    </div>
  );
}

function App(): React.ReactElement {
  const [concept, setConcept] = useState<ConceptId>('real');
  const [viewport, setViewport] = useState<Viewport>('mobile');
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    new URLSearchParams(location.search).get('mode') === 'dark' ? 'dark' : 'light',
  );
  const [selected, setSelected] = useState<string[]>(['all']);
  const [realSelected, setRealSelected] = useState<string[]>(['all']);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const conceptProps = { selected, onChange: setSelected };

  return (
    <ErrorBoundary>
      <div className="msl-page">
        <header className="msl-header">
          <h1 className="msl-title">Subtitle languages — redesign</h1>
          <p className="msl-subtitle">
            Whitelist for media auto-selection (<code>selectedSubtitleLanguages</code>). Compare the
            shipped control with three directions.
          </p>
          <div className="msl-controls">
            <div className="msl-seg" role="group" aria-label="Concept">
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
            <div className="msl-seg" role="group" aria-label="Viewport">
              <button type="button" aria-pressed={viewport === 'mobile'} onClick={() => setViewport('mobile')}>
                Mobile
              </button>
              <button type="button" aria-pressed={viewport === 'desktop'} onClick={() => setViewport('desktop')}>
                Desktop
              </button>
            </div>
            <div className="msl-seg" role="group" aria-label="Theme">
              <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>
                Light
              </button>
              <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
                Dark
              </button>
            </div>
          </div>
        </header>

        <p className="msl-concept-note">{NOTES[concept]}</p>

        <main className="msl-stage" data-viewport={viewport}>
          <SectionFrame>
            <span className="msl-rowLabel">Subtitle languages</span>
            {concept === 'real' && (
              <MultiSelect
                testId="subtitle-lang-multiselect"
                options={SUBTITLE_LANGUAGES}
                selectedValues={realSelected}
                onChange={setRealSelected}
                exclusiveValues={['all']}
                popularValues={['en', 'vi', 'ja', 'ko', 'zh', 'es', 'fr', 'de']}
              />
            )}
            {concept === 'a' && <ConceptA {...conceptProps} />}
            {concept === 'b' && <ConceptB {...conceptProps} />}
            {concept === 'c' && <ConceptC {...conceptProps} />}
          </SectionFrame>
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
