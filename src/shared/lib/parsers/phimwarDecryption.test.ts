import {
  isPhimwarSubtitleUrl,
  getPhimwarFileName,
  decryptPhimwarSrt,
} from './phimwarDecryption';

const TEST_VECTOR = {
  fileName: 'v07.srt',
  // AES-GCM: 12 zero-bytes IV + ciphertext. Encrypted SRT:
  //   1
  //   00:00:01,000 --> 00:00:02,000
  //   Test line.
  base64: 'AAAAAAAAAAAAAAAABSipnV6qAeDrP7eu99Dy7M6BGlRNYzMdaC95iEvSjkdV3S68P5mIsbe6HN5kZV70m2xqZqn5VPkMWKk=',
  plain: '1\n00:00:01,000 --> 00:00:02,000\nTest line.\n',
};

describe('phimwarDecryption', () => {
  describe('isPhimwarSubtitleUrl', () => {
    it('matches PhimWar subtitle URLs', () => {
      expect(
        isPhimwarSubtitleUrl(
          'https://phimwar.com/api/subtitle/-19074/v07.srt',
        ),
      ).toBe(true);
      expect(
        isPhimwarSubtitleUrl(
          'https://www.phimwar.com/api/subtitle/-19074/e07.srt',
        ),
      ).toBe(true);
    });

    it('rejects unrelated URLs', () => {
      expect(isPhimwarSubtitleUrl('https://phimwar.com/watch/qBMG')).toBe(false);
      expect(
        isPhimwarSubtitleUrl('https://phimwar.com/_app/remote/1odrich/getSubtitles'),
      ).toBe(false);
      expect(
        isPhimwarSubtitleUrl('https://other.com/api/subtitle/-19074/v07.srt'),
      ).toBe(false);
      expect(
        isPhimwarSubtitleUrl(
          'https://phimwar.com/api/subtitle/-19074/v07.srt?extra=1',
        ),
      ).toBe(false);
    });
  });

  describe('getPhimwarFileName', () => {
    it('extracts the filename from a subtitle URL', () => {
      expect(
        getPhimwarFileName('https://phimwar.com/api/subtitle/-19074/v07.srt'),
      ).toBe('v07.srt');
    });

    it('returns null for invalid URLs', () => {
      expect(getPhimwarFileName('not a url')).toBeNull();
    });
  });

  describe('decryptPhimwarSrt', () => {
    it('decrypts a known test vector', async () => {
      const plain = await decryptPhimwarSrt(
        TEST_VECTOR.fileName,
        TEST_VECTOR.base64,
      );
      expect(plain).toBe(TEST_VECTOR.plain);
    });

    it('fails for an incorrect filename', async () => {
      await expect(
        decryptPhimwarSrt('wrong.srt', TEST_VECTOR.base64),
      ).rejects.toThrow();
    });
  });
});
