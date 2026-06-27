import { createImportButton, handleFileSelect } from '../../../src/content/subtitleImport';
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
    it('should create label (role=button) appended to video parent', () => {
      const button = createImportButton(video, defaultConfig);
      expect(button).toBeTruthy();
      expect(button.tagName).toBe('LABEL');
      expect(button.getAttribute('role')).toBe('button');
      expect(video.parentElement?.contains(button)).toBe(true);
    });

    it('should contain a file input inside the label', () => {
      const button = createImportButton(video, defaultConfig);
      const input = button.querySelector('input[type="file"]');
      expect(input).toBeTruthy();
      expect(input?.getAttribute('accept')).toBe('.srt,.vtt,.ass,.ssa');
    });

    it('should set data-testid for testing', () => {
      const button = createImportButton(video, defaultConfig);
      expect(button.getAttribute('data-testid')).toBe('subtitle-import-button');
    });

    it('should position at top-left of video to avoid toggle overlap', () => {
      const button = createImportButton(video, defaultConfig);
      expect(button.style.position).toBe('absolute');
      expect(button.style.top).toBe('8px');
      expect(button.style.left).toBe('8px');
      expect(button.style.right).toBe('');
    });

    it('should have high z-index to avoid being covered', () => {
      const button = createImportButton(video, defaultConfig);
      expect(button.style.zIndex).toBe('999999');
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
});
