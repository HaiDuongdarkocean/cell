import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PronunciationPanel } from './PronunciationPanel';
import { resolvePhonemeAudio } from '../services/phonemePackAudio';
import { playPhoneme } from '../services/phonemeAudioPlayer';
import type { PronunciationResult } from '../types';

jest.mock('../services/phonemePackAudio', () => ({
  resolvePhonemeAudio: jest.fn(),
}));

jest.mock('../services/phonemeAudioPlayer', () => ({
  playPhoneme: jest.fn(() => Promise.resolve()),
}));

const mockedSynth = jest.mocked(resolvePhonemeAudio);
const mockedPlay = jest.mocked(playPhoneme);

function makeResult(language: string): PronunciationResult {
  return {
    text: 'test',
    language,
    ipa: 'tˈest',
    phonemes: [
      { ipa: 't', startMs: 0, endMs: 50, type: 'consonant' },
      { ipa: 'ˈ', startMs: 50, endMs: 50, type: 'stress' },
      { ipa: 'e', startMs: 50, endMs: 120, type: 'vowel' },
      { ipa: 's', startMs: 120, endMs: 200, type: 'consonant' },
      { ipa: 't', startMs: 200, endMs: 250, type: 'consonant' },
    ],
    audio: null,
    metadata: { engine: 'espeak-phonemes', engineVersion: '0.0.5', source: 'espeak' },
  };
}

const PHONEME_CLIP = {
  samples: new Float32Array(2205),
  sampleRate: 22050,
  source: 'espeak' as const,
  duration: 0.1,
};

beforeEach(() => {
  mockedSynth.mockReset().mockResolvedValue(PHONEME_CLIP);
  mockedPlay.mockClear();
});

describe('PronunciationPanel phoneme playback', () => {
  it('synthesizes the clicked phoneme as an isolated eSpeak clip', async () => {
    render(<PronunciationPanel pronunciation={makeResult('en')} />);

    const chips = screen.getAllByTestId('pronunciation-phoneme');
    fireEvent.click(chips[0]!);

    await waitFor(() => expect(mockedSynth).toHaveBeenCalledWith('t', undefined, 'en'));
    await waitFor(() => expect(mockedPlay).toHaveBeenCalled());
    const [clip, phoneme] = mockedPlay.mock.calls[0]!;
    expect(clip).toBe(PHONEME_CLIP);
    expect(phoneme.startMs).toBe(0);
    expect(phoneme.endMs).toBe(100);
  });

  it('keeps silent feedback when the phoneme has no eSpeak clip', async () => {
    mockedSynth.mockResolvedValue(null);
    render(<PronunciationPanel pronunciation={makeResult('en')} />);

    const chips = screen.getAllByTestId('pronunciation-phoneme');
    fireEvent.click(chips[0]!);

    await waitFor(() => expect(mockedSynth).toHaveBeenCalled());
    expect(mockedPlay).not.toHaveBeenCalled();
    await waitFor(() => expect(chips[0]!.classList.contains('active')).toBe(false));
  });

  it('routes through the custom handler when provided', async () => {
    const onPlayPhoneme = jest.fn<(p: unknown) => Promise<void>>().mockResolvedValue();
    render(<PronunciationPanel pronunciation={makeResult('en')} onPlayPhoneme={onPlayPhoneme} />);

    const chips = screen.getAllByTestId('pronunciation-phoneme');
    fireEvent.click(chips[0]!);

    await waitFor(() => expect(onPlayPhoneme).toHaveBeenCalled());
    expect(mockedSynth).not.toHaveBeenCalled();
  });

  it('does not synthesize for non-English results', async () => {
    render(<PronunciationPanel pronunciation={makeResult('zh')} />);

    const chips = screen.getAllByTestId('pronunciation-phoneme');
    fireEvent.click(chips[0]!);

    await new Promise((r) => setTimeout(r, 250));
    expect(mockedSynth).not.toHaveBeenCalled();
    expect(mockedPlay).not.toHaveBeenCalled();
  });
});
