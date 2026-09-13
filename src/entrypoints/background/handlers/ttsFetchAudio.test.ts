// tests/unit — sanitizeTtsText strips musical glyphs from TTS input while
// keeping the display text untouched upstream.
import { sanitizeTtsText } from './ttsFetchAudio';

describe('sanitizeTtsText', () => {
  it('removes musical note glyphs from lyric lines', () => {
    expect(sanitizeTtsText("♪ Lyin' isn't better than silence ♪")).toBe(
      "Lyin' isn't better than silence",
    );
  });

  it('removes adjacent note clusters and collapses whitespace', () => {
    expect(sanitizeTtsText('♪ ♪ Staring at the bottom of your claws ♪ ♪')).toBe(
      'Staring at the bottom of your claws',
    );
  });

  it('removes clefs, beamed notes and music emoji', () => {
    expect(sanitizeTtsText('𝄞 sing 𝅘𝅥𝅮 along 🎵🎶')).toBe('sing along');
  });

  it('returns empty when the text is only glyphs', () => {
    expect(sanitizeTtsText('♪♫ ♩♬')).toBe('');
  });

  it('leaves ordinary text unchanged', () => {
    expect(sanitizeTtsText('hello world')).toBe('hello world');
  });
});
