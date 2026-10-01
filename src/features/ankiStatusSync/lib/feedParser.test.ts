import { parseFeedBody } from './feedParser';

describe('parseFeedBody', () => {
  it('parses the JSON envelope form', () => {
    const body = JSON.stringify({
      cursor: 12,
      events: [
        { cardId: 1, kind: 'review', ts: 1000 },
        { cardId: 2, kind: 'edit', ts: 2000 },
      ],
    });
    expect(parseFeedBody(body)).toEqual({
      cursor: 12,
      events: [
        { cardId: 1, kind: 'review', ts: 1000 },
        { cardId: 2, kind: 'edit', ts: 2000 },
      ],
    });
  });

  it('parses JSONL rows and tracks the max cursor', () => {
    const body = [
      '{"cursor":5,"cardId":1,"kind":"review","ts":1}',
      '{"cursor":9,"cardId":2,"kind":"suspend","ts":2}',
    ].join('\n');
    const parsed = parseFeedBody(body)!;
    expect(parsed.cursor).toBe(9);
    expect(parsed.events).toHaveLength(2);
  });

  it('skips malformed rows without failing the feed', () => {
    const body = [
      '{"cursor":3,"cardId":1,"kind":"review","ts":1}',
      '{"cursor":4,"cardId":"nope","ts":2}',
      'not json at all',
      '{"cursor":6,"cardId":7,"ts":3}',
    ].join('\n');
    const parsed = parseFeedBody(body)!;
    expect(parsed.events.map((e) => e.cardId)).toEqual([1, 7]);
    expect(parsed.cursor).toBe(6);
  });

  it('returns null on unparsable JSON envelope', () => {
    expect(parseFeedBody('{broken')).toBeNull();
  });

  it('returns an empty feed for empty body', () => {
    expect(parseFeedBody('')).toEqual({ events: [], cursor: 0 });
  });
});
