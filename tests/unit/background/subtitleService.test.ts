import { findSubtitleForOverlay } from '../../../src/background/subtitleService';
import type { DetectedSubtitle, Settings } from '../../../src/types/media';

describe('findSubtitleForOverlay', () => {
  const baseSettings: Settings = {
    concurrentDownloads: 3,
    defaultQuality: 'highest',
    selectedSubtitleLanguages: ['all'],
    theme: 'light',
    convertToMp4: 'always',
    parallelConversion: 'auto',
    manualWorkerCount: 4,
    parallelFallback: 'sequential',
    segmentConcurrency: 6,
    filenameSource: 'title-fallback',
    preferredVideoFormat: 'm3u8',
    autoSelectEnabled: true,
    subtitleOverlayTargetLanguage: 'en',
    subtitleOverlayAutoLoad: true,
  };

  const makeSubtitle = (language: string, url = 'https://example.com/sub.srt'): DetectedSubtitle => ({
    id: `sub-${language}`,
    url,
    format: 'srt',
    language,
    tabId: 1,
    detectedAt: Date.now(),
  });

  it('should return matching subtitle when target language matches', () => {
    const subtitles = [makeSubtitle('en'), makeSubtitle('vi')];
    const result = findSubtitleForOverlay(subtitles, baseSettings);
    expect(result).not.toBeNull();
    expect(result?.language).toBe('en');
    expect(result?.url).toBe('https://example.com/sub.srt');
  });

  it('should return null when autoLoad is disabled', () => {
    const subtitles = [makeSubtitle('en')];
    const settings = { ...baseSettings, subtitleOverlayAutoLoad: false };
    expect(findSubtitleForOverlay(subtitles, settings)).toBeNull();
  });

  it('should return null when target language is empty', () => {
    const subtitles = [makeSubtitle('en')];
    const settings = { ...baseSettings, subtitleOverlayTargetLanguage: '' };
    expect(findSubtitleForOverlay(subtitles, settings)).toBeNull();
  });

  it('should return null when no subtitle matches target language', () => {
    const subtitles = [makeSubtitle('vi'), makeSubtitle('ja')];
    expect(findSubtitleForOverlay(subtitles, baseSettings)).toBeNull();
  });

  it('should match case-insensitively (EN vs en)', () => {
    const subtitles = [makeSubtitle('EN')];
    const result = findSubtitleForOverlay(subtitles, baseSettings);
    expect(result).not.toBeNull();
    expect(result?.language).toBe('EN');
  });

  it('should return null when subtitles array is empty', () => {
    expect(findSubtitleForOverlay([], baseSettings)).toBeNull();
  });

  it('should trim whitespace in target language', () => {
    const subtitles = [makeSubtitle('en')];
    const settings = { ...baseSettings, subtitleOverlayTargetLanguage: '  en  ' };
    const result = findSubtitleForOverlay(subtitles, settings);
    expect(result).not.toBeNull();
  });
});
