import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { DriveSyncBlock } from './DriveSyncBlock';
import { AnkiSyncBlock } from './AnkiSyncBlock';
import type { AnkiState, DriveState } from './mockData';
import '@/shared/styles/document.css';
import './mockup.css';

document.documentElement.setAttribute('data-preset', 'dawn');
document.documentElement.setAttribute(
  'data-theme',
  new URLSearchParams(location.search).get('theme') ?? 'light',
);

type Layout = 'split' | 'single';
type Width = 'settings' | 'narrow';
type Page = 'drive' | 'anki';

const params = new URLSearchParams(location.search);
const driveParam = params.get('drive') as DriveState | null;
const ankiParam = params.get('anki') as AnkiState | null;
const layoutParam = params.get('layout') as Layout | null;
const widthParam = params.get('w') as Width | null;

const DRIVE_STATES: readonly DriveState[] = [
  'empty',
  'connected',
  'syncing',
  'reauth',
  'offline',
  'full',
  'error',
];
const ANKI_STATES: readonly AnkiState[] = ['off', 'never', 'idle', 'syncing', 'error'];

const DECOR_NAV = [
  { id: 'languageProfile', label: 'Language profiles', icon: 'languages' },
  { id: 'media', label: 'Media', icon: 'video' },
  { id: 'block', label: 'Subtitles', icon: 'captions' },
  { id: 'dictionaryPopup', label: 'Dictionary popup', icon: 'bookOpen' },
  { id: 'audio', label: 'Audio', icon: 'audioWave' },
  { id: 'download', label: 'Downloads', icon: 'download' },
  { id: 'shortcuts', label: 'Shortcuts', icon: 'slidersHorizontal' },
  { id: 'theme', label: 'Appearance', icon: 'sun' },
] as const;

function syncUrl(next: Record<string, string>): void {
  const p = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(next)) p.set(k, v);
  window.history.replaceState(null, '', `${location.pathname}?${p.toString()}`);
}

function App(): React.ReactElement {
  const [layout, setLayout] = useState<Layout>(layoutParam === 'single' ? 'single' : 'split');
  const [driveState, setDriveState] = useState<DriveState>(
    driveParam !== null && DRIVE_STATES.includes(driveParam) ? driveParam : 'connected',
  );
  const [ankiState, setAnkiState] = useState<AnkiState>(
    ankiParam !== null && ANKI_STATES.includes(ankiParam) ? ankiParam : 'idle',
  );
  const [width, setWidth] = useState<Width>(widthParam === 'narrow' ? 'narrow' : 'settings');
  const [theme, setTheme] = useState<'light' | 'dark'>(
    params.get('theme') === 'dark' ? 'dark' : 'light',
  );
  const [page, setPage] = useState<Page>('drive');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    syncUrl({ theme });
  }, [theme]);

  const pickLayout = (next: Layout): void => {
    setLayout(next);
    syncUrl({ layout: next });
  };
  const pickWidth = (next: Width): void => {
    setWidth(next);
    syncUrl({ w: next });
  };
  const pickDrive = (next: DriveState): void => {
    setDriveState(next);
    syncUrl({ drive: next });
  };
  const pickAnki = (next: AnkiState): void => {
    setAnkiState(next);
    syncUrl({ anki: next });
  };

  return (
    <ErrorBoundary>
      <div className="msrPage">
        <header className="msrHeader">
          <h1 className="msrTitle">Sync — redesign</h1>
          <p className="msrSubtitle">
            Two systems, clearly separated. Option A (recommended) splits them into two nav pages;
            Option B keeps one page with a visible divider. Info first, stats as charts, config
            behind Advanced.
          </p>
          <div className="msrControls">
            <label className="msrControl">
              Layout
              <select value={layout} onChange={(e) => pickLayout(e.target.value as Layout)}>
                <option value="split">A — Two nav pages (recommended)</option>
                <option value="single">B — One page + divider</option>
              </select>
            </label>
            <label className="msrControl">
              Drive state
              <select value={driveState} onChange={(e) => pickDrive(e.target.value as DriveState)}>
                {DRIVE_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="msrControl">
              Anki state
              <select value={ankiState} onChange={(e) => pickAnki(e.target.value as AnkiState)}>
                {ANKI_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="msrControl">
              Width
              <select value={width} onChange={(e) => pickWidth(e.target.value as Width)}>
                <option value="settings">Settings ~840px</option>
                <option value="narrow">Narrow ~360px</option>
              </select>
            </label>
            <div className="msrSeg" role="group" aria-label="Theme">
              <button
                type="button"
                aria-pressed={theme === 'light'}
                onClick={() => setTheme('light')}
              >
                Light
              </button>
              <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
                Dark
              </button>
            </div>
          </div>
        </header>

        <main className="msrFrame" data-width={width}>
          <nav className="msrNav" aria-label="Settings sections">
            {DECOR_NAV.map((item) => (
              <span key={item.id} className="msrNavItem" aria-hidden="true">
                <Icon name={item.icon} size="sm" />
                <span className="msrNavLabel">{item.label}</span>
              </span>
            ))}
            {layout === 'split' ? (
              <>
                <button
                  type="button"
                  className="msrNavItem msrNavItem-btn"
                  data-active={page === 'drive'}
                  onClick={() => setPage('drive')}
                  aria-label="Cloud backup"
                >
                  <Icon name="repeat" size="sm" />
                  <span className="msrNavLabel">Cloud backup</span>
                </button>
                <button
                  type="button"
                  className="msrNavItem msrNavItem-btn"
                  data-active={page === 'anki'}
                  onClick={() => setPage('anki')}
                  aria-label="Anki sync"
                >
                  <Icon name="windowPage" size="sm" />
                  <span className="msrNavLabel">Anki sync</span>
                </button>
              </>
            ) : (
              <span className="msrNavItem" data-active="true">
                <Icon name="navRepeat" size="sm" />
                <span className="msrNavLabel">Sync</span>
              </span>
            )}
          </nav>

          <div className="msrContent">
            {layout === 'split' ? (
              page === 'drive' ? (
                <DriveSyncBlock state={driveState} onStateChange={pickDrive} />
              ) : (
                <AnkiSyncBlock state={ankiState} onStateChange={pickAnki} />
              )
            ) : (
              <>
                <DriveSyncBlock state={driveState} onStateChange={pickDrive} />
                <hr className="msrDivider" aria-hidden="true" />
                <AnkiSyncBlock state={ankiState} onStateChange={pickAnki} />
              </>
            )}
          </div>
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
