import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { LibraryView } from './LibraryView';
import type { VideoRecord } from '@/features/local-player/services/mediaLibraryRepository';
import videoEntries from '../../../../tests/data-test/local-player/samples/library-metadata/video-entries.json';

const typedEntries = videoEntries as VideoRecord[];

describe('LibraryView — real sample data (26 entries)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-12T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders 26 LibraryCard components for the full sample library', () => {
    render(
      <LibraryView
        videos={typedEntries}
        sortBy="recent"
        onSortChange={jest.fn()}
        onVideoSelect={jest.fn()}
        subtitles={[]}
        onSubtitleSelect={jest.fn()}
      />,
    );
    expect(screen.getAllByTestId('library-card')).toHaveLength(26);
  });

  it('renders CJK titles correctly (vid-006: 君の名は。, vid-007: 사랑의 불시착, vid-008: 流浪地球)', () => {
    render(
      <LibraryView
        videos={typedEntries}
        sortBy="recent"
        onSortChange={jest.fn()}
        onVideoSelect={jest.fn()}
        subtitles={[]}
        onSubtitleSelect={jest.fn()}
      />,
    );
    expect(screen.getByText('君の名は。 (Your Name)')).toBeInTheDocument();
    expect(screen.getByText('사랑의 불시착 (Crash Landing on You) E01')).toBeInTheDocument();
    expect(screen.getByText('流浪地球 (The Wandering Earth)')).toBeInTheDocument();
  });

  it('renders special char title correctly (vid-017: Amélie)', () => {
    render(
      <LibraryView
        videos={typedEntries}
        sortBy="recent"
        onSortChange={jest.fn()}
        onVideoSelect={jest.fn()}
        subtitles={[]}
        onSubtitleSelect={jest.fn()}
      />,
    );
    expect(screen.getByText('Amélie')).toBeInTheDocument();
  });

  it('shows "Not watched" for entries with null lastWatchedAt (vid-003, vid-015, vid-016)', () => {
    render(
      <LibraryView
        videos={typedEntries}
        sortBy="recent"
        onSortChange={jest.fn()}
        onVideoSelect={jest.fn()}
        subtitles={[]}
        onSubtitleSelect={jest.fn()}
      />,
    );
    const unwatched = screen.getAllByText('Not watched');
    // vid-003, vid-015, vid-016 have null lastWatchedAt
    expect(unwatched).toHaveLength(3);
  });

  it('shows resume % for entries with resumePositionMs > 0 (vid-002, vid-007, vid-011, vid-019, vid-020)', () => {
    render(
      <LibraryView
        videos={typedEntries}
        sortBy="recent"
        onSortChange={jest.fn()}
        onVideoSelect={jest.fn()}
        subtitles={[]}
        onSubtitleSelect={jest.fn()}
      />,
    );
    const resumeBadges = screen.getAllByTestId('library-card-resume');
    // 5 entries have resumePositionMs > 0
    expect(resumeBadges).toHaveLength(5);
  });

  it('calls onSortChange when sort dropdown changes to "title"', () => {
    const onSortChange = jest.fn();
    render(
      <LibraryView
        videos={typedEntries}
        sortBy="recent"
        onSortChange={onSortChange}
        onVideoSelect={jest.fn()}
        subtitles={[]}
        onSubtitleSelect={jest.fn()}
      />,
    );
    // Open the sort dropdown by clicking the trigger button.
    fireEvent.click(screen.getByRole('button', { name: 'Sort library' }));
    // Click the "Title" option
    fireEvent.click(screen.getByRole('option', { name: 'Title' }));
    expect(onSortChange).toHaveBeenCalledWith('title');
  });

  it('calls onSortChange when sort dropdown changes to "added"', () => {
    const onSortChange = jest.fn();
    render(
      <LibraryView
        videos={typedEntries}
        sortBy="recent"
        onSortChange={onSortChange}
        onVideoSelect={jest.fn()}
        subtitles={[]}
        onSubtitleSelect={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sort library' }));
    fireEvent.click(screen.getByRole('option', { name: 'Date added' }));
    expect(onSortChange).toHaveBeenCalledWith('added');
  });

  it('renders empty state message when videos array is empty', () => {
    render(
      <LibraryView
        videos={[]}
        sortBy="recent"
        onSortChange={jest.fn()}
        onVideoSelect={jest.fn()}
        subtitles={[]}
        onSubtitleSelect={jest.fn()}
      />,
    );
    expect(screen.getByTestId('library-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('library-card')).not.toBeInTheDocument();
  });

  it('calls onVideoSelect with videoId when a card is clicked', () => {
    const onVideoSelect = jest.fn();
    render(
      <LibraryView
        videos={typedEntries}
        sortBy="recent"
        onSortChange={jest.fn()}
        onVideoSelect={onVideoSelect}
        subtitles={[]}
        onSubtitleSelect={jest.fn()}
      />,
    );
    const cards = screen.getAllByTestId('library-card');
    fireEvent.click(cards[0]);
    expect(onVideoSelect).toHaveBeenCalledTimes(1);
    // The first card in "recent" sort — onSortChange not involved, just verify an id was passed.
    expect(onVideoSelect.mock.calls[0][0]).toEqual(expect.any(String));
  });
});
