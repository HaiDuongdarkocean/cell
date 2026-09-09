/**
 * Card Creator test app — standalone React app to render the Card Creator
 * dialog + settings panel for UI testing via edge-devtools MCP.
 *
 * Mock context: no real AnkiConnect (offline), mock video element, rich
 * prefill data + synthetic media so the dialog opens fully populated. The
 * dialog will show "Failed to load from AnkiConnect" alert — that's expected
 * and lets us test the error state + that the dialog renders with overflow.
 */
import { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '@/shared/styles/document.css';
import { CardCreatorDialog } from '@/features/cardCreator/ui/CardCreatorDialog';
import { CardCreatorBottomSheet } from '@/features/cardCreator/ui/CardCreatorBottomSheet';
import { CardCreatorSettingsPanel } from '@/features/settings/ui/CardCreatorSettingsPanel';
import { useCardCreatorStore } from '@/stores/cardCreatorStore';
import type { CardCreatorSettings } from '@/entities/settings';
import type { BilingualCue } from '@/entities/media';
import type { CardCreatorOpenContext, CardCreatorPrefill } from '@/features/cardCreator/types';
import type { MediaFile } from '@/features/cardCreator/media/mediaFile';

const DEFAULT_SETTINGS: CardCreatorSettings = {
  ankiConnectUrl: 'http://localhost:8765',
  defaultDeck: 'Default',
  defaultNoteType: 'Cell Video Card',
  defaultTags: 'english vocabulary advanced long-sentence test overflow stress-test card-creator ui-audit',
  mediaUpdateMode: 'overwrite',
};

/** Mock 10 note types + 10 decks to stress-test the destination dropdowns. */
const MOCK_NOTE_TYPES = [
  'Cell Video Card',
  'Basic',
  'Cloze',
  'Vocabulary Mining',
  'Sentence Mining with Audio',
  'Listening Comprehension Card Type',
  'Reading + Listening',
  'Minimal',
  'Advanced Grammar Patterns',
  'Example-Definition-Image-Audio',
];

const MOCK_DECKS = [
  'Default',
  'Vocabulary',
  'Sentences',
  'Listening Practice Deck',
  'Reading Comprehension',
  'Core 6000',
  'Grammar Points',
  'Review Queue',
  'Immersion Mining 2026',
  'Subtitled Content - TV Shows and Movies',
];

const MOCK_FIELDS = [
  'Front',
  'Back',
  'Definitions',
  'Image',
  'SentenceAudio',
  'WordAudio',
  'Note',
  'MoreExample',
  'Tags',
  'Extra',
];

const MOCK_CUE: BilingualCue = {
  index: 42,
  start: 1564000,
  end: 1568000,
  targetText: 'The quick brown fox jumps over the lazy dog while the sun sets behind the mountains and the birds sing their evening songs.',
  nativeText: 'Con cáo nâu nhanh nhảy qua con chó lười trong khi mặt trời lặn sau dãy núi và những con chim hót bài ca chiều tà của chúng.',
};

const TARGET_WORD = 'supercalifragilisticexpialidocious';

const MOCK_PREFILL: CardCreatorPrefill = {
  targetWord: TARGET_WORD,
  sentence: 'The quick brown fox jumps over the lazy dog while the sun sets behind the mountains and the birds sing their evening songs.',
  sentenceTranslation: 'Con cáo nâu nhanh nhảy qua con chó lười trong khi mặt trời lặn sau dãy núi và những con chim hót bài ca chiều tà của chúng.',
  definitions: [
    'A nonsense word from the song in Mary Poppins, often used to express extraordinary delight or as a playful example of a very long word.',
    'In popular usage, something so good or wonderful that no ordinary word can describe it.',
    'A favorite test string for typography, search, and UI overflow because it is unusually long.',
    'Does not appear in standard dictionaries, but is recognized as a coined word with a positive, whimsical connotation.',
    'Useful for stress-testing form inputs and card previews with excessive character counts.',
  ].join('\n'),
  note: 'This is a personal note that keeps going and going because the user wanted to see what happens when the Card Creator is filled with excessive information, so I am typing a very long note here to make sure the layout breaks or adapts in a way we can observe and fix later.',
  moreExample: [
    'Example 1: The fox jumped over the dog.',
    'Example 2: The dog was lazy but the fox was quick.',
    'Example 3: Birds sang while the sun set behind the mountains.',
    'Example 4: No one could forget the beautiful evening scene.',
    'Example 5: The memory was etched into their minds forever and ever and ever.',
  ].join('\n'),
};

/** Minimal 1x1 red PNG as a base64 string. */
const RED_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function pngFromBase64(filename: string): MediaFile {
  const binary = atob(RED_PNG_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { kind: 'image', filename, mimeType: 'image/png', data: bytes.buffer };
}

/** Build a short silent mono WAV MediaFile for the mock. */
function silentWav(filename: string, sampleCount = 100): MediaFile {
  const dataSize = sampleCount;
  const fileSize = 36 + dataSize;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset: number, str: string): void => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  writeString(0, 'RIFF');
  view.setUint32(4, fileSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  const bytes = new Uint8Array(buffer, 44);
  bytes.fill(0x80);
  return { kind: 'audio', filename, mimeType: 'audio/wav', data: buffer };
}

const MOCK_INITIAL_MEDIA: MediaFile[] = [
  pngFromBase64('mock-image-01.png'),
  pngFromBase64('mock-image-02.png'),
  pngFromBase64('mock-image-03.png'),
  pngFromBase64('mock-image-04.png'),
  pngFromBase64('mock-image-05.png'),
  pngFromBase64('mock-image-06.png'),
  silentWav('mock-sentence-audio-01.wav'),
  silentWav('mock-sentence-audio-02.wav'),
  silentWav('mock-sentence-audio-03.wav'),
];

function useMockOpenContext(videoRef: React.RefObject<HTMLVideoElement | null>): CardCreatorOpenContext | null {
  const [openContext, setOpenContext] = useState<CardCreatorOpenContext | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;
    setOpenContext({
      video: videoRef.current,
      cue: MOCK_CUE,
      sourceLang: 'en',
      targetLang: 'vi',
      prefill: MOCK_PREFILL,
      initialMedia: MOCK_INITIAL_MEDIA,
    });
  }, [videoRef]);

  return openContext;
}

function TestApp(): React.JSX.Element {
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<CardCreatorSettings>(DEFAULT_SETTINGS);
  const [srsDestination, setSrsDestination] = useState<'anki' | 'ocean-srs'>('anki');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const videoRef = useRef<HTMLVideoElement>(null);
  const openContext = useMockOpenContext(videoRef);

  // Override the real AnkiConnect load with 10 note types + 10 decks + 10 fields
  // so the destination dropdowns and field mapping selects can be stress-tested.
  // The real fetch may finish late (or hang) and overwrite the mock state, so
  // this keep-alive override runs while the test app is mounted and only
  // restores lists/status — it does not reset an already-chosen note type/deck.
  useEffect(() => {
    if (!openContext) return;
    const store = useCardCreatorStore.getState();
    store.setDecks(MOCK_DECKS);
    store.setNoteTypes(MOCK_NOTE_TYPES);
    store.setAvailableFields(MOCK_FIELDS);
    store.setLoadStatus('ready');
    store.setLoadError('');
    store.setDraft((prev) => ({
      ...prev,
      noteType: MOCK_NOTE_TYPES[0] ?? prev.noteType,
      deck: MOCK_DECKS[0] ?? prev.deck,
    }));

    const keepAlive = () => {
      const s = useCardCreatorStore.getState();
      if (s.noteTypes.length !== MOCK_NOTE_TYPES.length || s.decks.length !== MOCK_DECKS.length) {
        s.setNoteTypes(MOCK_NOTE_TYPES);
        s.setDecks(MOCK_DECKS);
        s.setAvailableFields(MOCK_FIELDS);
        s.setLoadStatus('ready');
        s.setLoadError('');
      }
    };
    const interval = setInterval(keepAlive, 500);
    return () => { clearInterval(interval); };
  }, [openContext]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.body.setAttribute('data-theme', next);
  };

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
            srsDestination={srsDestination}
            onChange={(partial) => setSettings({ ...settings, ...partial })}
            onDestinationChange={setSrsDestination}
          />
        </div>
      )}

      {/* Wire up the control buttons from the HTML */}
      <ButtonWire id="open-desktop" onClick={() => setDesktopOpen(true)} />
      <ButtonWire id="open-mobile" onClick={() => setMobileOpen(true)} />
      <ButtonWire id="open-settings" onClick={() => setSettingsOpen((v) => !v)} />
      <ButtonWire id="toggle-theme" onClick={toggleTheme} />
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
