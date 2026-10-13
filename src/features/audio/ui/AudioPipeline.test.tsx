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
  it('renders a numbered node for each engine with connectors between them', () => {
    const { container } = render(
      <AudioPipeline
        engines={ENGINES}
        selected={null}
        statuses={STATUSES}
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getAllByRole('button')).toHaveLength(ENGINES.length);
    expect(screen.getAllByRole('listitem')).toHaveLength(ENGINES.length);
    ENGINES.forEach((_, i) => {
      expect(screen.getByRole('button', { name: new RegExp(`^${i + 1}\\.`) })).toBeInTheDocument();
    });
    const leads = container.querySelectorAll('[class*="lead"]');
    expect(leads).toHaveLength(ENGINES.length * 2);
    const hidden = [...leads].filter((l) => (l as HTMLElement).style.visibility === 'hidden');
    expect(hidden).toHaveLength(2);
  });

  it('labels alternate below/above the rail', () => {
    render(
      <AudioPipeline
        engines={ENGINES}
        selected={null}
        statuses={STATUSES}
        onSelect={jest.fn()}
      />,
    );

    const items = screen.getAllByRole('listitem');
    items.forEach((item, i) => {
      const slots = [...item.querySelectorAll('[class*="slot"]')];
      const filled = slots.findIndex((s) => s.childElementCount > 0);
      expect(filled).toBe(i % 2 === 1 ? 0 : 1);
    });
  });

  it('marks the selected node with aria-pressed', () => {
    render(
      <AudioPipeline
        engines={ENGINES}
        selected="native"
        statuses={STATUSES}
        onSelect={jest.fn()}
      />,
    );

    const selectedButton = screen.getByRole('button', { pressed: true });
    expect(selectedButton).toHaveTextContent('2');
    expect(selectedButton).toHaveAttribute('aria-pressed', 'true');
    expect(selectedButton).toHaveClass('selected');
    expect(screen.getByText('Community audio')).toBeInTheDocument();

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

    fireEvent.click(screen.getByRole('button', { name: '4. Browser voice (ready)' }));
    expect(onSelect).toHaveBeenCalledWith('browserTts');
  });
});
