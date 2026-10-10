// StatusRow — REQ-2/AC-3: the status pill only ever shows the 3 base statuses.
// Layout is [eye | pill | srs]: the eye is always rendered and toggles
// tracking on the unknown family; the srs segment only appears on learning
// and jumps to the study page.

import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusRow } from './StatusRow';
import { DEFAULT_BAND_THRESHOLDS } from '@/shared/lib/frequencyBand';
import type { WordStatus } from '@/entities/dictionary';

function renderRow(status: WordStatus): { onCycle: jest.Mock; onToggleTracking: jest.Mock; onOpenSrs: jest.Mock } {
  const onCycle = jest.fn();
  const onToggleTracking = jest.fn();
  const onOpenSrs = jest.fn();
  render(
    <StatusRow
      status={status}
      onCycle={onCycle}
      onToggleTracking={onToggleTracking}
      onOpenSrs={onOpenSrs}
      frequencies={[]}
      stars={undefined}
      thresholds={DEFAULT_BAND_THRESHOLDS}
    />,
  );
  return { onCycle, onToggleTracking, onOpenSrs };
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

  it.each(['learning', 'known', 'ignore'] as const)(
    'renders the eye segment disabled for %s',
    (status) => {
      const { onToggleTracking } = renderRow(status);

      const flag = screen.getByTestId('dictionary-status-flag');
      expect(flag).toBeDisabled();

      fireEvent.click(flag);
      expect(onToggleTracking).not.toHaveBeenCalled();
    },
  );

  it('renders the srs segment only for learning — click calls onOpenSrs', () => {
    const { onCycle, onOpenSrs } = renderRow('learning');

    const srs = screen.getByTestId('dictionary-status-srs');
    expect(srs).toBeEnabled();
    expect(srs.querySelector('svg')).not.toBeNull();

    fireEvent.click(srs);
    expect(onOpenSrs).toHaveBeenCalledTimes(1);
    expect(onCycle).not.toHaveBeenCalled();
  });

  it.each(['unknown', 'tracking', 'known', 'ignore'] as const)(
    'renders no srs segment for %s',
    (status) => {
      renderRow(status);

      expect(screen.queryByTestId('dictionary-status-srs')).not.toBeInTheDocument();
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
