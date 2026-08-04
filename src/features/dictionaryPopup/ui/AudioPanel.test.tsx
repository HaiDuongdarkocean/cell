import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { AudioPanel } from './AudioPanel';
import type { AudioItem } from '../types';

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

describe('AudioPanel', () => {
  it('renders a skeleton while loading', () => {
    render(
      <AudioPanel
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
      <AudioPanel
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
      <AudioPanel
        {...baseProps}
        items={[]}
        onTtsWord={onTtsWord}
      />,
    );

    const panel = screen.getByTestId('dictionary-audio-panel');
    const playBtn = within(panel).getByRole('button', { name: /Play TTS/i });
    fireEvent.click(playBtn);
    expect(onTtsWord).toHaveBeenCalled();
  });

  it('triggers onTtsSentence when clicking play on TTS sentence fallback item', () => {
    const onTtsSentence = jest.fn();
    render(
      <AudioPanel
        {...baseProps}
        items={[]}
        onTtsSentence={onTtsSentence}
      />,
    );

    const panel = screen.getByTestId('dictionary-audio-panel');
    fireEvent.click(within(panel).getByRole('tab', { name: /Play sentence/i }));
    const playBtn = within(panel).getByRole('button', { name: /Play TTS/i });
    fireEvent.click(playBtn);
    expect(onTtsSentence).toHaveBeenCalled();
  });

  it('renders word audio items by default and toggles selection', () => {
    const onToggle = jest.fn();
    const item = makeAudio('a1', 'word', 'Test · forvo', 'https://audio/1');
    render(
      <AudioPanel
        {...baseProps}
        items={[item]}
        selection={selection([['a1', false]])}
        onToggle={onToggle}
      />,
    );

    const panel = screen.getByTestId('dictionary-audio-panel');
    expect(within(panel).getByText('Test')).toBeInTheDocument();

    fireEvent.click(within(panel).getByText('Test'));
    expect(onToggle).toHaveBeenCalledWith('a1', true);
  });

  it('switches to sentence audio group and renders sentence items', () => {
    const word = makeAudio('w1', 'word', 'Word', 'https://audio/w1');
    const sentence = makeAudio('s1', 'sentence', 'Sentence', 'https://audio/s1');

    render(
      <AudioPanel
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
      <AudioPanel
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
});
