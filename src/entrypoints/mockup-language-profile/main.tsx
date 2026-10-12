import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { LanguageProfilePanel } from '@/features/settings/ui/LanguageProfilePanel';
import { ErrorBoundary } from '@/shared/ui';
import { setUiLanguageOverride } from '@/shared/i18n';
import {
  DEFAULT_SETTINGS,
  DEFAULT_DICTIONARY_POPUP_SETTINGS,
  DEFAULT_OVERLAY_STYLE_TARGET,
  DEFAULT_OVERLAY_STYLE_NATIVE,
} from '@/shared/config/config';
import type { LanguageProfile, Settings } from '@/entities/settings';
import { ConceptB } from './ConceptB';
import { ConceptC } from './ConceptC';
import { ConceptD } from './ConceptD';
import { MOCK_PROFILES, MOCK_UNIVERSAL_NATIVE, langLabel, type MockProfile } from './mockData';
import '@/shared/styles/document.css';
import './mockup.css';

// Mockup page has no chrome.storage, so ThemeProvider is not used —
// set preset + theme attributes directly (tokens.css scopes on both).
document.documentElement.setAttribute('data-preset', 'dawn');
document.documentElement.setAttribute('data-theme', 'light');
// ?lang=vi|en — lets Playwright/manual QA exercise both locales.
setUiLanguageOverride(new URLSearchParams(location.search).get('lang') ?? '');

type Viewport = 'mobile' | 'desktop';

function toRealProfile(m: MockProfile, order: number): LanguageProfile {
  return {
    id: m.id,
    target: m.target,
    native: m.native,
    name: m.name,
    order,
    subtitleOverlayTargetStyle: DEFAULT_OVERLAY_STYLE_TARGET,
    subtitleOverlayNativeStyle: DEFAULT_OVERLAY_STYLE_NATIVE,
    subtitleOverlayAutoLoad: m.subtitleOverlay.autoLoad,
    subtitleOverlayAutoLoadAsr: m.subtitleOverlay.asr,
    subtitleOverlayAutoTranslate: m.subtitleOverlay.autoTranslate,
    showReadings: false,
    showWordTranslations: false,
    dictionaryPopup: { ...DEFAULT_DICTIONARY_POPUP_SETTINGS, enabled: m.dictPopup.enabled },
  };
}

function App(): React.ReactElement {
  const [viewport, setViewport] = useState<Viewport>('mobile');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Shared mock state for the concept views.
  const [profiles, setProfiles] = useState<MockProfile[]>(MOCK_PROFILES);
  const [activeId, setActiveId] = useState<string | null>('p-en');
  const [universalNative, setUniversalNative] = useState(MOCK_UNIVERSAL_NATIVE);

  // Live settings for the real panel — its own store so Playwright/manual QA
  // can exercise every mutation (add/edit/delete/reorder/activate).
  const [panelSettings, setPanelSettings] = useState<Settings>(() => ({
    ...DEFAULT_SETTINGS,
    universalNativeLanguage: MOCK_UNIVERSAL_NATIVE,
    languageProfiles: MOCK_PROFILES.map((p, i) => toRealProfile(p, i + 1)),
    activeProfileId: 'p-en',
  }));

  const handleActivate = (id: string) => setActiveId(id);
  const handleDelete = (id: string) => {
    const remaining = profiles.filter((p) => p.id !== id);
    setProfiles(remaining);
    if (activeId === id) setActiveId(remaining[0]?.id ?? null);
  };
  const handleMove = (id: string, dir: -1 | 1) => {
    const idx = profiles.findIndex((p) => p.id === id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= profiles.length) return;
    const copy = [...profiles];
    const [moved] = copy.splice(idx, 1);
    copy.splice(next, 0, moved);
    setProfiles(copy);
  };
  const handleAdd = (target: string, nativeOverride: string, copyFromActive: boolean) => {
    const nat = nativeOverride || universalNative;
    const name = `${langLabel(nat)} → ${langLabel(target)}`;
    const src = copyFromActive ? profiles.find((p) => p.id === activeId) : undefined;
    const p: MockProfile = {
      id: `p-${Date.now()}`,
      target,
      native: nativeOverride,
      name,
      subtitleOverlay: src?.subtitleOverlay ?? { autoLoad: true, asr: true, autoTranslate: true },
      dictPopup: src?.dictPopup ?? { enabled: true, trigger: 'click' },
      resources: src?.resources ?? 0,
    };
    setProfiles([...profiles, p]);
    setActiveId((prev) => prev ?? p.id);
  };
  const handleUpdate = (id: string, target: string, nativeOverride: string) => {
    const nat = nativeOverride || universalNative;
    setProfiles(
      profiles.map((p) =>
        p.id !== id
          ? p
          : { ...p, target, native: nativeOverride, name: `${langLabel(nat)} → ${langLabel(target)}` },
      ),
    );
  };

  const conceptProps = {
    profiles,
    activeId,
    universalNative,
    onActivate: handleActivate,
    onDelete: handleDelete,
    onMove: handleMove,
    onAdd: handleAdd,
    onUpdate: handleUpdate,
    onUniversalChange: setUniversalNative,
  };

  return (
      <ErrorBoundary>
        <div className="mlp-page">
          <header className="mlp-header">
            <h1 className="mlp-title">Language Profile — redesign</h1>
            <p className="mlp-subtitle">
              Current panel next to three popup-grammar variants. Try mobile vs desktop, light vs dark.
            </p>
            <div className="mlp-controls">
              <div className="mlp-seg" role="group" aria-label="Viewport">
                <button type="button" aria-pressed={viewport === 'mobile'} onClick={() => setViewport('mobile')}>
                  Mobile
                </button>
                <button type="button" aria-pressed={viewport === 'desktop'} onClick={() => setViewport('desktop')}>
                  Desktop
                </button>
              </div>
              <div className="mlp-seg" role="group" aria-label="Theme">
                <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>
                  Light
                </button>
                <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
                  Dark
                </button>
              </div>
            </div>
          </header>

          <main className="mlp-stage" data-viewport={viewport}>
            <section className="mlp-variant">
              <h2 className="mlp-variant-title">A — Current (production)</h2>
              <p className="mlp-variant-note">
                The shipped LanguageProfilePanel, live — same state wiring as the settings dialog.
              </p>
              <LanguageProfilePanel settings={panelSettings} onChange={setPanelSettings} />
            </section>

            <section className="mlp-variant" data-accent="fill">
              <h2 className="mlp-variant-title">B — Fill rows</h2>
              <p className="mlp-variant-note">
                Blue lives only in <strong>state fills</strong>: active row + check. Surfaces and
                chips stay neutral — one blue fill = one focal point. Journey: scan → tap → done.
              </p>
              <ConceptB {...conceptProps} />
            </section>

            <section className="mlp-variant" data-accent="outline">
              <h2 className="mlp-variant-title">C — Outline cards</h2>
              <p className="mlp-variant-note">
                Blue lives only in <strong>outlines</strong>: primary border + dot on the active
                card; cards keep their white elevated surface. Journey: compare → pick → done.
              </p>
              <ConceptC {...conceptProps} />
            </section>

            <section className="mlp-variant" data-accent="type">
              <h2 className="mlp-variant-title">D — Type &amp; rail</h2>
              <p className="mlp-variant-note">
                Blue lives only in <strong>typography + the left rail</strong> — accent name,
                check, 3px bar. No surface ever fills blue. Journey: skim → tap → done.
              </p>
              <ConceptD {...conceptProps} />
            </section>
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
