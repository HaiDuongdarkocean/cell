import { findSubtitlesForOverlay, findPreferredMatch, type SubtitlePreference } from '@/features/subtitle/service/subtitleService';
import { DEFAULT_SETTINGS } from '@/shared/config/config';
import type { DetectedSubtitle, Settings } from '@/types/media';

describe('findSubtitlesForOverlay', () => {
  const baseSettings: Settings = {
    ...DEFAULT_SETTINGS,
    autoSelectEnabled: true,
    subtitleOverlayTargetLanguage: 'en',
    subtitleOverlayNativeLanguage: 'vi',
    subtitleOverlayAutoLoad: true,
  };

  const makeSubtitle = (language: string, url = `https://example.com/sub.${language}.srt`): DetectedSubtitle => ({
    id: `sub-${language}`,
    url,
    format: 'srt',
    language,
    tabId: 1,
    detectedAt: Date.now(),
  });

  it('returns both target and native when both languages match', () => {
    const subtitles = [makeSubtitle('en'), makeSubtitle('vi')];
    const result = findSubtitlesForOverlay(subtitles, baseSettings);
    expect(result).not.toBeNull();
    expect(result?.target?.language).toBe('en');
    expect(result?.native?.language).toBe('vi');
  });

  it('returns null when autoLoad is disabled', () => {
    const subtitles = [makeSubtitle('en'), makeSubtitle('vi')];
    const settings = { ...baseSettings, subtitleOverlayAutoLoad: false };
    expect(findSubtitlesForOverlay(subtitles, settings)).toBeNull();
  });

  it('returns null when both languages are empty', () => {
    const subtitles = [makeSubtitle('en')];
    const settings = {
      ...baseSettings,
      subtitleOverlayTargetLanguage: '',
      subtitleOverlayNativeLanguage: '',
    };
    expect(findSubtitlesForOverlay(subtitles, settings)).toBeNull();
  });

  it('returns partial load (target only) when only target language set and matches', () => {
    const subtitles = [makeSubtitle('en')];
    const settings = { ...baseSettings, subtitleOverlayNativeLanguage: '' };
    const result = findSubtitlesForOverlay(subtitles, settings);
    expect(result).not.toBeNull();
    expect(result?.target?.language).toBe('en');
    expect(result?.native).toBeNull();
  });

  it('returns partial load (native only) when only native language set and matches', () => {
    const subtitles = [makeSubtitle('vi')];
    const settings = { ...baseSettings, subtitleOverlayTargetLanguage: '' };
    const result = findSubtitlesForOverlay(subtitles, settings);
    expect(result).not.toBeNull();
    expect(result?.target).toBeNull();
    expect(result?.native?.language).toBe('vi');
  });

  it('returns null when no subtitle matches either language', () => {
    const subtitles = [makeSubtitle('ja'), makeSubtitle('ko')];
    expect(findSubtitlesForOverlay(subtitles, baseSettings)).toBeNull();
  });

  it('matches Chinese macrolanguage zh to zh-hans/zh-hant for auto-load', () => {
    const subtitles = [makeSubtitle('zh-hans'), makeSubtitle('zh-hant'), makeSubtitle('en')];
    const settings = { ...baseSettings, subtitleOverlayTargetLanguage: 'zh' };
    const result = findSubtitlesForOverlay(subtitles, settings);
    expect(result).not.toBeNull();
    expect(result?.target?.language).toBe('zh-hans');
    expect(result?.targetMatches?.length).toBe(2);
  });

  it('matches zh-hans target only to zh-hans (not zh-hant)', () => {
    const subtitles = [makeSubtitle('zh-hans'), makeSubtitle('zh-hant'), makeSubtitle('en')];
    const settings = { ...baseSettings, subtitleOverlayTargetLanguage: 'zh-hans' };
    const result = findSubtitlesForOverlay(subtitles, settings);
    expect(result).not.toBeNull();
    expect(result?.target?.language).toBe('zh-hans');
    expect(result?.targetMatches?.length).toBe(0); // only 1 match → no dropdown list
  });

  it('matches zh-hant target only to zh-hant (not zh-hans)', () => {
    const subtitles = [makeSubtitle('zh-hans'), makeSubtitle('zh-hant'), makeSubtitle('en')];
    const settings = { ...baseSettings, subtitleOverlayTargetLanguage: 'zh-hant' };
    const result = findSubtitlesForOverlay(subtitles, settings);
    expect(result).not.toBeNull();
    expect(result?.target?.language).toBe('zh-hant');
    expect(result?.targetMatches?.length).toBe(0); // only 1 match → no dropdown list
  });

  it('returns null when subtitles array is empty', () => {
    expect(findSubtitlesForOverlay([], baseSettings)).toBeNull();
  });

  it('matches case-insensitively (EN vs en, VI vs vi)', () => {
    const subtitles = [makeSubtitle('EN'), makeSubtitle('VI')];
    const result = findSubtitlesForOverlay(subtitles, baseSettings);
    expect(result).not.toBeNull();
    expect(result?.target?.language).toBe('EN');
    expect(result?.native?.language).toBe('VI');
  });

  it('trims whitespace in language settings', () => {
    const subtitles = [makeSubtitle('en'), makeSubtitle('vi')];
    const settings = {
      ...baseSettings,
      subtitleOverlayTargetLanguage: '  en  ',
      subtitleOverlayNativeLanguage: '  vi  ',
    };
    const result = findSubtitlesForOverlay(subtitles, settings);
    expect(result).not.toBeNull();
    expect(result?.target?.language).toBe('en');
    expect(result?.native?.language).toBe('vi');
  });

  it('picks first matching subtitle when 2+ share the same target language (V1 first-match)', () => {
    const first = makeSubtitle('en', 'https://example.com/first-en.srt');
    const second = makeSubtitle('en', 'https://example.com/second-en.srt');
    const result = findSubtitlesForOverlay([first, second], baseSettings);
    expect(result?.target?.url).toBe('https://example.com/first-en.srt');
  });

  it('returns partial load when target matches but native language has no matching sub', () => {
    const subtitles = [makeSubtitle('en'), makeSubtitle('ja')];
    const result = findSubtitlesForOverlay(subtitles, baseSettings);
    expect(result).not.toBeNull();
    expect(result?.target?.language).toBe('en');
    expect(result?.native).toBeNull();
  });

  it('ADR-014 D2: uses preference target index when provided', () => {
    const first = makeSubtitle('en', 'https://example.com/first-en.srt');
    const second = makeSubtitle('en', 'https://example.com/second-en.srt');
    const prefs: SubtitlePreference = { target: 1 };
    const result = findSubtitlesForOverlay([first, second], baseSettings, prefs);
    expect(result?.target?.url).toBe('https://example.com/second-en.srt');
  });

  it('ADR-014 D2: uses preference native index when provided', () => {
    const firstVi = makeSubtitle('vi', 'https://example.com/first-vi.srt');
    const secondVi = makeSubtitle('vi', 'https://example.com/second-vi.srt');
    const prefs: SubtitlePreference = { native: 1 };
    const result = findSubtitlesForOverlay([makeSubtitle('en'), firstVi, secondVi], baseSettings, prefs);
    expect(result?.native?.url).toBe('https://example.com/second-vi.srt');
  });

  it('ADR-014 D2: falls back to first-match when preference index out of range (B8)', () => {
    const first = makeSubtitle('en', 'https://example.com/first-en.srt');
    const second = makeSubtitle('en', 'https://example.com/second-en.srt');
    const prefs: SubtitlePreference = { target: 5 };
    const result = findSubtitlesForOverlay([first, second], baseSettings, prefs);
    expect(result?.target?.url).toBe('https://example.com/first-en.srt');
  });

  it('ADR-014 D2: no preferences → first-match (V1 behavior, B11 regression)', () => {
    const first = makeSubtitle('en', 'https://example.com/first-en.srt');
    const second = makeSubtitle('en', 'https://example.com/second-en.srt');
    const result = findSubtitlesForOverlay([first, second], baseSettings);
    expect(result?.target?.url).toBe('https://example.com/first-en.srt');
  });
});

describe('findPreferredMatch (ADR-014 D2 — preference-aware, V2 ADR-007 D3)', () => {
  const makeSubtitle = (language: string, url = `https://example.com/sub.${language}.srt`): DetectedSubtitle => ({
    id: `sub-${language}-${url}`,
    url,
    format: 'srt',
    language,
    tabId: 1,
    detectedAt: Date.now(),
  });

  it('returns first match when preferredIndex undefined (V1 fallback)', () => {
    const subs = [makeSubtitle('en', 'https://x/first.srt'), makeSubtitle('en', 'https://x/second.srt')];
    const result = findPreferredMatch(subs, 'en');
    expect(result?.url).toBe('https://x/first.srt');
  });

  it('returns sub at preferredIndex when index in range', () => {
    const subs = [makeSubtitle('en', 'https://x/first.srt'), makeSubtitle('en', 'https://x/second.srt')];
    const result = findPreferredMatch(subs, 'en', 1);
    expect(result?.url).toBe('https://x/second.srt');
  });

  it('falls back to first match when preferredIndex out of range (B8)', () => {
    const subs = [makeSubtitle('en', 'https://x/first.srt'), makeSubtitle('en', 'https://x/second.srt')];
    const result = findPreferredMatch(subs, 'en', 5);
    expect(result?.url).toBe('https://x/first.srt');
  });

  it('returns null when no subtitle matches language', () => {
    const subs = [makeSubtitle('en'), makeSubtitle('vi')];
    expect(findPreferredMatch(subs, 'zh', 0)).toBeNull();
  });

  it('matches BCP 47 subtags: zh-hans and zh-hant both match target zh', () => {
    const hans = makeSubtitle('zh-hans', 'https://x/hans.srt');
    const hant = makeSubtitle('zh-hant', 'https://x/hant.srt');
    const result = findPreferredMatch([hans, hant], 'zh');
    expect(result?.url).toBe('https://x/hans.srt');
  });

  it('falls back from specific target zh-hans to generic zh subtitle', () => {
    const zh = makeSubtitle('zh', 'https://x/zh.srt');
    const result = findPreferredMatch([zh], 'zh-hans');
    expect(result?.url).toBe('https://x/zh.srt');
  });

  it('does not match zh-hant when target is zh-hans', () => {
    const hant = makeSubtitle('zh-hant', 'https://x/hant.srt');
    expect(findPreferredMatch([hant], 'zh-hans')).toBeNull();
  });

  it('returns null when language is empty', () => {
    const subs = [makeSubtitle('en')];
    expect(findPreferredMatch(subs, '', 0)).toBeNull();
  });

  it('matches case-insensitively (EN vs en)', () => {
    const subs = [makeSubtitle('EN', 'https://x/first.srt'), makeSubtitle('EN', 'https://x/second.srt')];
    const result = findPreferredMatch(subs, 'en', 1);
    expect(result?.url).toBe('https://x/second.srt');
    expect(result?.language).toBe('EN');
  });

  it('returns null when subtitles array is empty', () => {
    expect(findPreferredMatch([], 'en', 0)).toBeNull();
  });

  it('preferredIndex=0 returns first match (explicit first)', () => {
    const subs = [makeSubtitle('en', 'https://x/first.srt'), makeSubtitle('en', 'https://x/second.srt')];
    const result = findPreferredMatch(subs, 'en', 0);
    expect(result?.url).toBe('https://x/first.srt');
  });

  it('filters only matching language (ignores other languages)', () => {
    const subs = [
      makeSubtitle('vi', 'https://x/vi.srt'),
      makeSubtitle('en', 'https://x/en1.srt'),
      makeSubtitle('fr', 'https://x/fr.srt'),
      makeSubtitle('en', 'https://x/en2.srt'),
    ];
    const result = findPreferredMatch(subs, 'en', 1);
    expect(result?.url).toBe('https://x/en2.srt');
  });
});
