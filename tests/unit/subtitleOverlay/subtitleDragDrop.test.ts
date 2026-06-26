import { handleFileDrop, readFileAsText } from '../../../src/content/subtitleDragDrop';

describe('subtitleDragDrop', () => {
  describe('readFileAsText', () => {
    it('should read file content as text', async () => {
      const file = new File(['Hello world'], 'test.srt', { type: 'text/plain' });
      const text = await readFileAsText(file);
      expect(text).toBe('Hello world');
    });
  });

  describe('handleFileDrop', () => {
    const mockSrtContent = `1
00:00:01,000 --> 00:00:02,000
Hello world`;

    it('should parse valid SRT file', async () => {
      const file = new File([mockSrtContent], 'test.srt', { type: 'text/plain' });
      const result = await handleFileDrop(file);
      expect(result.success).toBe(true);
      expect(result.cues.length).toBe(1);
      expect(result.cues[0].text).toBe('Hello world');
    });

    it('should reject non-subtitle file extension', async () => {
      const file = new File([mockSrtContent], 'test.txt', { type: 'text/plain' });
      const result = await handleFileDrop(file);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported file type');
    });

    it('should accept .vtt extension', async () => {
      const vttContent = `WEBVTT

00:00:01.000 --> 00:00:02.000
Hello world`;
      const file = new File([vttContent], 'test.vtt', { type: 'text/plain' });
      const result = await handleFileDrop(file);
      expect(result.success).toBe(true);
      expect(result.cues.length).toBe(1);
    });

    it('should accept .ass extension (fallback to srt parser)', async () => {
      // ASS will fail parsing as SRT, but should attempt
      const file = new File([mockSrtContent], 'test.ass', { type: 'text/plain' });
      const result = await handleFileDrop(file);
      expect(result.success).toBe(true);
    });

    it('should return error for empty file', async () => {
      const file = new File([''], 'empty.srt', { type: 'text/plain' });
      const result = await handleFileDrop(file);
      expect(result.success).toBe(false);
    });
  });
});
