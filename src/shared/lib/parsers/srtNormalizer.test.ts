import {
  emitSrtBlocks,
  normalizeSrt,
  collapseCueTextLines,
  stripInlineTags,
  stripSubtitleTags,
} from './srtNormalizer';

describe('stripSubtitleTags', () => {
  it('removes angle-bracket tags', () => {
    expect(stripSubtitleTags('<i>Hello</i> <b>world</b>')).toBe('Hello world');
  });

  it('removes ASS override blocks', () => {
    expect(stripSubtitleTags('{\\an8}{\\pos(10,20)}Hello')).toBe('Hello');
  });

  it('decodes named entities', () => {
    expect(stripSubtitleTags('a &amp; b &lt;x&gt; &quot;q&quot;')).toBe('a & b <x> "q"');
    expect(stripSubtitleTags('it&apos;s')).toBe("it's");
  });

  it('decodes decimal numeric entities', () => {
    expect(stripSubtitleTags('&#65;&#66;')).toBe('AB');
  });

  it('decodes hex entities with lowercase x', () => {
    expect(stripSubtitleTags('&#x41;&#x42;')).toBe('AB');
  });

  it('decodes hex entities with uppercase X', () => {
    expect(stripSubtitleTags('&#X41;')).toBe('A');
  });

  it('leaves unknown entities untouched', () => {
    expect(stripSubtitleTags('&notanentity;')).toBe('&notanentity;');
  });

  it('turns NBSP into regular space', () => {
    expect(stripSubtitleTags('a b')).toBe('a b');
  });
});

describe('collapseCueTextLines', () => {
  it('trims lines and drops blanks', () => {
    expect(collapseCueTextLines('  one  \n\n  \ntwo\n')).toBe('one\ntwo');
  });
});

describe('stripInlineTags', () => {
  it('strips tags and collapses blank lines together', () => {
    expect(stripInlineTags('<i>one</i>\n\n\n<b>two</b>')).toBe('one\ntwo');
  });
});

describe('emitSrtBlocks', () => {
  it('emits numbered blocks with comma timings and trailing newline', () => {
    const out = emitSrtBlocks([
      { start: 1000, end: 2500, text: 'hello' },
      { start: 3_661_001, end: 3_662_000, text: 'world' },
    ]);
    expect(out).toBe(
      '1\n00:00:01,000 --> 00:00:02,500\nhello\n\n' +
        '2\n01:01:01,001 --> 01:01:02,000\nworld\n',
    );
  });

  it('returns empty string for no cues', () => {
    expect(emitSrtBlocks([])).toBe('');
  });
});

describe('normalizeSrt', () => {
  it('parses cues with index lines and normalizes text', () => {
    const input = '1\n00:00:01,000 --> 00:00:02,000\n<i>Hi</i> &amp; bye\n\n';
    expect(normalizeSrt(input)).toBe(
      '1\n00:00:01,000 --> 00:00:02,000\nHi & bye\n',
    );
  });

  it('strips BOM and WEBVTT header', () => {
    const input = '﻿WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nhello\n';
    expect(normalizeSrt(input)).toBe(
      '1\n00:00:01,000 --> 00:00:02,000\nhello\n',
    );
  });

  it('returns empty string for empty content', () => {
    expect(normalizeSrt('')).toBe('');
    expect(normalizeSrt('   \n ')).toBe('');
  });

  it('skips cues with unparseable timings but keeps valid ones', () => {
    const input =
      'junk line\n\n00:00:01,000 --> 00:00:02,000\ngood\n';
    expect(normalizeSrt(input)).toBe(
      '1\n00:00:01,000 --> 00:00:02,000\ngood\n',
    );
  });
});
