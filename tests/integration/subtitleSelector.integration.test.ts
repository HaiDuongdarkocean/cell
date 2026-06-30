import { findSubtitlesForOverlay, findPreferredMatch, type SubtitlePreference } from '../../src/background/subtitleService';
import { createSubtitleDropdown } from '../../src/features/subtitle/ui/subtitleSelector';
import { SubtitleOverlayController } from '../../src/features/subtitle/ui/subtitleOverlay';
import { DEFAULT_KEYBOARD_SHORTCUTS, DEFAULT_OVERLAY_STYLE_TARGET, DEFAULT_OVERLAY_STYLE_NATIVE } from '../../src/shared/config/config';
import type { OverlayConfig } from '../../src/types/subtitle';
import type { DetectedSubtitle, Settings } from '../../src/types/media';

const defaultConfig: OverlayConfig = {
  targetLanguage: 'en',
  autoLoadEnabled: false,
  fontSize: 24,
  position: 'bottom',
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
  textColor: '#ffffff',
  showTimestamps: false,
};

/**
 * Integration test: ADR-014 subtitle selector V2 end-to-end flow.
 *
 * Flow: 2 sub same lang → findSubtitlesForOverlay (preference-aware) →
 * createSubtitleDropdown → click sub #2 → loadBilingualCues (D1 merge) →
 * save preference → reload → findSubtitlesForOverlay with preference → sub #2.
 */
describe('ADR-014 subtitle selector V2 integration', () => {
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
    subtitleOverlayNativeLanguage: 'vi',
    subtitleOverlayAutoLoad: true,
    subtitleOverlayTargetStyle: DEFAULT_OVERLAY_STYLE_TARGET,
    subtitleOverlayNativeStyle: DEFAULT_OVERLAY_STYLE_NATIVE,
    subtitlePreference: {},
    keyboardShortcuts: DEFAULT_KEYBOARD_SHORTCUTS,
  };

  const makeSub = (language: string, url: string, format: 'srt' | 'vtt' = 'srt'): DetectedSubtitle => ({
    id: `sub-${url}`,
    url,
    format,
    language,
    tabId: 1,
    detectedAt: Date.now(),
  });

  let video: HTMLVideoElement;
  let container: HTMLDivElement;

  beforeEach(() => {
    video = document.createElement('video');
    container = document.createElement('div');
    container.style.position = 'relative';
    container.appendChild(video);
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('end-to-end: 2 sub same lang → dropdown → select #2 → preference → reload → sub #2', () => {
    // === Step 1: 2 sub same lang detected ===
    const subs = [
      makeSub('en', 'https://x/en1.srt'),
      makeSub('en', 'https://x/en2.srt'),
      makeSub('vi', 'https://x/vi1.srt'),
    ];

    // === Step 2: findSubtitlesForOverlay (no preference → first-match) ===
    let result = findSubtitlesForOverlay(subs, baseSettings);
    expect(result).not.toBeNull();
    expect(result?.target?.url).toBe('https://x/en1.srt'); // first-match
    expect(result?.targetMatches?.length).toBe(2); // dropdown data
    expect(result?.native?.url).toBe('https://x/vi1.srt');

    // === Step 3: createSubtitleDropdown (≥2 target matches) ===
    const targetMatches = result!.targetMatches!;
    let activeIndex = 0;
    const { icon, destroy } = createSubtitleDropdown(
      'target',
      container,
      targetMatches.map((m) => ({ id: m.url, url: m.url, format: m.format as any, language: m.language, tabId: 0, detectedAt: 0 })),
      'en',
      activeIndex,
      (index) => { activeIndex = index; },
    );
    expect(icon.style.display).not.toBe('none');

    // === Step 4: open dropdown + select sub #2 ===
    icon.click();
    const item1 = document.querySelector('[data-testid="subtitle-selector-item-target-1"]') as HTMLDivElement;
    item1.click();
    expect(activeIndex).toBe(1);

    // === Step 5: save preference (simulate content-script save) ===
    const origin = 'themoviebox.org';
    const pref: Record<string, Record<string, number>> = {
      [origin]: { en: 1 },
    };
    const settingsWithPref = { ...baseSettings, subtitlePreference: pref };

    // === Step 6: reload → findSubtitlesForOverlay with preference ===
    const preferences: SubtitlePreference = {
      target: pref[origin]['en'],
    };
    result = findSubtitlesForOverlay(subs, settingsWithPref, preferences);
    expect(result?.target?.url).toBe('https://x/en2.srt'); // sub #2 (preference)

    // === Step 7: verify findPreferredMatch directly ===
    const direct = findPreferredMatch(subs, 'en', 1);
    expect(direct?.url).toBe('https://x/en2.srt');

    destroy();
  });

  it('bug A fix: loadBilingualCues merge — second push rỗng không clear cues cũ', () => {
    const controller = new SubtitleOverlayController(
      video,
      defaultConfig,
      DEFAULT_OVERLAY_STYLE_TARGET,
      DEFAULT_OVERLAY_STYLE_NATIVE,
    );
    controller.init();

    const targetCues = [{ index: 1, start: 0, end: 2000, text: 'Hello' }];
    const nativeCues = [{ index: 1, start: 0, end: 2000, text: 'Xin chào' }];
    controller.loadBilingualCues(targetCues, nativeCues);

    // Simulate second AUTO_LOAD_SUBTITLES push with only native (bug A scenario)
    const nativeCues2 = [{ index: 1, start: 0, end: 2000, text: 'Chào mới' }];
    controller.loadBilingualCues([], nativeCues2);

    Object.defineProperty(video, 'currentTime', { value: 0.5, configurable: true });
    video.dispatchEvent(new Event('timeupdate'));

    const targetSpan = document.querySelector('[data-testid="overlay-target-text"]') as HTMLSpanElement;
    const nativeSpan = document.querySelector('[data-testid="overlay-native-text"]') as HTMLSpanElement;
    // Target cues cũ giữ nguyên (D1 merge)
    expect(targetSpan.textContent).toBe('Hello');
    // Native cues mới ghi đè
    expect(nativeSpan.textContent).toBe('Chào mới');

    controller.destroy();
  });

  it('preference out of range → fallback first-match (B8)', () => {
    const subs = [makeSub('en', 'https://x/en1.srt'), makeSub('en', 'https://x/en2.srt')];
    const pref: SubtitlePreference = { target: 5 }; // out of range
    const result = findSubtitlesForOverlay(subs, baseSettings, pref);
    expect(result?.target?.url).toBe('https://x/en1.srt'); // fallback first
  });

  it('no preference → first-match (V1 behavior, B11 regression)', () => {
    const subs = [makeSub('en', 'https://x/en1.srt'), makeSub('en', 'https://x/en2.srt')];
    const result = findSubtitlesForOverlay(subs, baseSettings);
    expect(result?.target?.url).toBe('https://x/en1.srt');
  });

  it('dropdown hidden when only 1 sub (V1 behavior)', () => {
    const subs = [makeSub('en', 'https://x/en1.srt')];
    const result = findSubtitlesForOverlay(subs, baseSettings);
    expect(result?.targetMatches?.length ?? 0).toBe(0); // no dropdown data

    const { icon } = createSubtitleDropdown(
      'target',
      container,
      [result!.target!].map((m) => ({ id: m.url, url: m.url, format: m.format as any, language: m.language, tabId: 0, detectedAt: 0 })),
      'en',
      0,
      () => {},
    );
    expect(icon.style.display).toBe('none');
  });

  it('preference persists across reloads (origin → lang → index)', () => {
    const subs = [
      makeSub('en', 'https://x/en1.srt'),
      makeSub('en', 'https://x/en2.srt'),
      makeSub('vi', 'https://x/vi1.srt'),
    ];
    const origin = 'themoviebox.org';

    // First load: no preference → first-match
    let result = findSubtitlesForOverlay(subs, baseSettings);
    expect(result?.target?.url).toBe('https://x/en1.srt');

    // User selects sub #2 → save preference
    const pref: Record<string, Record<string, number>> = {
      [origin]: { en: 1 },
    };
    const settingsWithPref = { ...baseSettings, subtitlePreference: pref };

    // Reload: preference → sub #2
    const preferences: SubtitlePreference = { target: pref[origin]['en'] };
    result = findSubtitlesForOverlay(subs, settingsWithPref, preferences);
    expect(result?.target?.url).toBe('https://x/en2.srt');

    // Second reload: same preference → still sub #2
    result = findSubtitlesForOverlay(subs, settingsWithPref, preferences);
    expect(result?.target?.url).toBe('https://x/en2.srt');
  });
});
