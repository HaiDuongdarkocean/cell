import { matchVideosWithSubtitles, isVideoFile, isSubtitleFile, type VideoScanResult } from '@/features/local-player/logic/folderScan';

function makeVideoResult(filename: string): VideoScanResult {
  return {
    file: new File([], filename, { type: 'video/mp4' }),
    handle: {} as FileSystemFileHandle,
    filename,
  };
}

describe('folderScan — isVideoFile', () => {
  it('returns true for .mp4', () => {
    expect(isVideoFile('movie.mp4')).toBe(true);
  });
  it('returns true for .webm', () => {
    expect(isVideoFile('clip.webm')).toBe(true);
  });
  it('returns true for .mov', () => {
    expect(isVideoFile('clip.mov')).toBe(true);
  });
  it('returns false for .srt', () => {
    expect(isVideoFile('movie.srt')).toBe(false);
  });
  it('returns false for no extension', () => {
    expect(isVideoFile('README')).toBe(false);
  });
  it('is case-insensitive', () => {
    expect(isVideoFile('MOVIE.MP4')).toBe(true);
  });
});

describe('folderScan — isSubtitleFile', () => {
  it('returns true for .srt', () => {
    expect(isSubtitleFile('movie.srt')).toBe(true);
  });
  it('returns true for .vtt', () => {
    expect(isSubtitleFile('movie.vtt')).toBe(true);
  });
  it('returns true for .ass', () => {
    expect(isSubtitleFile('movie.ass')).toBe(true);
  });
  it('returns false for .mp4', () => {
    expect(isSubtitleFile('movie.mp4')).toBe(false);
  });
  it('is case-insensitive', () => {
    expect(isSubtitleFile('MOVIE.SRT')).toBe(true);
  });
});

describe('folderScan — matchVideosWithSubtitles', () => {
  it('matches video with subtitle by base name', () => {
    const videos = [makeVideoResult('Movie.mp4')];
    const subs = ['Movie.en.srt'];
    const result = matchVideosWithSubtitles(videos, subs, 'en', 'vi');
    expect(result).toHaveLength(1);
    expect(result[0].subtitles.target).not.toBeNull();
    expect(result[0].subtitles.target?.filename).toBe('Movie.en.srt');
  });

  it('matches video with subtitle without language code as fallback', () => {
    const videos = [makeVideoResult('Movie.mp4')];
    const subs = ['Movie.srt'];
    const result = matchVideosWithSubtitles(videos, subs, 'en', 'vi');
    expect(result[0].subtitles.target).not.toBeNull();
    expect(result[0].subtitles.target?.filename).toBe('Movie.srt');
  });

  it('returns null target when no subtitle matches', () => {
    const videos = [makeVideoResult('Movie.mp4')];
    const subs = ['Other.en.srt'];
    const result = matchVideosWithSubtitles(videos, subs, 'en', 'vi');
    expect(result[0].subtitles.target).toBeNull();
  });

  it('matches target + native for bilingual', () => {
    const videos = [makeVideoResult('Movie.mp4')];
    const subs = ['Movie.en.srt', 'Movie.vi.srt'];
    const result = matchVideosWithSubtitles(videos, subs, 'en', 'vi');
    expect(result[0].subtitles.target?.filename).toBe('Movie.en.srt');
    expect(result[0].subtitles.native?.filename).toBe('Movie.vi.srt');
  });

  it('strips resolution suffix when matching', () => {
    const videos = [makeVideoResult('Movie_720p.mp4')];
    const subs = ['Movie.en.srt'];
    const result = matchVideosWithSubtitles(videos, subs, 'en', 'vi');
    expect(result[0].subtitles.target).not.toBeNull();
  });

  it('handles multiple videos with different subtitles', () => {
    const videos = [makeVideoResult('Movie1.mp4'), makeVideoResult('Movie2.mp4')];
    const subs = ['Movie1.en.srt', 'Movie2.en.srt'];
    const result = matchVideosWithSubtitles(videos, subs, 'en', 'vi');
    expect(result).toHaveLength(2);
    expect(result[0].subtitles.target?.filename).toBe('Movie1.en.srt');
    expect(result[1].subtitles.target?.filename).toBe('Movie2.en.srt');
  });

  it('handles empty subtitle list', () => {
    const videos = [makeVideoResult('Movie.mp4')];
    const result = matchVideosWithSubtitles(videos, [], 'en', 'vi');
    expect(result[0].subtitles.target).toBeNull();
  });

  it('handles empty video list', () => {
    const result = matchVideosWithSubtitles([], ['Movie.en.srt'], 'en', 'vi');
    expect(result).toEqual([]);
  });
});
