import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from '@/shared/ui';
import { setUiLanguageOverride } from '@/shared/i18n';
import type { ShortcutAction, KeyboardShortcut } from '@/entities/settings/types';
import type { ShortcutValue } from '@/shared/ui/ShortcutInput';
import { ShortcutsBlock } from './ShortcutsBlock';
import { BINDINGS } from './mockData';
import '@/shared/styles/document.css';
import './mockup.css';

setUiLanguageOverride('en');

document.documentElement.setAttribute('data-preset', 'dawn');
document.documentElement.setAttribute(
  'data-theme',
  new URLSearchParams(location.search).get('theme') ?? 'dark',
);

type Width = 'wide' | 'narrow';
type Theme = 'light' | 'dark';

const params = new URLSearchParams(location.search);
const widthParam = params.get('w') as Width | null;

function syncUrl(next: Record<string, string>): void {
  const p = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(next)) p.set(k, v);
  window.history.replaceState(null, '', `${location.pathname}?${p.toString()}`);
}

function App(): React.ReactElement {
  const [width, setWidth] = useState<Width>(widthParam === 'narrow' ? 'narrow' : 'wide');
  const [theme, setTheme] = useState<Theme>(params.get('theme') === 'light' ? 'light' : 'dark');
  const [shortcuts, setShortcuts] = useState<readonly KeyboardShortcut[]>(BINDINGS);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    syncUrl({ theme });
  }, [theme]);

  const pickWidth = (next: Width): void => {
    setWidth(next);
    syncUrl({ w: next });
  };

  const rebind = (action: ShortcutAction, value: ShortcutValue): void => {
    setShortcuts((prev) =>
      prev.map((s) =>
        s.action === action
          ? { ...s, key: value.key, ctrl: value.ctrl, shift: value.shift, alt: value.alt }
          : s,
      ),
    );
  };

  return (
    <ErrorBoundary>
      <div className="scrPage">
        <header className="scrHeader">
          <h1 className="scrTitle">Keyboard shortcuts — redesign</h1>
          <p className="scrSubtitle">
            Each shortcut group becomes its own card; pills align on one right-edge rail per card;
            cards flow in a two-column masonry that collapses to one column under ~880px of content
            width. The conflict pair ("Auto-translate subtitles" + "Search dictionary", both Shift+T)
            shows the destructive pill border plus the existing conflict dot.
          </p>
          <div className="scrControls">
            <label className="scrControl">
              Width
              <select value={width} onChange={(e) => pickWidth(e.target.value as Width)}>
                <option value="wide">Wide ~960px</option>
                <option value="narrow">Narrow ~380px</option>
              </select>
            </label>
            <div className="scrSeg" role="group" aria-label="Theme">
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

        <main className="scrFrame" data-width={width}>
          <div className="scrContent">
            <ShortcutsBlock shortcuts={shortcuts} onRebind={rebind} />
          </div>
        </main>

        <footer className="scrNotes">
          <p className="scrNotesTitle">Design notes</p>
          <ul className="scrNotesList">
            <li>Group label becomes the card header — same secondary group-label style as today.</li>
            <li>
              One key rail per card: labels keep min-width 0 and wrap (never truncate); the
              ShortcutInput is flex-shrink 0 pinned to the card's right edge.
            </li>
            <li>Hairline dividers between rows inside a card; no dividers between cards.</li>
            <li>
              aria-invalid="true" gets a destructive pill border via a scoped mockup override —
              src/shared/ui is untouched.
            </li>
          </ul>
        </footer>
      </div>
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
