import { useLocalPlayerStore } from './useLocalPlayerStore';
import type { VideoRecord } from '@/features/local-player/services/mediaLibraryRepository';
import type { SubtitleMatch } from '@/features/local-player/logic/subtitleMatch';

const sampleVideo: VideoRecord = {
  id: 'video-1',
  filename: 'Movie_720p.mp4',
  title: 'Movie',
  durationMs: 3600000,
  addedAt: '2024-01-01T00:00:00.000Z',
  lastWatchedAt: null,
  resumePositionMs: 0,
};

const sampleSubs: {
  target: SubtitleMatch | null;
  native: SubtitleMatch | null;
  others: SubtitleMatch[];
} = {
  target: { filename: 'Movie.en.srt', languageCode: 'en', tags: [] },
  native: { filename: 'Movie.vi.srt', languageCode: 'vi', tags: [] },
  others: [],
};

describe('useLocalPlayerStore', () => {
  afterEach(() => useLocalPlayerStore.getState().reset());

  it('initial state', () => {
    const s = useLocalPlayerStore.getState();
    expect(s.currentVideo).toBeNull();
    expect(s.videoFile).toBeNull();
    expect(s.subtitles).toEqual({ target: null, native: null, others: [] });
    expect(s.isPlaying).toBe(false);
    expect(s.currentTime).toBe(0);
    expect(s.duration).toBe(0);
    expect(s.volume).toBe(1);
    expect(s.muted).toBe(false);
    expect(s.playbackRate).toBe(1);
    expect(s.library).toEqual([]);
    expect(s.librarySort).toBe('recent');
    expect(s.showLibrary).toBe(false);
  });

  it('setVideo sets currentVideo + videoFile', () => {
    const file = new File(['x'], 'Movie_720p.mp4', { type: 'video/mp4' });
    useLocalPlayerStore.getState().setVideo(sampleVideo, file);
    const s = useLocalPlayerStore.getState();
    expect(s.currentVideo).toEqual(sampleVideo);
    expect(s.videoFile).toBe(file);
  });

  it('setSubtitles sets subtitles', () => {
    useLocalPlayerStore.getState().setSubtitles(sampleSubs);
    expect(useLocalPlayerStore.getState().subtitles).toEqual(sampleSubs);
  });

  it('updatePlayback patches playback state', () => {
    useLocalPlayerStore.getState().updatePlayback({
      isPlaying: true,
      currentTime: 42,
      duration: 120,
      volume: 0.5,
      muted: true,
      playbackRate: 1.5,
    });
    const s = useLocalPlayerStore.getState();
    expect(s.isPlaying).toBe(true);
    expect(s.currentTime).toBe(42);
    expect(s.duration).toBe(120);
    expect(s.volume).toBe(0.5);
    expect(s.muted).toBe(true);
    expect(s.playbackRate).toBe(1.5);
  });

  it('updatePlayback patches partially', () => {
    useLocalPlayerStore.getState().updatePlayback({ isPlaying: true });
    expect(useLocalPlayerStore.getState().isPlaying).toBe(true);
    expect(useLocalPlayerStore.getState().currentTime).toBe(0);
  });

  it('setLibrary sets library', () => {
    const videos = [sampleVideo];
    useLocalPlayerStore.getState().setLibrary(videos);
    expect(useLocalPlayerStore.getState().library).toEqual(videos);
  });

  it('setLibrarySort sets librarySort', () => {
    useLocalPlayerStore.getState().setLibrarySort('title');
    expect(useLocalPlayerStore.getState().librarySort).toBe('title');
  });

  it('toggleLibrary toggles showLibrary', () => {
    expect(useLocalPlayerStore.getState().showLibrary).toBe(false);
    useLocalPlayerStore.getState().toggleLibrary();
    expect(useLocalPlayerStore.getState().showLibrary).toBe(true);
    useLocalPlayerStore.getState().toggleLibrary();
    expect(useLocalPlayerStore.getState().showLibrary).toBe(false);
  });

  it('reset resets to initial state', () => {
    useLocalPlayerStore.getState().setVideo(sampleVideo, new File(['x'], 'm.mp4'));
    useLocalPlayerStore.getState().setSubtitles(sampleSubs);
    useLocalPlayerStore.getState().updatePlayback({ isPlaying: true, currentTime: 99 });
    useLocalPlayerStore.getState().setLibrary([sampleVideo]);
    useLocalPlayerStore.getState().setLibrarySort('title');
    useLocalPlayerStore.getState().toggleLibrary();
    useLocalPlayerStore.getState().reset();
    const s = useLocalPlayerStore.getState();
    expect(s.currentVideo).toBeNull();
    expect(s.videoFile).toBeNull();
    expect(s.subtitles).toEqual({ target: null, native: null, others: [] });
    expect(s.isPlaying).toBe(false);
    expect(s.currentTime).toBe(0);
    expect(s.duration).toBe(0);
    expect(s.volume).toBe(1);
    expect(s.muted).toBe(false);
    expect(s.playbackRate).toBe(1);
    expect(s.library).toEqual([]);
    expect(s.librarySort).toBe('recent');
    expect(s.showLibrary).toBe(false);
  });
});
