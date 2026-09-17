import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComprehensionStats } from '@/entities/comprehension';
import type { ComprehensionState } from '@/features/tokenize/services/comprehensionStore';
import { ComprehensionPill } from './ComprehensionPill';
import { ComprehensionBadge } from './ComprehensionBadge';

function stats(kind: 'media' | 'text', coverage: number): ComprehensionStats {
  return {
    kind,
    totalTokens: 100,
    knownTokens: coverage,
    trackingTokens: 0,
    unknownTokens: 100 - coverage,
    coverage,
    band: coverage >= (kind === 'media' ? 95 : 98) ? 'comfortable' : 'hard',
    newTerms: 5,
  };
}

function state(partial: Partial<ComprehensionState>): ComprehensionState {
  return { media: null, text: null, active: 'media', ...partial };
}

describe('ComprehensionPill', () => {
  it('renders nothing when both stats are null', () => {
    const { container } = render(<ComprehensionPill state={state({})} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows media stats by default with media icon', () => {
    render(<ComprehensionPill state={state({ media: stats('media', 96) })} />);
    expect(screen.getByText('96%')).toBeInTheDocument();
  });

  it('falls back to text when active media is missing', () => {
    render(<ComprehensionPill state={state({ text: stats('text', 99) })} />);
    expect(screen.getByText('99%')).toBeInTheDocument();
  });

  it('renders toggle when both stats exist; click selects text', () => {
    const onSelect = jest.fn();
    render(
      <ComprehensionPill
        state={state({ media: stats('media', 96), text: stats('text', 99) })}
        onSelect={onSelect}
      />,
    );
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(screen.getByText('96%')).toBeInTheDocument();
    fireEvent.click(radios[1]!);
    expect(onSelect).toHaveBeenCalledWith('text');
  });

  it('shows text stats when active is text', () => {
    render(
      <ComprehensionPill
        state={state({ media: stats('media', 96), text: stats('text', 99), active: 'text' })}
      />,
    );
    expect(screen.getByText('99%')).toBeInTheDocument();
  });
});

describe('ComprehensionBadge', () => {
  it('renders coverage with band data attribute', () => {
    render(<ComprehensionBadge stats={stats('media', 96)} />);
    const el = screen.getByText('96%');
    expect(el).toHaveAttribute('data-band', 'comfortable');
  });
});
