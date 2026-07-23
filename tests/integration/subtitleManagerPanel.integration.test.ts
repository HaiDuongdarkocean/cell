import { parseAndDetectFiles, assignImportRole } from '@/features/subtitle/logic/subtitleImport';
import { createSubtitleManagerPanel } from '@/features/subtitle/ui/subtitleManagerPanel';
import { SubtitleOverlayController } from '@/features/subtitle/ui/subtitleOverlay';
import { injectThemeTokens } from '@/shared/lib/themeTokens';
import { DEFAULT_OVERLAY_STYLE_TARGET, DEFAULT_OVERLAY_STYLE_NATIVE } from '@/shared/config/config';
import type { OverlayConfig } from '@/types/subtitle';

// Mock chrome.storage.local for injectThemeTokens
beforeAll(() => {
  (global as any).chrome = (global as any).chrome ?? {};
  (global as any).chrome.storage = (global as any).chrome.storage ?? {};
  (global as any).chrome.storage.local = {
    get: jest.fn(() => Promise.resolve({})),
    set: jest.fn(() => Promise.resolve()),
  };
  (global as any).chrome.storage.onChanged = {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  };
});

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
 * Integration test: ADR-015 Subtitle Manager Panel end-to-end flow.
 *
 * Flow: 2 files (en + ar) dropped → parseAndDetectFiles → assignImportRole
 * → panel.updateTarget/Native → chip shows both → click item #2 →
 * loadBilingualCues → overlay shows new text.
 */
describe('ADR-015 Subtitle Manager Panel integration', () => {
  let video: HTMLVideoElement;
  let container: HTMLDivElement;

  beforeEach(() => {
    video = document.createElement('video');
    container = document.createElement('div');
    container.style.position = 'relative';
    container.appendChild(video);
    document.body.appendChild(container);
    injectThemeTokens(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const enSrt = `1
00:00:01,000 --> 00:00:02,000
Hello world

2
00:00:03,000 --> 00:00:04,000
Goodbye world`;

  const arSrt = `1
00:00:01,000 --> 00:00:02,000
مرحبا بالعالم

2
00:00:03,000 --> 00:00:04,000
وداعا بالعالم`;

  it('end-to-end: 2 files (en+ar) → panel shows both → chip → select #2 → overlay', async () => {
    // === Step 1: create panel + controller ===
    let selectedRole: 'target' | 'native' | null = null;
    let selectedIndex = -1;
    const panel = createSubtitleManagerPanel(container, {
      onSelect: (role: 'target' | 'native', index: number) => {
        selectedRole = role;
        selectedIndex = index;
      },
    });
    const controller = new SubtitleOverlayController(
      video,
      defaultConfig,
      DEFAULT_OVERLAY_STYLE_TARGET,
      DEFAULT_OVERLAY_STYLE_NATIVE,
    );
    controller.init(container);

    // === Step 2: 2 files dropped → parse + detect + assign ===
    const files = [
      new File([enSrt], 'movie-en.srt', { type: 'text/plain' }),
      new File([arSrt], 'movie-ar.srt', { type: 'text/plain' }),
    ];
    const parsed = await parseAndDetectFiles(files);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].detectedLang).toBe('english');
    expect(parsed[1].detectedLang).toBe('arabic');

    const assignment = assignImportRole(parsed, 'en', 'ar');
    expect(assignment.target).toHaveLength(1);
    expect(assignment.native).toHaveLength(1);

    // === Step 3: panel.updateTarget/Native ===
    const targetItems = assignment.target.map((f, i) => ({
      id: `imported-target-${i}`,
      name: f.file.name.replace(/\.srt$/, ''),
      format: f.format,
      size: f.file.size,
      source: 'imported' as const,
      role: 'target' as const,
      index: i,
    }));
    const nativeItems = assignment.native.map((f, i) => ({
      id: `imported-native-${i}`,
      name: f.file.name.replace(/\.srt$/, ''),
      format: f.format,
      size: f.file.size,
      source: 'imported' as const,
      role: 'native' as const,
      index: i,
    }));
    panel.updateTarget(targetItems, 0);
    panel.updateNative(nativeItems, 0);

    // === Step 4: load cues (first target + first native) ===
    controller.loadBilingualCues(assignment.target[0].cues, assignment.native[0].cues);

    // === Step 6: open panel + click target item ===
    panel.icon.click();
    expect(panel.panel.classList.contains('subtitle-manager-panel--open')).toBe(true);
    const targetItem = document.querySelector('[data-testid="manager-item-target-0"]') as HTMLElement;
    expect(targetItem).toBeTruthy();
    targetItem.click();
    expect(selectedRole).toBe('target');
    expect(selectedIndex).toBe(0);

    // === Step 7: verify overlay shows target text at t=1.5s ===
    Object.defineProperty(video, 'currentTime', { value: 1.5, configurable: true });
    video.dispatchEvent(new Event('timeupdate'));
    const targetSpan = document.querySelector('[data-testid="overlay-target-text"]') as HTMLSpanElement;
    expect(targetSpan.textContent).toBe('Hello world');

    // === Step 8: close panel via close button ===
    const closeBtn = document.querySelector('[data-testid="subtitle-manager-close"]') as HTMLButtonElement;
    closeBtn.click();
    expect(panel.panel.classList.contains('subtitle-manager-panel--open')).toBe(false);

    panel.destroy();
    controller.destroy();
  });

  it('3 files (2 en + 1 zh) → 2 target + 1 ignored (C8) + fallback not triggered', async () => {
    const zhSrt = `1
00:00:01,000 --> 00:00:02,000
你好世界，今天怎么样

2
00:00:03,000 --> 00:00:04,000
我很好，谢谢`;
    const files = [
      new File([enSrt], 'en1.srt', { type: 'text/plain' }),
      new File([enSrt], 'en2.srt', { type: 'text/plain' }),
      new File([zhSrt], 'zh.srt', { type: 'text/plain' }),
    ];
    const parsed = await parseAndDetectFiles(files);
    const assignment = assignImportRole(parsed, 'en', 'ar');
    expect(assignment.target).toHaveLength(2); // 2 en
    expect(assignment.native).toHaveLength(0); // no ar
    expect(assignment.ignored).toHaveLength(1); // zh (NOT promoted — target non-empty)
  });

  it('1 file neither-lang → fallback target (Assumption #5)', async () => {
    const files = [new File([enSrt], 'unknown.srt', { type: 'text/plain' })];
    const parsed = await parseAndDetectFiles(files);
    const assignment = assignImportRole(parsed, 'zh', 'ja'); // neither matches en
    expect(assignment.target).toHaveLength(1); // fallback promoted
    expect(assignment.ignored).toHaveLength(0);
  });

  it('panel sections collapsible when no subs', () => {
    const panel = createSubtitleManagerPanel(container);
    // Open panel
    panel.icon.click();
    // Collapse target section
    const header = document.querySelector('[data-testid="manager-section-header"][data-role="target"]') as HTMLElement;
    const body = document.querySelector('[data-testid="manager-section-body"][data-role="target"]') as HTMLElement;
    expect(body.style.display).not.toBe('none');
    header.click();
    expect(body.style.display).toBe('none');
    panel.destroy();
  });

  it('Esc closes panel', () => {
    const panel = createSubtitleManagerPanel(container);
    panel.icon.click();
    expect(panel.panel.classList.contains('subtitle-manager-panel--open')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(panel.panel.classList.contains('subtitle-manager-panel--open')).toBe(false);
    panel.destroy();
  });
});
