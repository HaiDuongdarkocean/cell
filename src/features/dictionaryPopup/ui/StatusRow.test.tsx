// StatusRow — REQ-2/AC-3: the status pill only ever shows the 3 base statuses.
// Layout is [footprints | pill] + a standalone flashcard chip right of the group:
// the footprints chip toggles the user-owned tracking flag on any status and is
// only disabled when no handler is wired; the cards chip appears whenever
// SRS_TERM_CARDS reports ≥1 card for the term, regardless of status.

import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusRow } from './StatusRow';
import { DEFAULT_BAND_THRESHOLDS } from '@/shared/lib/frequencyBand';
import type { VariantFrequency, WordStatus } from '@/entities/dictionary';

function renderRow(
  status: WordStatus,
  options?: {
    srsCardCount?: number;
    withToggleTracking?: boolean;
    frequencies?: readonly VariantFrequency[];
    stars?: { readonly count: number; readonly source: string };
    frequencyDisplay?: 'stars' | 'rank';
  },
): { onCycle: jest.Mock; onToggleTracking: jest.Mock; onOpenSrsCards: jest.Mock } {
  const onCycle = jest.fn();
  const onToggleTracking = jest.fn();
  const onOpenSrsCards = jest.fn();
  render(
    <StatusRow
      status={status}
      onCycle={onCycle}
      onToggleTracking={options?.withToggleTracking === false ? undefined : onToggleTracking}
      srsCardCount={options?.srsCardCount}
      onOpenSrsCards={onOpenSrsCards}
      frequencies={options?.frequencies ?? []}
      stars={options?.stars}
      thresholds={DEFAULT_BAND_THRESHOLDS}
      frequencyDisplay={options?.frequencyDisplay}
    />,
  );
  return { onCycle, onToggleTracking, onOpenSrsCards };
}

describe('StatusRow segmented control', () => {
  it('renders the footprints chip for unknown — click toggles tracking on', () => {
    const { onCycle, onToggleTracking } = renderRow('unknown');

    expect(screen.getByTestId('dictionary-status-cycle')).toHaveTextContent('Unknown');
    const flag = screen.getByTestId('dictionary-status-flag');
    expect(flag).toBeEnabled();
    expect(flag.querySelector('svg')).not.toBeNull();

    fireEvent.click(flag);
    expect(onToggleTracking).toHaveBeenCalledTimes(1);
    expect(onCycle).not.toHaveBeenCalled();
  });

  it('renders an active footprints chip for tracking — click toggles tracking off', () => {
    const { onCycle, onToggleTracking } = renderRow('tracking');

    expect(screen.getByTestId('dictionary-status-cycle')).toHaveTextContent('Unknown');
    const flag = screen.getByTestId('dictionary-status-flag');
    expect(flag).toBeEnabled();

    fireEvent.click(flag);
    expect(onToggleTracking).toHaveBeenCalledTimes(1);
    expect(onCycle).not.toHaveBeenCalled();
  });

  it.each(['known', 'ignore'] as const)(
    'renders the footprints chip enabled for %s — click toggles tracking on',
    (status) => {
      const { onToggleTracking, onCycle } = renderRow(status);

      const flag = screen.getByTestId('dictionary-status-flag');
      expect(flag).toBeEnabled();

      fireEvent.click(flag);
      expect(onToggleTracking).toHaveBeenCalledTimes(1);
      expect(onCycle).not.toHaveBeenCalled();
    },
  );

  it('renders the footprints chip disabled only when no tracking handler is wired', () => {
    const { onToggleTracking } = renderRow('tracking', { withToggleTracking: false });

    const flag = screen.getByTestId('dictionary-status-flag');
    expect(flag).toBeDisabled();

    fireEvent.click(flag);
    expect(onToggleTracking).not.toHaveBeenCalled();
  });

  it.each(['unknown', 'tracking', 'known', 'ignore'] as const)(
    'renders no in-group srs segment for %s — cards live in the standalone chip',
    (status) => {
      renderRow(status, { srsCardCount: 2 });

      expect(screen.queryByTestId('dictionary-status-srs')).not.toBeInTheDocument();
    },
  );

  it.each(['unknown', 'tracking', 'known', 'ignore'] as const)(
    'renders the cards chip for %s when srsCardCount > 0 — click calls onOpenSrsCards',
    (status) => {
      const { onCycle, onOpenSrsCards } = renderRow(status, { srsCardCount: 3 });

      const chip = screen.getByTestId('dictionary-srs-cards');
      expect(chip).toBeEnabled();
      expect(chip).toHaveAccessibleName('View 3 cards in SRS');
      expect(chip.querySelector('svg')).not.toBeNull();

      fireEvent.click(chip);
      expect(onOpenSrsCards).toHaveBeenCalledTimes(1);
      expect(onCycle).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, 0])(
    'renders no cards chip when srsCardCount is %s',
    (srsCardCount) => {
      renderRow('tracking', { srsCardCount });

      expect(screen.queryByTestId('dictionary-srs-cards')).not.toBeInTheDocument();
    },
  );

  it.each(['unknown', 'tracking', 'known', 'ignore'] as const)(
    'base pill click calls onCycle for status %s',
    (status) => {
      const { onCycle } = renderRow(status);

      fireEvent.click(screen.getByTestId('dictionary-status-cycle'));

      expect(onCycle).toHaveBeenCalledTimes(1);
    },
  );
});

describe('StatusRow frequency chips', () => {
  const freqs = [{ source: 'COCA', rank: 4500 }] as const;

  it("stars mode converts rank lists to ★ chips via band thresholds", () => {
    renderRow('unknown', { frequencies: freqs, frequencyDisplay: 'stars' });

    // rank 4500 → 'common' band → 4 stars
    const chips = screen.getAllByTestId('dictionary-stars');
    expect(chips).toHaveLength(1);
    expect(chips[0]).toHaveTextContent('COCA');
    expect(chips[0]).toHaveTextContent('★★★★');
    expect(screen.queryByTestId('dictionary-frequency')).not.toBeInTheDocument();
  });

  it('stars mode keeps the native stars chip and skips its duplicate rank', () => {
    renderRow('unknown', {
      frequencies: freqs,
      stars: { count: 3, source: 'COCA' },
      frequencyDisplay: 'stars',
    });

    const chips = screen.getAllByTestId('dictionary-stars');
    expect(chips).toHaveLength(1);
    expect(chips[0]).toHaveTextContent('★★★');
  });

  it('rank mode renders rank chips and star chips side by side for different sources', () => {
    renderRow('unknown', {
      frequencies: freqs,
      stars: { count: 3, source: 'JPDB' },
      frequencyDisplay: 'rank',
    });

    const chip = screen.getByTestId('dictionary-frequency');
    expect(chip).toHaveTextContent('COCA');
    expect(chip).toHaveTextContent('4,500');
    expect(screen.getByTestId('dictionary-stars')).toHaveTextContent('JPDB');
  });

  it('rank mode drops a stars chip whose source already has a rank chip', () => {
    renderRow('unknown', {
      frequencies: freqs,
      stars: { count: 3, source: 'COCA' },
      frequencyDisplay: 'rank',
    });

    expect(screen.getByTestId('dictionary-frequency')).toHaveTextContent('COCA');
    expect(screen.queryByTestId('dictionary-stars')).not.toBeInTheDocument();
  });

  it('rank mode falls back to the stars chip when no rank lists exist', () => {
    renderRow('unknown', { stars: { count: 2, source: 'JPDB' }, frequencyDisplay: 'rank' });

    expect(screen.getByTestId('dictionary-stars')).toHaveTextContent('★★');
  });

  it('star chips wear the 5-band color of their tier', () => {
    renderRow('unknown', {
      frequencies: freqs,
      stars: { count: 2, source: 'JPDB' },
      frequencyDisplay: 'stars',
    });

    const chips = screen.getAllByTestId('dictionary-stars');
    // JPDB 2★ → 'advanced'; COCA rank 4500 → 'common'
    expect(chips[0].className).toContain('TihokaHeaderFrequency--advanced');
    expect(chips[1].className).toContain('TihokaHeaderFrequency--common');
  });
});
