import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import type { TtsSettings } from '@/entities/settings/types';
import { BrowserVoicePanel } from './BrowserVoicePanel';
import { createTtsEngine } from '@/features/tts';

const VOICES = [
  { voiceName: 'Microsoft Aria Online (Natural) - English (United States)', lang: 'en-US' },
  { voiceName: 'Google UK English Female', lang: 'en-GB' },
  { voiceName: 'Google Tiếng Việt', lang: 'vi-VN' },
  { voiceName: 'Google 日本語', lang: 'ja-JP' },
];

jest.mock('@/features/tts', () => {
  const engine = {
    getVoices: () => Promise.resolve(VOICES),
    speak: jest.fn((_text: string, _opts: unknown) => Promise.resolve()),
    stop: () => undefined,
  };
  return { createTtsEngine: () => engine };
});

const speakMock = createTtsEngine().speak;

function makeTts(overrides: Partial<TtsSettings> = {}): TtsSettings {
  return {
    enabled: true,
    savedVoices: [],
    voices: [],
    maxDisplay: 3,
    autoplayCount: 0,
    preferredAccent: 'US',
    localTtsEnabled: false,
    localTtsLanguage: 'en',
    downloadedLanguages: [],
    hiddenLanguages: [],
    ...overrides,
  };
}

function Harness({
  initial = {},
  targetLang = 'en',
  onChangeSpy,
}: {
  initial?: Partial<TtsSettings>;
  targetLang?: string;
  onChangeSpy?: (tts: TtsSettings) => void;
}) {
  const [settings, setSettings] = useState<TtsSettings>(makeTts(initial));
  return (
    <BrowserVoicePanel
      settings={settings}
      onChange={(next) => {
        onChangeSpy?.(next);
        setSettings(next);
      }}
      targetLang={targetLang}
    />
  );
}

describe('BrowserVoicePanel', () => {
  it('filters the voice list to the target language prefix', async () => {
    render(<Harness targetLang="en" />);

    expect(await screen.findByText(/Aria/)).toBeInTheDocument();
    expect(screen.getByText('Google UK English Female')).toBeInTheDocument();
    expect(screen.queryByText('Google Tiếng Việt')).not.toBeInTheDocument();
    expect(screen.queryByText('Google 日本語')).not.toBeInTheDocument();
  });

  it('falls back to all voices when the target language has no match', async () => {
    render(<Harness targetLang="ko" />);

    expect(await screen.findByText(/Aria/)).toBeInTheDocument();
    expect(screen.getByText('Google Tiếng Việt')).toBeInTheDocument();
    expect(screen.getByText('Google 日本語')).toBeInTheDocument();
  });

  it('assigns tapped voices to the next free slot and auto-saves', async () => {
    const onChangeSpy = jest.fn();
    render(<Harness onChangeSpy={onChangeSpy} />);

    fireEvent.click(await screen.findByTestId(`voice-row-${VOICES[0].voiceName}`));
    expect(onChangeSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ voices: [VOICES[0].voiceName] }),
    );
    expect(screen.getByText('1 of 3 voices picked')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId(`voice-row-${VOICES[1].voiceName}`));
    expect(onChangeSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ voices: [VOICES[0].voiceName, VOICES[1].voiceName] }),
    );
    expect(screen.getByText('2 of 3 voices picked')).toBeInTheDocument();
  });

  it('removes a picked voice when tapped again', async () => {
    const onChangeSpy = jest.fn();
    render(<Harness initial={{ voices: [VOICES[0].voiceName] }} onChangeSpy={onChangeSpy} />);

    const ariaRow = await screen.findByTestId(`voice-row-${VOICES[0].voiceName}`);
    expect(ariaRow).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(ariaRow);
    expect(onChangeSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ voices: [] }),
    );
  });

  it('shows the full hint and does not save when all 3 slots are taken', async () => {
    const onChangeSpy = jest.fn();
    render(
      <Harness
        initial={{ voices: ['V1', 'V2', 'V3'] }}
        onChangeSpy={onChangeSpy}
      />,
    );

    fireEvent.click(await screen.findByTestId(`voice-row-${VOICES[0].voiceName}`));

    expect(onChangeSpy).not.toHaveBeenCalled();
    expect(
      screen.getByText('All 3 voices are picked — remove one first.'),
    ).toBeInTheDocument();
  });

  it('previews a voice without assigning it', async () => {
    const onChangeSpy = jest.fn();
    render(<Harness onChangeSpy={onChangeSpy} />);

    fireEvent.click(
      await screen.findByLabelText('Play Aria English (United States)'),
    );

    await waitFor(() =>
      expect(speakMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ voiceName: VOICES[0].voiceName, langCode: 'en-US' }),
      ),
    );
    expect(onChangeSpy).not.toHaveBeenCalled();
  });
});
