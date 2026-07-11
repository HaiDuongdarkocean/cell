import {
  arrayBufferToBase64,
  buildAnkiFieldRef,
  joinAnkiFieldRefs,
  generateMediaFilename,
  type MediaFile,
} from './mediaFile';

describe('mediaFile', () => {
  describe('arrayBufferToBase64', () => {
    it('converts empty buffer to empty string', () => {
      expect(arrayBufferToBase64(new ArrayBuffer(0))).toBe('');
    });

    it('converts "hello" bytes correctly', () => {
      const encoder = new TextEncoder();
      const buf = encoder.encode('hello').buffer;
      // "hello" in base64 = "aGVsbG8="
      expect(arrayBufferToBase64(buf)).toBe('aGVsbG8=');
    });

    it('handles large buffers without stack overflow', () => {
      // 100KB buffer — would overflow String.fromCharCode if not chunked
      const bytes = new Uint8Array(100 * 1024);
      bytes.fill(65); // 'A'
      const result = arrayBufferToBase64(bytes.buffer);
      // 100KB of 'A' → base64 length = 100*1024 * 4/3 ≈ 136534 chars
      expect(result.length).toBeGreaterThan(130000);
      // First char of base64('AAA...') = 'Q'
      expect(result[0]).toBe('Q');
    });
  });

  describe('buildAnkiFieldRef', () => {
    it('image → <img src="...">', () => {
      expect(
        buildAnkiFieldRef({ kind: 'image', filename: 'cell-screenshot.png' }),
      ).toBe('<img src="cell-screenshot.png">');
    });

    it('audio → [sound:...]', () => {
      expect(
        buildAnkiFieldRef({ kind: 'audio', filename: 'cell-sentence.mp3' }),
      ).toBe('[sound:cell-sentence.mp3]');
    });
  });

  describe('joinAnkiFieldRefs', () => {
    it('empty → empty string', () => {
      expect(joinAnkiFieldRefs([])).toBe('');
    });

    it('images joined with <br>', () => {
      const files: MediaFile[] = [
        { kind: 'image', filename: 'a.png', mimeType: 'image/png', data: new ArrayBuffer(0) },
        { kind: 'image', filename: 'b.png', mimeType: 'image/png', data: new ArrayBuffer(0) },
      ];
      expect(joinAnkiFieldRefs(files)).toBe('<img src="a.png"><br><img src="b.png">');
    });

    it('audio joined with space', () => {
      const files: MediaFile[] = [
        { kind: 'audio', filename: 'a.mp3', mimeType: 'audio/mpeg', data: new ArrayBuffer(0) },
        { kind: 'audio', filename: 'b.mp3', mimeType: 'audio/mpeg', data: new ArrayBuffer(0) },
      ];
      expect(joinAnkiFieldRefs(files)).toBe('[sound:a.mp3] [sound:b.mp3]');
    });
  });

  describe('generateMediaFilename', () => {
    it('includes prefix + extension', () => {
      const name = generateMediaFilename('screenshot', 'png');
      expect(name).toMatch(/^cell-screenshot-\d+-[a-z0-9]+\.png$/);
    });

    it('generates unique names (random suffix)', () => {
      const a = generateMediaFilename('sentence', 'mp3');
      const b = generateMediaFilename('sentence', 'mp3');
      expect(a).not.toBe(b);
    });
  });
});
