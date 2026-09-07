import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { LibraryCard, formatLastWatched, resumePercentValue } from './LibraryCard';
import type { VideoRecord } from '@/features/local-player/services/mediaLibraryRepository';
import type { SubtitleMatch } from '@/features/local-player/logic/subtitleMatch';
import videoEntries from '../../../../tests/data-test/local-player/samples/library-metadata/video-entries.json';

const typedEntries = videoEntries as VideoRecord[];

function findEntry(id: string): VideoRecord {
  const entry = typedEntries.find((v) => v.id === id);
  if (!entry) throw new Error(`Sample entry not found: ${id}`);
  return entry;
}

const noopMatch: SubtitleMatch = { filename: 'noop.en.srt', languageCode: 'en', tags: [] };

describe('LibraryCard — real sample data (video-entries.json)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-12T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows resume percentage in ring when resumePositionMs > 0 (vid-002: 3600000 of 8880000)', () => {
    const entry = findEntry('vid-002');
    render(
      <LibraryCard
        video={entry}
        isActive={false}
        subtitleMatches={[]}
        selectedTarget={null}
        selectedNative={null}
        onVideoSelect={jest.fn()}
        onSelectTrack={jest.fn()}
        onVideoDelete={jest.fn()}
      />,
    );
    expect(screen.getByTestId('library-card-resume')).toHaveTextContent('41%');
  });

  it('shows 0% in ring when resumePositionMs is 0', () => {
    const entry = findEntry('vid-001');
    expect(entry.resumePositionMs).toBe(0);
    render(
      <LibraryCard
        video={entry}
        isActive={false}
        subtitleMatches={[]}
        selectedTarget={null}
        selectedNative={null}
        onVideoSelect={jest.fn()}
        onSelectTrack={jest.fn()}
        onVideoDelete={jest.fn()}
      />,
    );
    expect(screen.getByTestId('library-card-resume')).toHaveTextContent('0%');
  });

  it('shows "Today" when lastWatchedAt is today', () => {
    const entry: VideoRecord = {
      ...findEntry('vid-001'),
      lastWatchedAt: '2026-07-12T10:00:00.000Z',
    };
    render(
      <LibraryCard
        video={entry}
        isActive={false}
        subtitleMatches={[]}
        selectedTarget={null}
        selectedNative={null}
        onVideoSelect={jest.fn()}
        onSelectTrack={jest.fn()}
        onVideoDelete={jest.fn()}
      />,
    );
    expect(screen.getByTestId('library-card-watched')).toHaveTextContent('Today');
  });

  it('shows "Yesterday" when lastWatchedAt is the previous day', () => {
    const entry: VideoRecord = {
      ...findEntry('vid-001'),
      lastWatchedAt: '2026-07-11T10:00:00.000Z',
    };
    render(
      <LibraryCard
        video={entry}
        isActive={false}
        subtitleMatches={[]}
        selectedTarget={null}
        selectedNative={null}
        onVideoSelect={jest.fn()}
        onSelectTrack={jest.fn()}
        onVideoDelete={jest.fn()}
      />,
    );
    expect(screen.getByTestId('library-card-watched')).toHaveTextContent('Yesterday');
  });

  it('shows "Not watched" when lastWatchedAt is null (vid-003)', () => {
    const entry = findEntry('vid-003');
    expect(entry.lastWatchedAt).toBeNull();
    render(
      <LibraryCard
        video={entry}
        isActive={false}
        subtitleMatches={[]}
        selectedTarget={null}
        selectedNative={null}
        onVideoSelect={jest.fn()}
        onSelectTrack={jest.fn()}
        onVideoDelete={jest.fn()}
      />,
    );
    expect(screen.getByTestId('library-card-watched')).toHaveTextContent('Not watched');
  });

  it('renders CJK title correctly (vid-006: 君の名は。)', () => {
    const entry = findEntry('vid-006');
    render(
      <LibraryCard
        video={entry}
        isActive={false}
        subtitleMatches={[]}
        selectedTarget={null}
        selectedNative={null}
        onVideoSelect={jest.fn()}
        onSelectTrack={jest.fn()}
        onVideoDelete={jest.fn()}
      />,
    );
    expect(screen.getByTestId('library-card-title')).toHaveTextContent('君の名は。 (Your Name)');
  });

  it('renders Korean title correctly (vid-007: 사랑의 불시착)', () => {
    const entry = findEntry('vid-007');
    render(
      <LibraryCard
        video={entry}
        isActive={false}
        subtitleMatches={[]}
        selectedTarget={null}
        selectedNative={null}
        onVideoSelect={jest.fn()}
        onSelectTrack={jest.fn()}
        onVideoDelete={jest.fn()}
      />,
    );
    expect(screen.getByTestId('library-card-title')).toHaveTextContent('사랑의 불시착');
  });

  it('renders special char title correctly (vid-017: Amélie)', () => {
    const entry = findEntry('vid-017');
    render(
      <LibraryCard
        video={entry}
        isActive={false}
        subtitleMatches={[]}
        selectedTarget={null}
        selectedNative={null}
        onVideoSelect={jest.fn()}
        onSelectTrack={jest.fn()}
        onVideoDelete={jest.fn()}
      />,
    );
    expect(screen.getByTestId('library-card-title')).toHaveTextContent('Amélie');
  });

  it('calls onVideoSelect when card row is clicked', () => {
    const onVideoSelect = jest.fn();
    const entry = findEntry('vid-001');
    render(
      <LibraryCard
        video={entry}
        isActive={false}
        subtitleMatches={[]}
        selectedTarget={null}
        selectedNative={null}
        onVideoSelect={onVideoSelect}
        onSelectTrack={jest.fn()}
        onVideoDelete={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('library-card'));
    expect(onVideoSelect).toHaveBeenCalledTimes(1);
    expect(onVideoSelect.mock.calls[0][0]).toBe('vid-001');
  });

  it('expands accordion when expand button is clicked', () => {
    const entry = findEntry('vid-001');
    render(
      <LibraryCard
        video={entry}
        isActive={false}
        subtitleMatches={[noopMatch]}
        selectedTarget={null}
        selectedNative={null}
        onVideoSelect={jest.fn()}
        onSelectTrack={jest.fn()}
        onVideoDelete={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('library-card-subs')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('library-card-expand'));
    expect(screen.getByTestId('library-card-subs')).toBeInTheDocument();
  });

  it('calls onSelectTrack when a subtitle option is clicked', () => {
    const onSelectTrack = jest.fn();
    const entry = findEntry('vid-001');
    render(
      <LibraryCard
        video={entry}
        isActive={false}
        subtitleMatches={[noopMatch]}
        selectedTarget={null}
        selectedNative={null}
        onVideoSelect={jest.fn()}
        onSelectTrack={onSelectTrack}
        onVideoDelete={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('library-card-expand'));
    fireEvent.click(screen.getByRole('button', { name: 'Target subtitle' }));
    fireEvent.click(screen.getByRole('option', { name: /noop\.en\.srt/ }));
    expect(onSelectTrack).toHaveBeenCalledWith(noopMatch);
  });
});

describe('formatLastWatched', () => {
  it('returns "Not watched" for null', () => {
    expect(formatLastWatched(null, new Date('2026-07-12'))).toBe('Not watched');
  });

  it('returns "Today" for same-day', () => {
    expect(formatLastWatched('2026-07-12T10:00:00.000Z', new Date('2026-07-12T20:00:00.000Z'))).toBe('Today');
  });

  it('returns "Yesterday" for 1 day ago', () => {
    expect(formatLastWatched('2026-07-11T10:00:00.000Z', new Date('2026-07-12T10:00:00.000Z'))).toBe('Yesterday');
  });

  it('returns "N days ago" for older', () => {
    expect(formatLastWatched('2026-07-08T10:00:00.000Z', new Date('2026-07-12T10:00:00.000Z'))).toBe('4 days ago');
  });
});

describe('resumePercentValue', () => {
  it('returns 0 for zero resume', () => {
    expect(resumePercentValue({ ...findEntry('vid-001'), resumePositionMs: 0 })).toBe(0);
  });

  it('returns rounded percentage for partial resume', () => {
    const entry = findEntry('vid-002');
    expect(resumePercentValue(entry)).toBe(41);
  });

  it('returns 0 when durationMs is 0', () => {
    expect(resumePercentValue({ ...findEntry('vid-001'), durationMs: 0, resumePositionMs: 1000 })).toBe(0);
  });
});
