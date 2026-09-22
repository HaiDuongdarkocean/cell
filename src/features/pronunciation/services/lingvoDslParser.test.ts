import { parseLingvoDsl } from './lingvoDslParser';

describe('parseLingvoDsl', () => {
  it('parses standard DSL entries: bare headword + indented body', () => {
    const text = [
      '#NAME "Forvo English"',
      '#INDEX_LANGUAGE "English"',
      '',
      'hello',
      '\t[m1][s]en/jessica/hello.mp3[/s] [i]jessica[/i][/m1]',
      'world',
      '\t[m1][s]world1.mp3[/s] [s]world2.mp3[/s][/m1]',
      '',
    ].join('\n');
    const entries = parseLingvoDsl(text, 'pkg-1');
    expect(entries).toEqual([
      { id: 'pkg-1:hello', packageId: 'pkg-1', term: 'hello', audioPaths: ['en/jessica/hello.mp3'] },
      { id: 'pkg-1:world', packageId: 'pkg-1', term: 'world', audioPaths: ['world1.mp3', 'world2.mp3'] },
    ]);
  });

  it('skips cards without audio paths', () => {
    const text = ['empty', '\t[m1]no audio here[/m1]', 'sound', '\t[m1][s]sound.mp3[/s][/m1]'].join('\n');
    const entries = parseLingvoDsl(text, 'pkg-1');
    expect(entries).toHaveLength(1);
    expect(entries[0].term).toBe('sound');
  });

  it('normalizes terms to lowercase and NFC', () => {
    const text = ['Hello', '\t[m1][s]hello.mp3[/s][/m1]'].join('\n');
    const entries = parseLingvoDsl(text, 'pkg-1');
    expect(entries[0].term).toBe('hello');
  });

  it('unescapes DSL escapes in headwords', () => {
    const text = [
      '"elegance is the only beauty" \\[audrey hepburn\\]',
      '\t[m1][s]elegance.mp3[/s][/m1]',
    ].join('\n');
    const entries = parseLingvoDsl(text, 'pkg-1');
    expect(entries[0].term).toBe('"elegance is the only beauty" [audrey hepburn]');
  });

  it('maps consecutive headword lines to the same card', () => {
    const text = ['color', 'colour', '\t[m1][s]color.mp3[/s][/m1]'].join('\n');
    const entries = parseLingvoDsl(text, 'pkg-1');
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.term).sort()).toEqual(['color', 'colour']);
    expect(entries[0].audioPaths).toEqual(['color.mp3']);
    expect(entries[1].audioPaths).toEqual(['color.mp3']);
  });

  it('collects [s] tags across multiple body lines', () => {
    const text = [
      'word',
      '\t[m1][s]word.mp3[/s][/m1]',
      '\t[m2][s]word-alt.mp3[/s][/m2]',
    ].join('\n');
    const entries = parseLingvoDsl(text, 'pkg-1');
    expect(entries).toHaveLength(1);
    expect(entries[0].audioPaths).toEqual(['word.mp3', 'word-alt.mp3']);
  });

  it('merges audio paths when the same headword appears in separate cards', () => {
    const text = [
      'hello',
      '\t[m1][s]a.mp3[/s][/m1]',
      'other',
      '\t[m1][s]other.mp3[/s][/m1]',
      'hello',
      '\t[m1][s]b.mp3[/s][/m1]',
    ].join('\n');
    const entries = parseLingvoDsl(text, 'pkg-1');
    const hello = entries.find((e) => e.term === 'hello');
    expect(hello?.audioPaths).toEqual(['a.mp3', 'b.mp3']);
  });

  it('flushes a dangling card at EOF and tolerates a BOM', () => {
    const text = `﻿orphan\n\t[m1][s]orphan.mp3[/s][/m1]`;
    const entries = parseLingvoDsl(text, 'pkg-1');
    expect(entries).toHaveLength(1);
    expect(entries[0].term).toBe('orphan');
  });
});
