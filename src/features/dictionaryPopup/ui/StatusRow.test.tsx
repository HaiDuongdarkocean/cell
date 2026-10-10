// StatusRow — REQ-2/AC-3: the status pill only ever shows the 3 base statuses.
// Layout is [eye | pill] + a standalone flashcard chip right of the group:
// the eye is always rendered and toggles tracking on the unknown family; the
// cards chip appears whenever SRS_TERM_CARDS reports ≥1 card for the term,
// regardless of status, and opens the term-filtered study page.

import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusRow } from './StatusRow';
import { DEFAULT_BAND_THRESHOLDS } from '@/shared/lib/frequencyBand';
import type { WordStatus } from '@/entities/dictionary';

function renderRow(
  status: WordStatus,
  options?: { srsCardCount?: number },
): { onCycle: jest.Mock; onToggleTracking: jest.Mock; onOpenSrsCards: jest.Mock } {
  const onCycle = jest.fn();
  const onToggleTracking = jest.fn();
  const onOpenSrsCards = jest.fn();
  render(
    <StatusRow
      status={status}
      onCycle={onCycle}
      onToggleTracking={onToggleTracking}
      srsCardCount={options?.srsCardCount}
      onOpenSrsCards={onOpenSrsCards}
      frequencies={[]}
      stars={undefined}
      thresholds={DEFAULT_BAND_THRESHOLDS}
    />,
  );
  return { onCycle, onToggleTracking, onOpenSrsCards };
}

describe('StatusRow segmented control', () => {
  it('renders the eye segment for unknown — click toggles tracking on', () => {
    const { onCycle, onToggleTracking } = renderRow('unknown');

    expect(screen.getByTestId('dictionary-status-cycle')).toHaveTextContent('Unknown');
    const flag = screen.getByTestId('dictionary-status-flag');
    expect(flag).toBeEnabled();
    expect(flag.querySelector('svg')).not.toBeNull();

    fireEvent.click(flag);
    expect(onToggleTracking).toHaveBeenCalledTimes(1);
    expect(onCycle).not.toHaveBeenCalled();
  });

  it('renders an active eye segment for tracking — click toggles tracking off', () => {
    const { onCycle, onToggleTracking } = renderRow('tracking');

    expect(screen.getByTestId('dictionary-status-cycle')).toHaveTextContent('Unknown');
    const flag = screen.getByTestId('dictionary-status-flag');
    expect(flag).toBeEnabled();

    fireEvent.click(flag);
    expect(onToggleTracking).toHaveBeenCalledTimes(1);
    expect(onCycle).not.toHaveBeenCalled();
  });

  it.each(['known', 'ignore'] as const)(
    'renders the eye segment enabled for %s — click toggles tracking on',
    (status) => {
      const { onToggleTracking, onCycle } = renderRow(status);

      const flag = screen.getByTestId('dictionary-status-flag');
      expect(flag).toBeEnabled();

      fireEvent.click(flag);
      expect(onToggleTracking).toHaveBeenCalledTimes(1);
      expect(onCycle).not.toHaveBeenCalled();
    },
  );

  it('renders the eye segment disabled for learning', () => {
    const { onToggleTracking } = renderRow('learning');

    const flag = screen.getByTestId('dictionary-status-flag');
    expect(flag).toBeDisabled();

    fireEvent.click(flag);
    expect(onToggleTracking).not.toHaveBeenCalled();
  });

  it.each(['unknown', 'tracking', 'learning', 'known', 'ignore'] as const)(
    'renders no in-group srs segment for %s — cards live in the standalone chip',
    (status) => {
      renderRow(status, { srsCardCount: 2 });

      expect(screen.queryByTestId('dictionary-status-srs')).not.toBeInTheDocument();
    },
  );

  it.each(['unknown', 'tracking', 'learning', 'known', 'ignore'] as const)(
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
      renderRow('learning', { srsCardCount });

      expect(screen.queryByTestId('dictionary-srs-cards')).not.toBeInTheDocument();
    },
  );

  it.each(['unknown', 'tracking', 'learning', 'known', 'ignore'] as const)(
    'base pill click calls onCycle for status %s',
    (status) => {
      const { onCycle } = renderRow(status);

      fireEvent.click(screen.getByTestId('dictionary-status-cycle'));

      expect(onCycle).toHaveBeenCalledTimes(1);
    },
  );
});
