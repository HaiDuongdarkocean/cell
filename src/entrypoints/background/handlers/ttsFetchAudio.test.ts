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

  it('removes karaoke dots, stars and hearts', () => {
    expect(sanitizeTtsText('●○★☆♥♡ sing ●○')).toBe('sing');
  });

  it('removes arrows and box-drawing art', () => {
    expect(sanitizeTtsText('→←↑↓ chorus ░▒▓│┌┐')).toBe('chorus');
  });

  it('removes dingbats, florettes and misc technical symbols', () => {
    expect(sanitizeTtsText('✿❀✨ verse ⌛⏳⌚')).toBe('verse');
  });

  it('removes enclosed alphanumerics and braille art', () => {
    expect(sanitizeTtsText('① verse two Ⓐ ⠿⠷')).toBe('verse two');
  });

  it('removes CJK music marks', () => {
    expect(sanitizeTtsText('〽 la la 〰〰')).toBe('la la');
  });

  it('removes emoji from every block', () => {
    expect(sanitizeTtsText('😀🎤🀄🂡🏁👍🏽🇻🇳 wow')).toBe('wow');
  });

  it('removes invisible format characters', () => {
    expect(sanitizeTtsText('he​llo ‎wo‍rld﻿')).toBe('he llo wo rld');
  });

  it('drops brackets emptied by the glyph strip, including nesting', () => {
    expect(sanitizeTtsText('(♪) hello [♪♪] world ((♪))')).toBe('hello world');
  });

  it('keeps brackets that still hold speakable text', () => {
    expect(sanitizeTtsText('(I love you) so much')).toBe('(I love you) so much');
  });

  it('keeps meaningful punctuation and marks', () => {
    expect(sanitizeTtsText('9〜5, +50% © studio ※ note • item')).toBe(
      '9〜5, +50% © studio ※ note • item',
    );
  });

  it('returns empty when the text is only glyphs', () => {
    expect(sanitizeTtsText('♪♫ ♩♬ ●→ (♪)')).toBe('');
  });

  it('leaves ordinary text unchanged', () => {
    expect(sanitizeTtsText('hello world')).toBe('hello world');
  });
});
