/**
 * Card Creator test app — standalone React app to render the Card Creator
 * dialog + settings panel for UI testing via edge-devtools MCP.
 *
 * Mock context: no real AnkiConnect (offline), mock video element, mock cue.
 * The dialog will show "Failed to load from AnkiConnect" alert — that's
 * expected and lets us test the error state + that the dialog renders.
 */
import { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import '@/shared/styles/tokens.css';
import { CardCreatorDialog } from '@/features/cardCreator/ui/CardCreatorDialog';
import { CardCreatorBottomSheet } from '@/features/cardCreator/ui/CardCreatorBottomSheet';
import { CardCreatorSettingsPanel } from '@/features/settings/ui/CardCreatorSettingsPanel';
import type { CardCreatorSettings } from '@/entities/settings';
import type { BilingualCue } from '@/entities/media';

const DEFAULT_SETTINGS: CardCreatorSettings = {
  ankiConnectUrl: 'http://localhost:8765',
  defaultDeck: 'Default',
  defaultNoteType: 'Cell Video Card',
  defaultTags: '',
  mediaUpdateMode: 'overwrite',
};

const MOCK_CUE: BilingualCue = {
  index: 42,
  start: 1564000,
  end: 1568000,
  targetText: "This is the target sentence.",
  nativeText: "Đây là câu mục tiêu.",
};

function TestApp(): React.JSX.Element {
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<CardCreatorSettings>(DEFAULT_SETTINGS);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const videoRef = useRef<HTMLVideoElement>(null);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.body.setAttribute('data-theme', next);
  };

  // Hidden video element for media capture context (screenshot/audio).
  // In real usage this is the page's video; here it's a placeholder so the
  // dialog can open. Screenshot/audio capture will fail gracefully.
  const openContext = videoRef.current
    ? { video: videoRef.current, cue: MOCK_CUE, sourceLang: 'en', targetLang: 'vi' }
    : null;

  return (
    <>
      {/* Hidden video for capture context */}
      <video ref={videoRef} style={{ display: 'none' }} data-cell-id="mock-video" />

      {/* Desktop dialog */}
      <CardCreatorDialog
        open={desktopOpen}
        onOpenChange={setDesktopOpen}
        settings={settings}
        openContext={openContext}
      />

      {/* Mobile bottom sheet */}
      <CardCreatorBottomSheet
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        settings={settings}
        openContext={openContext}
      />

      {/* Settings panel (Card Creator section only) */}
      {settingsOpen && (
        <div style={{ maxWidth: 'calc(var(--space-5) * 24)', margin: '0 auto', padding: 'var(--space-4)' }}>
          <CardCreatorSettingsPanel
            settings={settings}
            onChange={(partial) => setSettings({ ...settings, ...partial })}
          />
        </div>
      )}

      {/* Wire up the control buttons from the HTML */}
      <ButtonWire
        id="open-desktop"
        onClick={() => setDesktopOpen(true)}
      />
      <ButtonWire
        id="open-mobile"
        onClick={() => setMobileOpen(true)}
      />
      <ButtonWire
        id="open-settings"
        onClick={() => setSettingsOpen((v) => !v)}
      />
      <ButtonWire
        id="toggle-theme"
        onClick={toggleTheme}
      />
    </>
  );
}

/** Wire an existing HTML button (by id) to an onClick handler. */
function ButtonWire({ id, onClick }: { id: string; onClick: () => void }): null {
  useState(() => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', onClick);
    return undefined;
  });
  return null;
}

document.body.setAttribute('data-theme', 'dark');
const root = createRoot(document.getElementById('root')!);
root.render(<TestApp />);
