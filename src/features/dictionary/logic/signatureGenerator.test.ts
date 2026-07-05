import { computeSignature, computeSignatureFromHead, bufferToHex } from '@/features/dictionary/logic/signatureGenerator';

function strToU8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function makeFile(name: string, content: string): { size: number; name: string; slice: (s: number, e: number) => { arrayBuffer: () => Promise<ArrayBuffer> } } {
  const bytes = strToU8(content);
  return {
    size: bytes.length,
    name,
    slice: (start: number, end: number) => ({
      arrayBuffer: () => Promise.resolve(bytes.slice(start, end).buffer as ArrayBuffer),
    }),
  };
}

describe('signatureGenerator', () => {
  describe('bufferToHex', () => {
    it('converts empty buffer', () => {
      expect(bufferToHex(new ArrayBuffer(0))).toBe('');
    });
    it('converts known bytes', () => {
      const buf = new Uint8Array([0x00, 0xff, 0x0a, 0x10]).buffer;
      expect(bufferToHex(buf)).toBe('00ff0a10');
    });
    it('pads single-digit hex', () => {
      const buf = new Uint8Array([0x1, 0x2]).buffer;
      expect(bufferToHex(buf)).toBe('0102');
    });
  });

  describe('computeSignature', () => {
    it('returns sha256_size_name format', async () => {
      const file = makeFile('test.txt', 'hello world');
      const sig = await computeSignature(file);
      // sha256 is 64 hex chars + _size + _name
      expect(sig).toMatch(/^[0-9a-f]{64}_11_test$/);
    });

    it('is deterministic (same content = same signature)', async () => {
      const file1 = makeFile('test.txt', 'hello world');
      const file2 = makeFile('test.txt', 'hello world');
      const sig1 = await computeSignature(file1);
      const sig2 = await computeSignature(file2);
      expect(sig1).toBe(sig2);
    });

    it('differs for different content', async () => {
      const file1 = makeFile('test.txt', 'hello world');
      const file2 = makeFile('test.txt', 'goodbye world');
      const sig1 = await computeSignature(file1);
      const sig2 = await computeSignature(file2);
      expect(sig1).not.toBe(sig2);
    });

    it('differs for different name (same content)', async () => {
      const file1 = makeFile('test.txt', 'hello world');
      const file2 = makeFile('other.txt', 'hello world');
      const sig1 = await computeSignature(file1);
      const sig2 = await computeSignature(file2);
      expect(sig1).not.toBe(sig2);
    });

    it('differs for different size (same head, different size)', async () => {
      const sig1 = await computeSignatureFromHead(strToU8('hello'), 5, 'test');
      const sig2 = await computeSignatureFromHead(strToU8('hello'), 100, 'test');
      expect(sig1).not.toBe(sig2);
    });

    it('strips extension from name', async () => {
      const file = makeFile('archive.db.gz', 'data');
      const sig = await computeSignature(file);
      expect(sig).toMatch(/_4_archive\.db$/); // only last ext stripped
    });
  });

  describe('computeSignatureFromHead', () => {
    it('matches computeSignature for same input', async () => {
      const content = 'hello world';
      const bytes = strToU8(content);
      const file = makeFile('test.txt', content);
      const sig1 = await computeSignature(file);
      const sig2 = await computeSignatureFromHead(bytes, bytes.length, 'test.txt');
      expect(sig1).toBe(sig2);
    });
  });
});
