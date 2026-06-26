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

    it('should accept .ass extension (convert ASS→SRT then parse)', async () => {
      const assContent = `[Script Info]
Title: Test

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello world`;
      const file = new File([assContent], 'test.ass', { type: 'text/plain' });
      const result = await handleFileDrop(file);
      expect(result.success).toBe(true);
      expect(result.cues.length).toBe(1);
      expect(result.cues[0].text).toBe('Hello world');
    });

    it('should return error for empty file', async () => {
      const file = new File([''], 'empty.srt', { type: 'text/plain' });
      const result = await handleFileDrop(file);
      expect(result.success).toBe(false);
    });
  });
});
