import { decideStatusWrite } from './wordStatusArbitration';

const ex = (status: 'tracking' | 'known' | 'ignore', at: number, source?: 'user' | 'anki' | 'srs' | 'import') =>
  ({ status, updatedAt: at, source, sourceAt: at });

describe('decideStatusWrite', () => {
  it('writes when no existing entry', () => {
    expect(decideStatusWrite(undefined, { status: 'tracking', source: 'anki', sourceAt: 1 })).toBe('write');
  });

  it('newer sourceAt wins', () => {
    const decision = decideStatusWrite(
      ex('ignore', 100, 'user'),
      { status: 'known', source: 'anki', sourceAt: 200 },
    );
    expect(decision).toBe('write');
  });

  it('older sourceAt loses on normal transitions', () => {
    expect(
      decideStatusWrite(ex('tracking', 300, 'user'), { status: 'known', source: 'anki', sourceAt: 200 }),
    ).toBe('skip');
  });

  it('equal timestamps break ties by source priority (user > anki > srs > import)', () => {
    expect(
      decideStatusWrite(ex('tracking', 100, 'anki'), { status: 'known', source: 'user', sourceAt: 100 }),
    ).toBe('write');
    expect(
      decideStatusWrite(ex('tracking', 100, 'user'), { status: 'ignore', source: 'anki', sourceAt: 100 }),
    ).toBe('skip');
    expect(
      decideStatusWrite(ex('tracking', 100, 'srs'), { status: 'known', source: 'anki', sourceAt: 100 }),
    ).toBe('write');
    expect(
      decideStatusWrite(ex('tracking', 100, 'anki'), { status: 'known', source: 'srs', sourceAt: 100 }),
    ).toBe('skip');
  });

  it('never lets non-user writes downgrade known', () => {
    expect(
      decideStatusWrite(ex('known', 1, 'user'), { status: 'tracking', source: 'anki', sourceAt: 9999 }),
    ).toBe('skip');
    expect(
      decideStatusWrite(ex('known', 1, 'anki'), { status: 'tracking', source: 'srs', sourceAt: 9999 }),
    ).toBe('skip');
  });

  it('user writes can downgrade known', () => {
    expect(
      decideStatusWrite(ex('known', 1, 'anki'), { status: 'ignore', source: 'user', sourceAt: 2 }),
    ).toBe('write');
  });

  it('legacy sourceless rows count as user truth on ties', () => {
    expect(
      decideStatusWrite(ex('tracking', 100), { status: 'known', source: 'anki', sourceAt: 100 }),
    ).toBe('skip');
  });

  it('non-user tracking never writes onto known or ignore', () => {
    expect(
      decideStatusWrite(ex('ignore', 100, 'user'), { status: 'tracking', source: 'anki', sourceAt: 200 }),
    ).toBe('skip');
    expect(
      decideStatusWrite(ex('ignore', 100, 'user'), { status: 'tracking', source: 'srs', sourceAt: 200 }),
    ).toBe('skip');
    expect(
      decideStatusWrite(ex('known', 100, 'anki'), { status: 'tracking', source: 'anki', sourceAt: 200 }),
    ).toBe('skip');
  });

  it('non-user tracking does not escalate onto a stored tracking row either — LWW applies', () => {
    expect(
      decideStatusWrite(ex('ignore', 100, 'srs'), { status: 'tracking', source: 'anki', sourceAt: 200 }),
    ).toBe('skip');
  });

  it('skips same-status rewrites and unknown-on-empty', () => {
    expect(
      decideStatusWrite(ex('known', 100, 'user'), { status: 'known', source: 'anki', sourceAt: 200 }),
    ).toBe('skip');
    expect(
      decideStatusWrite(undefined, { status: 'unknown', source: 'user', sourceAt: 1 }),
    ).toBe('skip');
  });
});
