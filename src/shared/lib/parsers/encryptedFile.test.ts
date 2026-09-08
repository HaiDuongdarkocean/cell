import {
  isEncryptedFileContent,
  maybeDecryptEncryptedFile,
  decryptAndDetectFormat,
} from './encryptedFile';

function encryptRc4Hex(plain: string, prefix: string, key: string): string {
  const S = new Array<number>(256);
  for (let i = 0; i < 256; i++) S[i] = i;

  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key.charCodeAt(i % key.length)) & 0xff;
    [S[i], S[j]] = [S[j], S[i]];
  }

  let i = 0;
  j = 0;
  let encoded = '';
  for (let n = 0; n < plain.length; n++) {
    i = (i + 1) & 0xff;
    j = (j + S[i]) & 0xff;
    [S[i], S[j]] = [S[j], S[i]];
    const k = S[(S[i] + S[j]) & 0xff];
    const code = plain.charCodeAt(n) ^ k;
    encoded += code.toString(16).padStart(4, '0');
  }

  return `${prefix}${encoded}`;
}

describe('encrypted-file decryption', () => {
  const prefix = 'HUBPHIM_ENC:';
  const key = 'hubphim_sub_secret_key_2026';

  it('returns null for unknown or plain content', () => {
    expect(maybeDecryptEncryptedFile('WEBVTT\n\n1\n00:00:00 --> 00:00:01\nHello')).toBeNull();
    expect(maybeDecryptEncryptedFile('OTHER:deadbeef')).toBeNull();
  });

  it('detects a known encrypted payload', () => {
    expect(isEncryptedFileContent('HUBPHIM_ENC:0001')).toBe(true);
    expect(isEncryptedFileContent('WEBVTT')).toBe(false);
  });

  it('round-trips a WebVTT sample', () => {
    const plain = 'WEBVTT\n\n00:00:13.638 --> 00:00:15.932\n<i>Hello</i>';
    const encrypted = encryptRc4Hex(plain, prefix, key);

    expect(isEncryptedFileContent(encrypted)).toBe(true);
    const decrypted = maybeDecryptEncryptedFile(encrypted);
    expect(decrypted).toBe(plain);
  });

  it('decrypts and detects WebVTT format', () => {
    const plain = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nLine';
    const encrypted = encryptRc4Hex(plain, prefix, key);

    const { content, format } = decryptAndDetectFormat(encrypted);
    expect(content).toBe(plain);
    expect(format).toBe('vtt');
  });

  it('rejects malformed hex length', () => {
    const bad = `${prefix}001`;
    expect(() => maybeDecryptEncryptedFile(bad)).toThrow('multiple of 4');
  });

  it('rejects non-hex characters', () => {
    const bad = `${prefix}00zz`;
    expect(() => maybeDecryptEncryptedFile(bad)).toThrow('Invalid hex quartet');
  });
});
