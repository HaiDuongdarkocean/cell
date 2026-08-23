import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { LibraryCard } from './LibraryCard';
import type { VideoRecord } from '@/features/local-player/services/mediaLibraryRepository';
import videoEntries from '../../../../tests/data-test/local-player/samples/library-metadata/video-entries.json';

const typedEntries = videoEntries as VideoRecord[];

function findEntry(id: string): VideoRecord {
  const entry = typedEntries.find((v) => v.id === id);
  if (!entry) throw new Error(`Sample entry not found: ${id}`);
  return entry;
}

describe('LibraryCard — real sample data (video-entries.json)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-12T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows resume percentage when resumePositionMs > 0 (vid-002: 3600000 of 8880000)', () => {
    const entry = findEntry('vid-002');
    // 3600000 / 8880000 ≈ 40.54% → rounded to nearest integer = 41%
    render(<LibraryCard video={entry} onClick={jest.fn()} />);
    expect(screen.getByTestId('library-card-resume')).toHaveTextContent('41%');
  });

  it('shows "Today" when lastWatchedAt is today (vid-018: 2026-07-11T23:59 → within same day)', () => {
    // vid-018 lastWatchedAt = 2026-07-11T23:59:00.000Z, system time = 2026-07-12T00:00:00Z
    // Same calendar day in UTC? 23:59 on the 11th vs 00:00 on the 12th → different UTC day.
    // Use a custom entry with lastWatchedAt = today (2026-07-12).
    const entry: VideoRecord = {
      ...findEntry('vid-001'),
      lastWatchedAt: '2026-07-12T10:00:00.000Z',
    };
    render(<LibraryCard video={entry} onClick={jest.fn()} />);
    expect(screen.getByTestId('library-card-watched')).toHaveTextContent('Today');
  });

  it('shows "Yesterday" when lastWatchedAt is the previous day', () => {
    const entry: VideoRecord = {
      ...findEntry('vid-001'),
      lastWatchedAt: '2026-07-11T10:00:00.000Z',
    };
    render(<LibraryCard video={entry} onClick={jest.fn()} />);
    expect(screen.getByTestId('library-card-watched')).toHaveTextContent('Yesterday');
  });

  it('shows "Not watched" when lastWatchedAt is null (vid-003)', () => {
    const entry = findEntry('vid-003');
    expect(entry.lastWatchedAt).toBeNull();
    render(<LibraryCard video={entry} onClick={jest.fn()} />);
    expect(screen.getByTestId('library-card-watched')).toHaveTextContent('Not watched');
  });

  it('renders CJK title correctly (vid-006: 君の名は。)', () => {
    const entry = findEntry('vid-006');
    render(<LibraryCard video={entry} onClick={jest.fn()} />);
    expect(screen.getByTestId('library-card-title')).toHaveTextContent('君の名は。');
  });

  it('renders Korean title correctly (vid-007: 사랑의 불시착)', () => {
    const entry = findEntry('vid-007');
    render(<LibraryCard video={entry} onClick={jest.fn()} />);
    expect(screen.getByTestId('library-card-title')).toHaveTextContent('사랑의 불시착');
  });

  it('renders special char title correctly (vid-017: Amélie)', () => {
    const entry = findEntry('vid-017');
    render(<LibraryCard video={entry} onClick={jest.fn()} />);
    expect(screen.getByTestId('library-card-title')).toHaveTextContent('Amélie');
  });

  it('does not show resume badge when resumePositionMs is 0', () => {
    const entry = findEntry('vid-001');
    expect(entry.resumePositionMs).toBe(0);
    render(<LibraryCard video={entry} onClick={jest.fn()} />);
    expect(screen.queryByTestId('library-card-resume')).not.toBeInTheDocument();
  });

  it('calls onClick when card is clicked', () => {
    const onClick = jest.fn();
    const entry = findEntry('vid-001');
    render(<LibraryCard video={entry} onClick={onClick} />);
    fireEvent.click(screen.getByTestId('library-card'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
