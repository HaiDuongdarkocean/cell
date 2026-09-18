import { describe, expect, it } from '@jest/globals';
import { sanitizeSettingsPatch } from './settingsPatch';

describe('sanitizeSettingsPatch', () => {
  it('accepts a well-formed patch and preserves values', () => {
    const patch = sanitizeSettingsPatch({
      concurrentDownloads: 4,
      convertToMp4: 'never',
      subtitleOverlayTargetLanguage: 'ja',
      dictionaryPopup: { enabled: false },
      subtitlePreviewTargetText: 'hello',
    });
    expect(patch).toEqual({
      concurrentDownloads: 4,
      convertToMp4: 'never',
      subtitleOverlayTargetLanguage: 'ja',
      dictionaryPopup: { enabled: false },
      subtitlePreviewTargetText: 'hello',
    });
  });

  it('drops unknown keys', () => {
    expect(sanitizeSettingsPatch({ notASetting: 1, evil: {} })).toEqual({});
  });

  it('drops mistyped values', () => {
    expect(
      sanitizeSettingsPatch({
        concurrentDownloads: 'four',
        subtitleApiKeys: 'not-array',
        dictionaryPopup: 42,
      }),
    ).toEqual({});
  });

  it('drops invalid enum strings', () => {
    expect(sanitizeSettingsPatch({ convertToMp4: 'bogus' })).toEqual({});
    expect(sanitizeSettingsPatch({ defaultQuality: 'bogus' })).toEqual({});
    expect(sanitizeSettingsPatch({ uiLanguage: 'fr' })).toEqual({});
    expect(sanitizeSettingsPatch({ filenameSource: 'bogus' })).toEqual({});
    expect(sanitizeSettingsPatch({ preferredVideoFormat: 'avi' })).toEqual({});
  });

  it('accepts valid enum strings', () => {
    expect(sanitizeSettingsPatch({ defaultQuality: '720p' })).toEqual({ defaultQuality: '720p' });
    expect(sanitizeSettingsPatch({ parallelFallback: 'retry-reduced' })).toEqual({
      parallelFallback: 'retry-reduced',
    });
  });

  it('always drops schemaVersion', () => {
    expect(sanitizeSettingsPatch({ schemaVersion: 99 })).toEqual({});
    expect(sanitizeSettingsPatch({ schemaVersion: 'x' })).toEqual({});
  });

  it('accepts activeProfileId as null or string (null default)', () => {
    expect(sanitizeSettingsPatch({ activeProfileId: null })).toEqual({ activeProfileId: null });
    expect(sanitizeSettingsPatch({ activeProfileId: 'p1' })).toEqual({ activeProfileId: 'p1' });
    expect(sanitizeSettingsPatch({ activeProfileId: 7 })).toEqual({});
  });

  it('element-checks subtitleApiKeys entries', () => {
    const good = {
      id: 'k1',
      provider: 'subdl',
      key: 'secret',
      status: 'active',
      addedAt: 1,
    };
    expect(sanitizeSettingsPatch({ subtitleApiKeys: [good] })).toEqual({
      subtitleApiKeys: [good],
    });
    expect(sanitizeSettingsPatch({ subtitleApiKeys: [{ id: 1 }] })).toEqual({});
    expect(sanitizeSettingsPatch({ subtitleApiKeys: [42] })).toEqual({});
    expect(
      sanitizeSettingsPatch({ subtitleApiKeys: [{ ...good, provider: 'evil' }] }),
    ).toEqual({});
  });

  it('drops non-finite and non-integer-unsafe numbers on numeric keys', () => {
    expect(sanitizeSettingsPatch({ concurrentDownloads: Infinity })).toEqual({});
    expect(sanitizeSettingsPatch({ concurrentDownloads: NaN })).toEqual({});
    expect(sanitizeSettingsPatch({ concurrentDownloads: 2 })).toEqual({ concurrentDownloads: 2 });
  });

  it('drops array values on record keys and vice versa', () => {
    expect(sanitizeSettingsPatch({ subtitlePreference: [] })).toEqual({});
    expect(sanitizeSettingsPatch({ selectedSubtitleLanguages: 'en' })).toEqual({});
    expect(sanitizeSettingsPatch({ selectedSubtitleLanguages: ['en'] })).toEqual({
      selectedSubtitleLanguages: ['en'],
    });
  });

  it('skips undefined values without dropping sibling keys', () => {
    expect(
      sanitizeSettingsPatch({ convertToMp4: undefined, uiLanguage: 'vi' }),
    ).toEqual({ uiLanguage: 'vi' });
  });
});
