import { scanTopLevelJsonObjectRanges, MalformedJsonArrayError } from '@/features/dictionary/logic/jsonObjectScanner';

function collect(text: string): string[] {
  return [...scanTopLevelJsonObjectRanges(text)].map(({ start, end }) => text.slice(start, end));
}

describe('scanTopLevelJsonObjectRanges', () => {
  it('yields exact offsets into the source text', () => {
    const text = '[{"a":1}, {"b":2}]';
    const ranges = [...scanTopLevelJsonObjectRanges(text)];
    expect(ranges).toEqual([
      { start: 1, end: 8 },
      { start: 10, end: 17 },
    ]);
  });

  it('yields each top-level object', () => {
    const slices = collect('[{"a":1},{"b":2},{"c":3}]');
    expect(slices).toEqual(['{"a":1}', '{"b":2}', '{"c":3}']);
  });

  it('yields nothing for an empty array', () => {
    expect(collect('[]')).toEqual([]);
    expect(collect('  [ \n ]  ')).toEqual([]);
  });

  it('handles nested objects and arrays', () => {
    const slices = collect('[{"a":{"x":[1,{"y":2}]},"b":[]},{"c":{}}]');
    expect(slices).toEqual(['{"a":{"x":[1,{"y":2}]},"b":[]}', '{"c":{}}']);
  });

  it('ignores braces and escapes inside strings', () => {
    const slices = collect('[{"d":"a{b}c"},{"e":"q\\"}w"},{"f":"x\\\\"}]');
    expect(slices).toEqual([
      '{"d":"a{b}c"}',
      '{"e":"q\\"}w"}',
      '{"f":"x\\\\"}',
    ]);
    expect(JSON.parse(slices[1]!)).toEqual({ e: 'q"}w' });
    expect(JSON.parse(slices[2]!)).toEqual({ f: 'x\\' });
  });

  it('skips valid non-object elements like the legacy parse loop did', () => {
    const slices = collect('[{"a":1}, 5, "str", true, null, -3.5e2, {"b":2}]');
    expect(slices).toEqual(['{"a":1}', '{"b":2}']);
  });

  it('rejects missing commas between elements', () => {
    expect(() => collect('[{"a":1} {"b":2}]')).toThrow(MalformedJsonArrayError);
    expect(() => collect('[{"a":1} 5]')).toThrow(MalformedJsonArrayError);
    expect(() => collect('[{"a":1} "s"]')).toThrow(MalformedJsonArrayError);
  });

  it('rejects trailing commas and stray elements', () => {
    expect(() => collect('[{"a":1},]')).toThrow(MalformedJsonArrayError);
    expect(() => collect('[,{"a":1}]')).toThrow(MalformedJsonArrayError);
  });

  it('rejects content after the closing bracket', () => {
    expect(() => collect('[{"a":1}] null')).toThrow(MalformedJsonArrayError);
    expect(() => collect('[{"a":1}][{"b":2}]')).toThrow(MalformedJsonArrayError);
    expect(() => collect('[{"a":1}]]')).toThrow(MalformedJsonArrayError);
    expect(() => collect('[{"a":1}]@')).toThrow(MalformedJsonArrayError);
  });

  it('rejects unterminated input', () => {
    expect(() => collect('[{"a":{"b":1]')).toThrow(MalformedJsonArrayError);
    expect(() => collect('[{"a":1}, "unterminated ]')).toThrow(MalformedJsonArrayError);
    expect(() => collect('[{"a":1}')).toThrow(MalformedJsonArrayError);
    expect(() => collect('[')).toThrow(MalformedJsonArrayError);
    expect(() => collect('')).toThrow(MalformedJsonArrayError);
  });

  it('rejects invalid literals and stray characters', () => {
    expect(() => collect('[tru]')).toThrow(MalformedJsonArrayError);
    expect(() => collect('[abc]')).toThrow(MalformedJsonArrayError);
    expect(() => collect('[+3]')).toThrow(MalformedJsonArrayError);
    expect(() => collect('[-]')).toThrow(MalformedJsonArrayError);
    expect(() => collect('[{"a":1} xyz]')).toThrow(MalformedJsonArrayError);
  });

  it('rejects unbalanced closing braces', () => {
    expect(() => collect('[{"a":1}}]')).toThrow(MalformedJsonArrayError);
  });

  it('rejects nested top-level arrays instead of extracting their objects', () => {
    expect(() => collect('[[{"term":"x"}]]')).toThrow(MalformedJsonArrayError);
  });

  it('preserves unicode and surrogate pairs', () => {
    const json = '[{"t":"日本語"},{"u":"𝄞 ♪"}]';
    const slices = collect(json);
    expect(JSON.parse(slices[0]!)).toEqual({ t: '日本語' });
    expect(JSON.parse(slices[1]!)).toEqual({ u: '𝄞 ♪' });
  });
});
