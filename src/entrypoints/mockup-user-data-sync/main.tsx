import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/shared/ui';
import { setUiLanguageOverride } from '@/shared/i18n';
import { useSyncMock } from './state';
import type { ScenarioId } from './mockData';
import { ConceptA } from './ConceptA';
import { ConceptB } from './ConceptB';
import { ConceptC } from './ConceptC';
import { RealBaseline } from './real';
import '@/shared/styles/document.css';
import './shell.css';

document.documentElement.setAttribute('data-preset', 'dawn');
document.documentElement.setAttribute('data-theme', 'light');
setUiLanguageOverride(new URLSearchParams(location.search).get('lang') ?? '');

type TabId = 'real' | 'a' | 'b' | 'c';
type Viewport = 'mobile' | 'desktop';

const TABS: { id: TabId; label: string }[] = [
  { id: 'real', label: 'Real' },
  { id: 'a', label: 'A Beacon' },
  { id: 'b', label: 'B Watershed' },
  { id: 'c', label: 'C Passport' },
];

const SCENARIOS: { id: ScenarioId; label: string }[] = [
  { id: 'first-use', label: 'First use' },
  { id: 'protected', label: 'Protected' },
  { id: 'attention', label: 'Needs attention' },
  { id: 'migrating', label: 'Migrating' },
  { id: 'disconnect-pending', label: 'Disconnect pending' },
  { id: 'offline', label: 'Offline' },
  { id: 'cloud-full', label: 'Cloud full' },
  { id: 'waiting-account', label: 'Waiting account' },
  { id: 'device-full', label: 'Device full' },
  { id: 'empty', label: 'Empty' },
  { id: 'overflow', label: 'Overflow' },
];

const NOTES: Record<TabId, React.ReactNode> = {
  real: (
    <>
      <strong>Real</strong> — the production Settings dialog as it exists today, before any
      Sync section ships. This is the baseline the concepts must feel native to.
    </>
  ),
  a: (
    <>
      <strong>Beacon</strong> — one safety signal at rest: a large beacon state, a sparse
      profile constellation, one focused inspector, and a collapsed protection band.
      State-first, progressively disclosed.
    </>
  ),
  b: (
    <>
      <strong>Watershed</strong> — an editable topology canvas: profile sources on one bank,
      storage reservoirs on the other, a distinct channel per profile. The map itself is the
      interface.
    </>
  ),
  c: (
    <>
      <strong>Passport</strong> — a profile wallet: an index of documents and one open
      passport spread with destination and status stamps, a contents record, and a wallet
      pocket for account actions.
    </>
  ),
};

function ConceptStage({
  tab,
  scenarioId,
}: {
  tab: TabId;
  scenarioId: ScenarioId;
}): React.ReactElement | null {
  const mock = useSyncMock(scenarioId);
  if (tab === 'a') return <ConceptA mock={mock} />;
  if (tab === 'b') return <ConceptB mock={mock} />;
  if (tab === 'c') return <ConceptC mock={mock} />;
  return null;
}

function App(): React.ReactElement {
  const [tab, setTab] = useState<TabId>('a');
  const [viewport, setViewport] = useState<Viewport>('mobile');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [scenarioId, setScenarioId] = useState<ScenarioId>('protected');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ErrorBoundary>
      <div className="ms-page">
        <header className="ms-header">
          <h1 className="ms-title">User data sync — design mockup</h1>
          <div className="ms-controls">
            <div className="ms-seg" role="group" aria-label="Concept">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={tab === t.id}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="ms-seg" role="group" aria-label="Viewport">
              <button type="button" aria-pressed={viewport === 'mobile'} onClick={() => setViewport('mobile')}>
                Mobile
              </button>
              <button type="button" aria-pressed={viewport === 'desktop'} onClick={() => setViewport('desktop')}>
                Desktop
              </button>
            </div>
            <div className="ms-seg" role="group" aria-label="Theme">
              <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>
                Light
              </button>
              <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
                Dark
              </button>
            </div>
            <div className="ms-seg" role="group" aria-label="Scenario">
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={scenarioId === s.id}
                  onClick={() => setScenarioId(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <p className="ms-note">{NOTES[tab]}</p>

        <main className="ms-stage" data-viewport={viewport}>
          {tab === 'real' && <RealBaseline />}
          {tab !== 'real' && <ConceptStage key={scenarioId} tab={tab} scenarioId={scenarioId} />}
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
