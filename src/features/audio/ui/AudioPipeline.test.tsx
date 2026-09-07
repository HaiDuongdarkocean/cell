import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { AudioPipeline } from './AudioPipeline';
import type { AudioEngineKind } from '@/entities/settings/types';

const ENGINES: AudioEngineKind[] = [
  'localFile',
  'native',
  'supertonic',
  'browserTts',
  'espeak',
];

const STATUSES: Record<AudioEngineKind, 'ready' | 'missing' | 'disabled'> = {
  localFile: 'ready',
  native: 'missing',
  supertonic: 'disabled',
  browserTts: 'ready',
  espeak: 'missing',
};

describe('AudioPipeline', () => {
  it('renders a button for each engine with arrows between steps', () => {
    render(
      <AudioPipeline
        engines={ENGINES}
        selected={null}
        statuses={STATUSES}
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(ENGINES.length);
    expect(screen.getAllByText('→')).toHaveLength(ENGINES.length - 1);
  });

  it('marks the selected step with aria-pressed and a primary border', () => {
    render(
      <AudioPipeline
        engines={ENGINES}
        selected="native"
        statuses={STATUSES}
        onSelect={jest.fn()}
      />,
    );

    const selectedButton = screen.getByRole('button', { pressed: true });
    expect(selectedButton).toHaveTextContent('Community audio (Wikimedia)');
    expect(selectedButton).toHaveAttribute('aria-pressed', 'true');
    expect(selectedButton).toHaveClass('selected');

    const unselected = screen.getAllByRole('button', { pressed: false });
    expect(unselected).toHaveLength(ENGINES.length - 1);
  });

  it('calls onSelect with the clicked engine', () => {
    const onSelect = jest.fn();
    render(
      <AudioPipeline
        engines={ENGINES}
        selected={null}
        statuses={STATUSES}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Browser speech (ready)' }));
    expect(onSelect).toHaveBeenCalledWith('browserTts');
  });
});
