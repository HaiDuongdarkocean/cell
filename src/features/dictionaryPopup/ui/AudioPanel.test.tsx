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

describe('AudioPanel', () => {
  it('renders a skeleton while loading', () => {
    render(
      <AudioPanel
        items={[]}
        loading
        selection={new Map()}
        onToggle={jest.fn()}
        onTts={jest.fn()}
      />,
    );

    const panel = screen.getByTestId('dictionary-audio-panel');
    expect(panel.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('auto-falls back to TTS when no audio items found', () => {
    const onTts = jest.fn();
    render(
      <AudioPanel
        items={[]}
        loading={false}
        selection={new Map()}
        onToggle={jest.fn()}
        onTts={onTts}
      />,
    );

    expect(onTts).toHaveBeenCalled();
  });

  it('renders word audio items by default and toggles selection', () => {
    const onToggle = jest.fn();
    const item = makeAudio('a1', 'word', 'Test · forvo', 'https://audio/1');
    render(
      <AudioPanel
        items={[item]}
        loading={false}
        selection={selection([['a1', false]])}
        onToggle={onToggle}
        onTts={jest.fn()}
      />,
    );

    const panel = screen.getByTestId('dictionary-audio-panel');
    expect(within(panel).getByText('Test')).toBeInTheDocument();

    const label = within(panel).getByText('Test');
    fireEvent.click(label);
    expect(onToggle).toHaveBeenCalledWith('a1', true);
  });

  it('switches to sentence audio group and renders sentence items', () => {
    const word = makeAudio('w1', 'word', 'Word', 'https://audio/w1');
    const sentence = makeAudio('s1', 'sentence', 'Sentence', 'https://audio/s1');

    render(
      <AudioPanel
        items={[word, sentence]}
        loading={false}
        selection={new Map()}
        onToggle={jest.fn()}
        onTts={jest.fn()}
      />,
    );

    const panel = screen.getByTestId('dictionary-audio-panel');
    const sentenceTab = within(panel).getByRole('tab', { name: /Play sentence/i });
    fireEvent.click(sentenceTab);

    expect(within(panel).getByText('Sentence')).toBeInTheDocument();
    expect(within(panel).queryByText('Word')).not.toBeInTheDocument();
  });
});
