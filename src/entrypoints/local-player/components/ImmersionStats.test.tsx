import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react';
import { ImmersionStats } from './ImmersionStats';
import { getHistory } from '@/features/local-player/services/mediaLibraryRepository';
import type { HistoryRecord } from '@/features/local-player/services/mediaLibraryRepository';

jest.mock('@/features/local-player/services/mediaLibraryRepository', () => {
  const actual = jest.requireActual<
    typeof import('@/features/local-player/services/mediaLibraryRepository')
  >('@/features/local-player/services/mediaLibraryRepository');
  return { ...actual, getHistory: jest.fn() };
});

const mockGetHistory = getHistory as jest.MockedFunction<typeof getHistory>;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

const rec = (
  id: string,
  videoId: string,
  watchedAtMs: number,
  watchDurationMs: number,
): HistoryRecord => ({
  id,
  videoId,
  watchedAt: new Date(watchedAtMs).toISOString(),
  watchDurationMs,
  positionMs: 0,
});

describe('ImmersionStats', () => {
  beforeEach(() => {
    jest.useRealTimers();
    mockGetHistory.mockReset();
  });

  it('renders zeroed stats for an empty history', async () => {
    mockGetHistory.mockResolvedValue([]);
    render(<ImmersionStats />);
    expect(await screen.findByText('0 h watched')).toBeInTheDocument();
    expect(screen.getByText(/0 h last 7 days/)).toBeInTheDocument();
    expect(screen.getByText('Level 1')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders totals, level and progress for recorded history', async () => {
    const now = Date.now();
    mockGetHistory.mockResolvedValue([
      rec('watch-v1-1', 'v1', now - DAY_MS, 100 * HOUR_MS),
      rec('watch-v1-2', 'v1', now - HOUR_MS, 20 * HOUR_MS),
    ]);
    render(<ImmersionStats />);
    expect(await screen.findByText('120 h watched')).toBeInTheDocument();
    expect(screen.getByText('Level 2')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemin', '50');
    expect(bar).toHaveAttribute('aria-valuemax', '150');
    expect(bar).toHaveAttribute('aria-valuenow', '120');
    expect(screen.getByText(/30 h to Level 3/)).toBeInTheDocument();
  });

  it('shows streak only when consecutive-day streak is positive', async () => {
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    const now = noon.getTime();
    mockGetHistory.mockResolvedValue([
      rec('watch-v-1', 'v', now - 2 * HOUR_MS, HOUR_MS),
      rec('watch-v-2', 'v', now - DAY_MS, HOUR_MS),
      rec('watch-v-3', 'v', now - 2 * DAY_MS, HOUR_MS),
    ]);
    render(<ImmersionStats />);
    expect(await screen.findByText(/3-day streak/)).toBeInTheDocument();
  });

  it('exposes local vs streaming split in the totals tooltip', async () => {
    const now = Date.now();
    mockGetHistory.mockResolvedValue([
      rec('watch-v-1', 'v', now - HOUR_MS, 10 * HOUR_MS),
      rec('stream-1-1', 'stream:youtube.com', now - HOUR_MS, 5 * HOUR_MS),
    ]);
    render(<ImmersionStats />);
    const total = await screen.findByText('15 h watched');
    expect(total).toHaveAttribute('title', 'local 10 h · streaming 5 h');
  });

  it('shows max level label at the top milestone', async () => {
    const now = Date.now();
    mockGetHistory.mockResolvedValue([rec('watch-v-1', 'v', now - HOUR_MS, 1600 * HOUR_MS)]);
    render(<ImmersionStats />);
    expect(await screen.findByText('Level 7')).toBeInTheDocument();
    expect(screen.getByText('Max level')).toBeInTheDocument();
  });

  it('waits silently when history read fails', async () => {
    mockGetHistory.mockRejectedValue(new Error('idb down'));
    render(<ImmersionStats />);
    await waitFor(() => expect(screen.getByText('0 h watched')).toBeInTheDocument());
  });
});
