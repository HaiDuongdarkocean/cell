import { JsonArrayElementScanner, iterJsonArrayElements } from './jsonElementScanner';
import { MalformedJsonArrayError } from './jsonObjectScanner';

async function collect(text: string, chunkSize: number): Promise<string[]> {
  async function* chunks(): AsyncGenerator<string> {
    for (let i = 0; i < text.length; i += chunkSize) yield text.slice(i, i + chunkSize);
  }
  const out: string[] = [];
  for await (const el of iterJsonArrayElements(chunks())) out.push(el.text);
  return out;
}

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

describe('JsonArrayElementScanner', () => {
  test.each([1, 2, 3, 7, 64, 1024])('parses objects at chunk size %i', async (n) => {
    const text = ' [ {"a":1} , {"b":[2,{"c":"x"}]} , {"d":"}\\"}"] , {} ] ';
    expect(await collect(text, n)).toEqual(['{"a":1}', '{"b":[2,{"c":"x"}]}', '{"d":"}\\"}"]', '{}']);
  });

  test.each([1, 4, 100])('handles escapes/surrogates at chunk size %i', async (n) => {
    const text = '[{"t":"a\\"b"},{"t":"\\\\"},{"t":"é😀"},{"t":"\\ud83d\\ude00"},{"t":"ĺine1\\nline2"}]';
    const els = await collect(text, n);
    expect(els.map((s) => JSON.parse(s))).toEqual([
      { t: 'a"b' },
      { t: '\\' },
      { t: 'é😀' },
      { t: '😀' },
      { t: 'ĺine1\nline2' },
    ]);
  });

  test('emits every element kind', async () => {
    const els: { kind: string; text: string }[] = [];
    const s = new JsonArrayElementScanner();
    for (const el of s.push('[{"a":1},[2,3],"x\\"y",42,true,null,-1.5e3]')) els.push(el);
    s.finish();
    expect(els.map((e) => e.kind)).toEqual(['object', 'array', 'string', 'literal', 'literal', 'literal', 'literal']);
    expect(els[1]!.text).toBe('[2,3]');
    expect(els[2]!.text).toBe('"x\\"y"');
    expect(els[3]!.text).toBe('42');
  });

  test('count mode emits kinds without text', async () => {
    const s = new JsonArrayElementScanner({ collectText: false });
    const els = s.push('[{"a":1},2,"x"]');
    s.finish();
    expect(els.map((e) => e.kind)).toEqual(['object', 'literal', 'string']);
    expect(els.every((e) => e.text === '')).toBe(true);
  });

  test('empty array + whitespace only', async () => {
    expect(await collect('  [  ]  ', 3)).toEqual([]);
    expect(await collect('[]', 1)).toEqual([]);
  });

  test.each([
    ' [1,2] trailing',
    '[1 2]',
    '[1,2',
    'not-an-array',
    '[1,2,]',
    '{ "a": 1 }',
    '[truX]',
    '[{"a":1}]x',
    '"[1]"',
  ])('rejects malformed input %j', async (bad) => {
    await expect(collect(bad, 1)).rejects.toBeInstanceOf(MalformedJsonArrayError);
  });

  test('fuzz: random splits reproduce JSON.parse results', async () => {
    const rand = seeded(42);
    for (let trial = 0; trial < 60; trial++) {
      const elements = Array.from({ length: 1 + Math.floor(rand() * 20) }, () => ({
        term: `w${Math.floor(rand() * 1e5)}`,
        def: `${'x'.repeat(Math.floor(rand() * 200))}\\"é😀`,
        n: rand() * 1e6,
        nested: { arr: [1, 'a"b', { deep: true }] },
      }));
      const text = JSON.stringify(elements);
      const s = new JsonArrayElementScanner();
      const got: string[] = [];
      let i = 0;
      while (i < text.length) {
        const step = 1 + Math.floor(rand() * 50);
        got.push(...s.push(text.slice(i, i + step)).map((e) => e.text));
        i += step;
      }
      s.finish();
      expect(got.map((g) => JSON.parse(g))).toEqual(elements);
    }
  });

  test('fuzz: split surrogate-bearing text never corrupts elements', async () => {
    const rand = seeded(7);
    for (let trial = 0; trial < 40; trial++) {
      const elements = Array.from({ length: 10 }, (_, i) => `w${i}${'😀'.repeat(1 + (i % 5))}\\n"q"`);
      const text = JSON.stringify(elements);
      const s = new JsonArrayElementScanner();
      const got: string[] = [];
      let i = 0;
      while (i < text.length) {
        const step = 1 + Math.floor(rand() * 37);
        got.push(...s.push(text.slice(i, i + step)).map((e) => e.text));
        i += step;
      }
      s.finish();
      expect(got.map((g) => JSON.parse(g))).toEqual(elements);
    }
  });
});

describe('iterJsonObjectMemberElements', () => {
  const { iterJsonObjectMemberElements } = jest.requireActual<typeof import('./jsonElementScanner')>('./jsonElementScanner');

  async function memberCollect(text: string, chunkSize: number, member = 'list'): Promise<string[]> {
    async function* chunks(): AsyncGenerator<string> {
      for (let i = 0; i < text.length; i += chunkSize) yield text.slice(i, i + chunkSize);
    }
    const out: string[] = [];
    for await (const el of iterJsonObjectMemberElements(chunks(), member)) out.push(el.text);
    return out;
  }

  test('streams elements of the named member and ignores other members', async () => {
    const text = JSON.stringify({
      name: 'WL',
      index: { N5: 'desc with, commas and ]]}', N4: 'two' },
      list: [['cat', 'cat', ['N5']], ['dog', undefined, undefined]],
    });
    const got = await memberCollect(text, 7);
    expect(got.map((t) => JSON.parse(t))).toEqual([['cat', 'cat', ['N5']], ['dog', null, null]]);
  });

  test('member last, with nested objects and escaped quotes', async () => {
    const text = JSON.stringify({
      a: { x: 'y\\"}', z: [1, 2, { k: 'v' }] },
      list: [{ term: 'a"b' }],
      tail: 1,
    });
    const got = await memberCollect(text, 5);
    expect(got.map((t) => JSON.parse(t))).toEqual([{ term: 'a"b' }]);
  });

  test('member absent → zero elements (caller reports format error)', async () => {
    const got = await memberCollect('{"index": {"a": 1}}', 4);
    expect(got).toEqual([]);
  });

  test('non-object document throws', async () => {
    await expect(memberCollect('["a"]', 4)).rejects.toThrow(MalformedJsonArrayError);
  });

  test('empty list member yields nothing without error', async () => {
    const got = await memberCollect('{"index": {}, "list": []}', 3);
    expect(got).toEqual([]);
  });
});
