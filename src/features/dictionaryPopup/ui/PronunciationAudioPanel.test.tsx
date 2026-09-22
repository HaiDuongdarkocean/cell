import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { PronunciationAudioPanel } from './PronunciationAudioPanel';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { AudioItem } from '@/entities/dictionary';

jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  sendMessage: jest.fn(async () => ({ success: true })),
}));

const mockSendMessage = jest.mocked(sendMessage);

const audioPlaySpy = (): { constructed: string[]; plays: number; restore: () => void } => {
  const rec = { constructed: [] as string[], plays: 0 };
  const Orig = window.Audio;
  (window as unknown as { Audio: typeof Audio }).Audio = class extends Orig {
    constructor(url?: string) {
      super(url);
      rec.constructed.push(String(url));
      const origPlay = this.play.bind(this);
      this.play = (): Promise<void> => { rec.plays += 1; return origPlay().catch(() => undefined); };
    }
  } as typeof Audio;
  return {
    constructed: rec.constructed,
    get plays() { return rec.plays; },
    restore: () => { (window as unknown as { Audio: typeof Audio }).Audio = Orig; },
  };
};

function makeAudio(id: string, kind: AudioItem['kind'], label: string, url?: string, selected = false): AudioItem {
  return {
    id,
    kind,
    label,
    url,
    source: 'community',
    state: url ? 'idle' : 'error',
    defaultSelected: selected,
  };
}

const selection = (entries: [string, boolean][]) => new Map(entries);

const baseProps = {
  loading: false,
  selection: new Map() as Map<string, boolean>,
  onToggle: jest.fn(),
  onTtsWord: jest.fn(),
  onTtsSentence: jest.fn(),
  term: 'hello',
  sentence: 'hello world',
};

describe('PronunciationAudioPanel', () => {
  it('renders a skeleton while loading', () => {
    render(
      <PronunciationAudioPanel
        {...baseProps}
        items={[]}
        loading
      />,
    );

    const panel = screen.getByTestId('dictionary-audio-panel');
    expect(panel.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('renders TTS fallback item when no real audio items', () => {
    render(
      <PronunciationAudioPanel
        {...baseProps}
        items={[]}
      />,
    );

    const panel = screen.getByTestId('dictionary-audio-panel');
    // TTS item label: "hello · TTS"
    expect(within(panel).getByText('hello')).toBeInTheDocument();
    expect(within(panel).getByText('TTS')).toBeInTheDocument();
  });

  it('triggers onTtsWord when clicking play on TTS word fallback item', () => {
    const onTtsWord = jest.fn();
    render(
      <PronunciationAudioPanel
        {...baseProps}
        items={[]}
        onTtsWord={onTtsWord}
      />,
    );

    const panel = screen.getByTestId('dictionary-audio-panel');
    const playBtn = within(panel).getByRole('button', { name: /Play .+ TTS/i });
    fireEvent.click(playBtn);
    expect(onTtsWord).toHaveBeenCalled();
  });

  it('triggers onTtsSentence when clicking play on TTS sentence fallback item', () => {
    const onTtsSentence = jest.fn();
    render(
      <PronunciationAudioPanel
        {...baseProps}
        items={[]}
        onTtsSentence={onTtsSentence}
      />,
    );

    const panel = screen.getByTestId('dictionary-audio-panel');
    fireEvent.click(within(panel).getByRole('tab', { name: /Play sentence/i }));
    const playBtn = within(panel).getByRole('button', { name: /Play .+ TTS/i });
    fireEvent.click(playBtn);
    expect(onTtsSentence).toHaveBeenCalled();
  });

  it('renders word audio items by default and toggles selection via the checkbox', () => {
    const onToggle = jest.fn();
    const item = makeAudio('a1', 'word', 'Test · forvo', 'https://audio/1');
    render(
      <PronunciationAudioPanel
        {...baseProps}
        items={[item]}
        selection={selection([['a1', false]])}
        onToggle={onToggle}
      />,
    );

    const panel = screen.getByTestId('dictionary-audio-panel');
    expect(within(panel).getByText('Test')).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledWith('a1', true);
  });

  it('renders the label as plain text — the row plays, the check box selects', () => {
    const item = makeAudio('a1', 'word', 'Test · forvo', 'https://audio/1');
    render(
      <PronunciationAudioPanel
        {...baseProps}
        items={[item]}
        selection={selection([['a1', true]])}
      />,
    );

    const panel = screen.getByTestId('dictionary-audio-panel');
    expect(within(panel).getByText('Test').closest('button')).toBeNull();

    const box = within(panel).getByRole('checkbox');
    expect(box).toHaveAttribute('aria-checked', 'true');
  });

  it('plays the item when clicking the row or the label', () => {
    const spy = audioPlaySpy();
    try {
      const onToggle = jest.fn();
      const item = makeAudio('a1', 'word', 'Test · forvo', 'https://audio/1');
      render(
        <PronunciationAudioPanel
          {...baseProps}
          items={[item]}
          selection={selection([['a1', false]])}
          onToggle={onToggle}
        />,
      );

      const panel = screen.getByTestId('dictionary-audio-panel');
      fireEvent.click(within(panel).getByText('Test'));
      expect(spy.constructed).toEqual(['https://audio/1']);
      expect(onToggle).not.toHaveBeenCalled();

      fireEvent.click(within(panel).getByRole('button', { name: /Play Test · forvo/i }));
      expect(spy.constructed.length).toBe(2);
    } finally {
      spy.restore();
    }
  });

  it('does not toggle selection when clicking the row play button', () => {
    const spy = audioPlaySpy();
    try {
      const onToggle = jest.fn();
      const item = makeAudio('a1', 'word', 'Test · forvo', 'https://audio/1');
      render(
        <PronunciationAudioPanel
          {...baseProps}
          items={[item]}
          selection={selection([['a1', false]])}
          onToggle={onToggle}
        />,
      );

      const panel = screen.getByTestId('dictionary-audio-panel');
      fireEvent.click(within(panel).getByRole('button', { name: /Play Test · forvo/i }));
      expect(onToggle).not.toHaveBeenCalled();
      expect(spy.constructed).toEqual(['https://audio/1']);
    } finally {
      spy.restore();
    }
  });

  it('plays on Space/Enter from the row and toggles from the checkbox', () => {
    const spy = audioPlaySpy();
    try {
      const onToggle = jest.fn();
      const item = makeAudio('a1', 'word', 'Test · forvo', 'https://audio/1');
      render(
        <PronunciationAudioPanel
          {...baseProps}
          items={[item]}
          selection={selection([['a1', false]])}
          onToggle={onToggle}
        />,
      );

      const panel = screen.getByTestId('dictionary-audio-panel');
      const box = within(panel).getByRole('checkbox');
      fireEvent.keyDown(box, { key: ' ' });
      expect(onToggle).toHaveBeenCalledWith('a1', true);

      const row = within(panel).getByRole('button', { name: /Play Test · forvo/i });
      fireEvent.keyDown(row, { key: 'Enter' });
      expect(spy.constructed.length).toBeGreaterThanOrEqual(1);
    } finally {
      spy.restore();
    }
  });

  it('switches to sentence audio group and renders sentence items', () => {
    const word = makeAudio('w1', 'word', 'Word', 'https://audio/w1');
    const sentence = makeAudio('s1', 'sentence', 'Sentence', 'https://audio/s1');

    render(
      <PronunciationAudioPanel
        {...baseProps}
        items={[word, sentence]}
      />,
    );

    const panel = screen.getByTestId('dictionary-audio-panel');
    fireEvent.click(within(panel).getByRole('tab', { name: /Play sentence/i }));

    expect(within(panel).getByText('Sentence')).toBeInTheDocument();
    expect(within(panel).queryByText('Word')).not.toBeInTheDocument();
  });

  it('shows TTS fallback when switching to a group with no items', () => {
    const word = makeAudio('w1', 'word', 'Word', 'https://audio/w1');
    render(
      <PronunciationAudioPanel
        {...baseProps}
        items={[word]}
      />,
    );

    const panel = screen.getByTestId('dictionary-audio-panel');
    fireEvent.click(within(panel).getByRole('tab', { name: /Play sentence/i }));

    // TTS fallback for sentence: "hello world · TTS"
    expect(within(panel).getByText('hello world')).toBeInTheDocument();
    expect(within(panel).getByText('TTS')).toBeInTheDocument();
  });

  it('shows a reconnect hint and asks background to open the Cell page', () => {
    mockSendMessage.mockClear();
    render(
      <PronunciationAudioPanel
        {...baseProps}
        items={[]}
        localAudioNeedsRegrant
      />,
    );

    const hint = screen.getByTestId('local-audio-reconnect');
    fireEvent.click(hint);
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: MESSAGE_TYPES.LOCAL_AUDIO_OPEN_RECONNECT,
      payload: {},
    });
  });

  it('hides the reconnect hint when local audio does not need it', () => {
    render(
      <PronunciationAudioPanel
        {...baseProps}
        items={[]}
      />,
    );

    expect(screen.queryByTestId('local-audio-reconnect')).not.toBeInTheDocument();
  });
});
