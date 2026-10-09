// StatusRow — REQ-2/AC-3: the status pill only ever shows the 3 base statuses;
// tracking/learning render as a separate flag segment (click toggles tracking,
// read-only on learning).

import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusRow } from './StatusRow';
import { DEFAULT_BAND_THRESHOLDS } from '@/shared/lib/frequencyBand';
import type { WordStatus } from '@/entities/dictionary';

function renderRow(status: WordStatus): { onCycle: jest.Mock; onToggleTracking: jest.Mock } {
  const onCycle = jest.fn();
  const onToggleTracking = jest.fn();
  render(
    <StatusRow
      status={status}
      onCycle={onCycle}
      onToggleTracking={onToggleTracking}
      frequencies={[]}
      stars={undefined}
      thresholds={DEFAULT_BAND_THRESHOLDS}
    />,
  );
  return { onCycle, onToggleTracking };
}

describe('StatusRow flag segment', () => {
  it('renders a single base pill and no flag segment for unknown', () => {
    renderRow('unknown');

    expect(screen.getByTestId('dictionary-status-cycle')).toHaveTextContent('Unknown');
    expect(screen.queryByTestId('dictionary-status-flag')).not.toBeInTheDocument();
  });

  it('renders base "Unknown" plus an eye flag segment for tracking', () => {
    renderRow('tracking');

    expect(screen.getByTestId('dictionary-status-cycle')).toHaveTextContent('Unknown');
    const flag = screen.getByTestId('dictionary-status-flag');
    expect(flag).toBeEnabled();
    expect(flag.querySelector('svg')).not.toBeNull();
  });

  it('flag segment click calls onToggleTracking, not onCycle', () => {
    const { onCycle, onToggleTracking } = renderRow('tracking');

    fireEvent.click(screen.getByTestId('dictionary-status-flag'));

    expect(onToggleTracking).toHaveBeenCalledTimes(1);
    expect(onCycle).not.toHaveBeenCalled();
  });

  it('renders the flag segment disabled for learning', () => {
    const { onToggleTracking } = renderRow('learning');

    const flag = screen.getByTestId('dictionary-status-flag');
    expect(flag).toBeDisabled();

    fireEvent.click(flag);
    expect(onToggleTracking).not.toHaveBeenCalled();
  });

  it.each(['unknown', 'tracking', 'learning', 'known', 'ignore'] as const)(
    'base pill click calls onCycle for status %s',
    (status) => {
      const { onCycle } = renderRow(status);

      fireEvent.click(screen.getByTestId('dictionary-status-cycle'));

      expect(onCycle).toHaveBeenCalledTimes(1);
    },
  );
});
