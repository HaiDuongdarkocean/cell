import {
  arrayBufferToBase64,
  buildAnkiFieldRef,
  joinAnkiFieldRefs,
  generateMediaFilename,
  mediaFromAudioItem,
  mediaFromImageItem,
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
        buildAnkiFieldRef({ kind: 'image', filename: 'Tihoka-screenshot.png' }),
      ).toBe('<img src="Tihoka-screenshot.png">');
    });

    it('audio → [sound:...]', () => {
      expect(
        buildAnkiFieldRef({ kind: 'audio', filename: 'Tihoka-sentence.mp3' }),
      ).toBe('[sound:Tihoka-sentence.mp3]');
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
      expect(name).toMatch(/^Tihoka-screenshot-\d+-[a-z0-9]+\.png$/);
    });

    it('generates unique names (random suffix)', () => {
      const a = generateMediaFilename('sentence', 'mp3');
      const b = generateMediaFilename('sentence', 'mp3');
      expect(a).not.toBe(b);
    });
  });

  describe('mediaFromAudioItem', () => {
    it('builds a wav file from raw audio bytes', async () => {
      const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
      const file = await mediaFromAudioItem({
        id: 'audio-1',
        kind: 'word',
        source: 'community',
        label: 'Forvo',
        state: 'idle',
        audioBytes: bytes,
        defaultSelected: true,
      });
      expect(file).not.toBeNull();
      expect(file!.kind).toBe('audio');
      expect(file!.mimeType).toBe('audio/wav');
      expect(file!.sourceUrl).toBe('audio-bytes://audio-1');
      expect(new Uint8Array(file!.data)).toEqual(bytes);
    });

    it('returns null when there are no bytes and no url', async () => {
      const file = await mediaFromAudioItem({
        id: 'audio-2',
        kind: 'word',
        source: 'community',
        label: 'Forvo',
        state: 'idle',
        defaultSelected: true,
      });
      expect(file).toBeNull();
    });

    it('builds a file from a data URL without fetching', async () => {
      const dataUrl = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
      const file = await mediaFromAudioItem({
        id: 'audio-3',
        kind: 'word',
        source: 'community',
        label: 'Forvo',
        state: 'idle',
        url: dataUrl,
        defaultSelected: true,
      });
      expect(file).not.toBeNull();
      expect(file!.kind).toBe('audio');
      expect(file!.mimeType).toBe('audio/wav');
      expect(file!.sourceUrl).toBe(dataUrl);
    });

    it('falls back to null when the url cannot be fetched', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });
      const file = await mediaFromAudioItem({
        id: 'audio-4',
        kind: 'word',
        source: 'community',
        label: 'Forvo',
        state: 'idle',
        url: 'http://example.com/audio.mp3',
        defaultSelected: true,
      });
      expect(file).toBeNull();
      global.fetch = originalFetch;
    });
  });

  describe('mediaFromImageItem', () => {
    it('returns null when src is empty', async () => {
      const file = await mediaFromImageItem({
        id: 'img-1',
        alt: '',
        src: '',
        defaultSelected: true,
      });
      expect(file).toBeNull();
    });

    it('builds a file from a data URL without fetching', async () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
      const file = await mediaFromImageItem({
        id: 'img-2',
        alt: 'screenshot',
        src: dataUrl,
        defaultSelected: true,
      });
      expect(file).not.toBeNull();
      expect(file!.kind).toBe('image');
      expect(file!.mimeType).toBe('image/png');
      expect(file!.sourceUrl).toBe(dataUrl);
    });

    it('falls back to null when the url cannot be fetched', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });
      const file = await mediaFromImageItem({
        id: 'img-3',
        alt: 'screenshot',
        src: 'http://example.com/image.png',
        defaultSelected: true,
      });
      expect(file).toBeNull();
      global.fetch = originalFetch;
    });
  });
});
