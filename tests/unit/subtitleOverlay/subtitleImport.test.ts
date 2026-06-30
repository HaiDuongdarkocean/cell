import { createImportButton, handleFileSelect, assignImportRole, parseAndDetectFiles } from '../../../src/content/subtitleImport';
import type { ParsedFile } from '../../../src/content/subtitleImport';
import type { OverlayConfig } from '../../../src/types/subtitle';

describe('subtitleImport', () => {
  let video: HTMLVideoElement;
  const defaultConfig: OverlayConfig = {
    targetLanguage: 'en',
    autoLoadEnabled: false,
    fontSize: 24,
    position: 'bottom',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    textColor: '#ffffff',
    showTimestamps: false,
  };

  beforeEach(() => {
    video = document.createElement('video');
    document.body.appendChild(video);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('createImportButton', () => {
    it('should create icon-only button (label role=button) appended to video parent', () => {
      const button = createImportButton(video, defaultConfig);
      expect(button).toBeTruthy();
      expect(button.tagName).toBe('LABEL');
      expect(button.getAttribute('role')).toBe('button');
      expect(video.parentElement?.contains(button)).toBe(true);
    });

    it('should contain a file input inside the button', () => {
      const button = createImportButton(video, defaultConfig);
      const input = button.querySelector('input[type="file"]');
      expect(input).toBeTruthy();
      expect(input?.getAttribute('accept')).toBe('.srt,.vtt,.ass,.ssa');
    });

    it('should allow multiple files (ADR-015 multi-file import)', () => {
      const button = createImportButton(video, defaultConfig);
      const input = button.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input.multiple).toBe(true);
    });

    it('should set data-testid for testing', () => {
      const button = createImportButton(video, defaultConfig);
      expect(button.getAttribute('data-testid')).toBe('subtitle-import-button');
    });

    it('should be 32x32 icon button (UI v4 toolbar)', () => {
      const button = createImportButton(video, defaultConfig);
      expect(button.style.width).toBe('32px');
      expect(button.style.height).toBe('32px');
      expect(button.style.position).toBe(''); // position is reset by panel toolbar
    });
  });

  describe('handleFileSelect', () => {
    it('should parse selected file and return ParseResult', async () => {
      const srtContent = `1
00:00:01,000 --> 00:00:02,000
Hello world`;
      const file = new File([srtContent], 'test.srt', { type: 'text/plain' });
      const result = await handleFileSelect(file);
      expect(result.success).toBe(true);
      expect(result.cues.length).toBe(1);
    });

    it('should reject unsupported file extension', async () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const result = await handleFileSelect(file);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported');
    });
  });

  describe('assignImportRole (ADR-015 — multi-file auto-detect role)', () => {
    const makeParsed = (name: string, detectedLang: string): ParsedFile => ({
      file: new File(['x'], name, { type: 'text/plain' }),
      detectedLang,
      cues: [],
      format: 'srt',
    });

    it('1 file target-lang → target only', () => {
      const files = [makeParsed('en-sub.srt', 'english')];
      const result = assignImportRole(files, 'en', 'ar');
      expect(result.target).toHaveLength(1);
      expect(result.native).toHaveLength(0);
      expect(result.ignored).toHaveLength(0);
    });

    it('1 file native-lang → native only', () => {
      const files = [makeParsed('ar-sub.srt', 'arabic')];
      const result = assignImportRole(files, 'en', 'ar');
      expect(result.target).toHaveLength(0);
      expect(result.native).toHaveLength(1);
      expect(result.ignored).toHaveLength(0);
    });

    it('1 file neither-lang → fallback target (spec Assumption #5)', () => {
      const files = [makeParsed('fr-sub.srt', 'french')];
      const result = assignImportRole(files, 'en', 'ar');
      expect(result.target).toHaveLength(1);
      expect(result.native).toHaveLength(0);
      expect(result.ignored).toHaveLength(0);
    });

    it('2 files (1 target + 1 native) → both sections', () => {
      const files = [makeParsed('en.srt', 'english'), makeParsed('ar.srt', 'arabic')];
      const result = assignImportRole(files, 'en', 'ar');
      expect(result.target).toHaveLength(1);
      expect(result.native).toHaveLength(1);
      expect(result.ignored).toHaveLength(0);
    });

    it('2 files same lang (target) → both in target section (C7)', () => {
      const files = [makeParsed('en1.srt', 'english'), makeParsed('en2.srt', 'english')];
      const result = assignImportRole(files, 'en', 'ar');
      expect(result.target).toHaveLength(2);
      expect(result.native).toHaveLength(0);
      expect(result.ignored).toHaveLength(0);
    });

    it('3 files (2 target-lang + 1 neither) → 2 target + 1 ignored (C8)', () => {
      const files = [
        makeParsed('en1.srt', 'english'),
        makeParsed('en2.srt', 'english'),
        makeParsed('fr.srt', 'french'),
      ];
      const result = assignImportRole(files, 'en', 'ar');
      expect(result.target).toHaveLength(2);
      expect(result.native).toHaveLength(0);
      expect(result.ignored).toHaveLength(1);
    });

    it('handles null detectedLang → ignored (then fallback target if target empty)', () => {
      const files = [makeParsed('unknown.srt', '')];
      const result = assignImportRole(files, 'en', 'ar');
      expect(result.target).toHaveLength(1); // fallback (target was empty)
      expect(result.ignored).toHaveLength(0);
    });

    it('case-insensitive ISO comparison', () => {
      const files = [makeParsed('en.srt', 'English')]; // capitalized label
      const result = assignImportRole(files, 'EN', 'AR');
      expect(result.target).toHaveLength(1);
    });
  });

  describe('parseAndDetectFiles (ADR-015 — multi-file import)', () => {
    it('parses and detects English .srt', async () => {
      const srt = `1
00:00:01,000 --> 00:00:02,000
Hello world

2
00:00:03,000 --> 00:00:04,000
Another line`;
      const file = new File([srt], 'en.srt', { type: 'text/plain' });
      const parsed = await parseAndDetectFiles([file]);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].format).toBe('srt');
      expect(parsed[0].cues.length).toBe(2);
      expect(parsed[0].detectedLang).toBe('english');
    });

    it('returns empty array for unsupported file', async () => {
      const file = new File(['x'], 'bad.txt', { type: 'text/plain' });
      const parsed = await parseAndDetectFiles([file]);
      expect(parsed).toHaveLength(0);
    });

    it('parses multiple files', async () => {
      const en = `1
00:00:01,000 --> 00:00:02,000
Hello`;
      const ar = `1
00:00:01,000 --> 00:00:02,000
مرحبا`;
      const files = [new File([en], 'en.srt', { type: 'text/plain' }), new File([ar], 'ar.srt', { type: 'text/plain' })];
      const parsed = await parseAndDetectFiles(files);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].detectedLang).toBe('english');
      expect(parsed[1].detectedLang).toBe('arabic');
    });
  });
});
