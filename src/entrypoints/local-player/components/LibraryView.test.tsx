import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { LibraryView } from './LibraryView';
import type { VideoRecord } from '@/features/local-player/services/mediaLibraryRepository';
import type { SubtitlesState } from '@/entrypoints/local-player/hooks/useLocalPlayerStore';
import videoEntries from '../../../../tests/data-test/local-player/samples/library-metadata/video-entries.json';

const typedEntries = videoEntries as VideoRecord[];

const emptySubs: SubtitlesState = { target: null, native: null, others: [] };

describe('LibraryView — real sample data (26 entries)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-12T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function renderView(overrides: Partial<{
    onSortChange: jest.Mock;
    onVideoSelect: jest.Mock;
    onSelectTrack: jest.Mock;
    onOpenFile: jest.Mock;
    onOpenFolder: jest.Mock;
    currentVideoId: string | null;
    currentSubtitles: SubtitlesState;
  }> = {}) {
    const onSortChange = overrides.onSortChange ?? jest.fn();
    const onVideoSelect = overrides.onVideoSelect ?? jest.fn();
    const onSelectTrack = overrides.onSelectTrack ?? jest.fn();
    const onOpenFile = overrides.onOpenFile ?? jest.fn();
    const onOpenFolder = overrides.onOpenFolder ?? jest.fn();
    return render(
      <LibraryView
        videos={typedEntries}
        subtitles={[]}
        sortBy="recent"
        onSortChange={onSortChange}
        onVideoSelect={onVideoSelect}
        onSubtitleSelect={jest.fn()}
        onSelectTrack={onSelectTrack}
        onOpenFile={onOpenFile}
        onOpenFolder={onOpenFolder}
        onVideoDelete={jest.fn()}
        onClearAll={jest.fn()}
        currentVideoId={overrides.currentVideoId ?? null}
        currentSubtitles={overrides.currentSubtitles ?? emptySubs}
      />,
    );
  }

  it('renders 26 LibraryCard components for the full sample library', () => {
    renderView();
    expect(screen.getAllByTestId('library-card')).toHaveLength(26);
  });

  it('renders CJK titles correctly (vid-006, vid-007, vid-008)', () => {
    renderView();
    expect(screen.getByText('君の名は。 (Your Name)')).toBeInTheDocument();
    expect(screen.getByText('사랑의 불시착 (Crash Landing on You) E01')).toBeInTheDocument();
    expect(screen.getByText('流浪地球 (The Wandering Earth)')).toBeInTheDocument();
  });

  it('renders special char title correctly (vid-017: Amélie)', () => {
    renderView();
    expect(screen.getByText('Amélie')).toBeInTheDocument();
  });

  it('shows "Not watched" for entries with null lastWatchedAt (vid-003, vid-015, vid-016)', () => {
    renderView();
    const unwatched = screen.getAllByText('Not watched');
    expect(unwatched).toHaveLength(3);
  });

  it('shows resume % in ring for entries with resumePositionMs > 0 (4 entries with pct > 0)', () => {
    renderView();
    const resumeRings = screen.getAllByTestId('library-card-resume').filter(
      (el) => el.getAttribute('data-pct') !== '0',
    );
    // 4 entries have pct > 0: vid-002 (41%), vid-007 (45%), vid-011 (69%), vid-019 (74%)
    // vid-020 has resumePositionMs=5000 but pct rounds to 0
    expect(resumeRings).toHaveLength(4);
  });

  it('calls onSortChange when sort dropdown changes to "title"', () => {
    const onSortChange = jest.fn();
    renderView({ onSortChange });
    fireEvent.click(screen.getByRole('button', { name: 'Sort library' }));
    fireEvent.click(screen.getByRole('option', { name: 'Title' }));
    expect(onSortChange).toHaveBeenCalledWith('title');
  });

  it('calls onSortChange when sort dropdown changes to "added"', () => {
    const onSortChange = jest.fn();
    renderView({ onSortChange });
    fireEvent.click(screen.getByRole('button', { name: 'Sort library' }));
    fireEvent.click(screen.getByRole('option', { name: 'Date added' }));
    expect(onSortChange).toHaveBeenCalledWith('added');
  });

  it('renders empty state message when videos array is empty', () => {
    render(
      <LibraryView
        videos={[]}
        subtitles={[]}
        sortBy="recent"
        onSortChange={jest.fn()}
        onVideoSelect={jest.fn()}
        onSubtitleSelect={jest.fn()}
        onSelectTrack={jest.fn()}
        onOpenFile={jest.fn()}
        onOpenFolder={jest.fn()}
        onVideoDelete={jest.fn()}
        onClearAll={jest.fn()}
        currentVideoId={null}
        currentSubtitles={emptySubs}
      />,
    );
    expect(screen.getByTestId('library-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('library-card')).not.toBeInTheDocument();
  });

  it('calls onVideoSelect with videoId when a card is clicked', () => {
    const onVideoSelect = jest.fn();
    renderView({ onVideoSelect });
    const cards = screen.getAllByTestId('library-card');
    fireEvent.click(cards[0]);
    expect(onVideoSelect).toHaveBeenCalledTimes(1);
    expect(onVideoSelect.mock.calls[0][0]).toEqual(expect.any(String));
  });

  it('renders footer with sort select and add buttons', () => {
    renderView();
    expect(screen.getByTestId('library-sort-select')).toBeInTheDocument();
    expect(screen.getByTestId('playlist-add-files')).toBeInTheDocument();
    expect(screen.getByTestId('playlist-add-folder')).toBeInTheDocument();
  });

  it('calls onOpenFile when Add files button is clicked', () => {
    const onOpenFile = jest.fn();
    renderView({ onOpenFile });
    fireEvent.click(screen.getByTestId('playlist-add-files'));
    expect(onOpenFile).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenFolder when Add folder button is clicked', () => {
    const onOpenFolder = jest.fn();
    renderView({ onOpenFolder });
    fireEvent.click(screen.getByTestId('playlist-add-folder'));
    expect(onOpenFolder).toHaveBeenCalledTimes(1);
  });

  it('marks the current video as active', () => {
    renderView({ currentVideoId: 'vid-001' });
    const cards = screen.getAllByTestId('library-card');
    // The active card's parent .item should have the active class
    const activeCard = cards.find((c) => c.parentElement?.className.includes('active'));
    expect(activeCard).toBeTruthy();
  });
});
