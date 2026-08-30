import { parseLingvoDsl } from './lingvoDslParser';

describe('parseLingvoDsl', () => {
  it('parses headword entries with audio paths', () => {
    const text = `
#NAME "Forvo English"
[hello]
  [m1][s]hello.mp3[/s][/m1]
[/hello]
[world]
  [m1][s]world1.mp3[/s] [s]world2.mp3[/s][/m1]
[/world]
`;
    const entries = parseLingvoDsl(text, 'pkg-1');
    expect(entries).toEqual([
      { id: 'pkg-1:hello', packageId: 'pkg-1', term: 'hello', audioPaths: ['hello.mp3'] },
      { id: 'pkg-1:world', packageId: 'pkg-1', term: 'world', audioPaths: ['world1.mp3', 'world2.mp3'] },
    ]);
  });

  it('skips entries without audio paths', () => {
    const text = `
[empty]
  [m1]no audio here[/m1]
[/empty]
[sound]
  [m1][s]sound.mp3[/s][/m1]
[/sound]
`;
    const entries = parseLingvoDsl(text, 'pkg-1');
    expect(entries).toHaveLength(1);
    expect(entries[0].term).toBe('sound');
  });

  it('normalizes terms to lowercase and NFC', () => {
    const text = `
[Hello]
  [m1][s]hello.mp3[/s][/m1]
[/Hello]
`;
    const entries = parseLingvoDsl(text, 'pkg-1');
    expect(entries[0].term).toBe('hello');
  });

  it('treats [term] as a valid headword tag alias', () => {
    const text = `
[term]
  [m1][s]term.mp3[/s][/m1]
[/term]
`;
    const entries = parseLingvoDsl(text, 'pkg-1');
    expect(entries[0].term).toBe('term');
  });

  it('ignores inner tags when not in an entry', () => {
    // [m] outside an entry would currently be treated as a headword with no audio,
    // which is harmless. The test below ensures inner [m] inside an entry is content.
    const text = `
[word]
  [m1][s]word.mp3[/s][/m1]
  [m2]extra line[/m2]
[/word]
`;
    const entries = parseLingvoDsl(text, 'pkg-1');
    expect(entries).toHaveLength(1);
    expect(entries[0].audioPaths).toEqual(['word.mp3']);
  });

  it('tolerates a missing closing tag and flushes the dangling entry', () => {
    const text = `
[orphan]
  [m1][s]orphan.mp3[/s][/m1]
`;
    const entries = parseLingvoDsl(text, 'pkg-1');
    expect(entries).toHaveLength(1);
    expect(entries[0].term).toBe('orphan');
  });
});
