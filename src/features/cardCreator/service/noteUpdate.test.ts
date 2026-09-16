import { computeFieldUpdates, splitTags } from './noteUpdate';

describe('splitTags', () => {
  it('splits on whitespace and drops empties', () => {
    expect(splitTags('a  b\tc')).toEqual(['a', 'b', 'c']);
    expect(splitTags('')).toEqual([]);
    expect(splitTags('   ')).toEqual([]);
  });
});

describe('computeFieldUpdates', () => {
  const fields = { Front: 'new front', Back: '', Extra: 'new extra' };

  it('overwrite writes every non-empty new value', () => {
    expect(computeFieldUpdates(fields, { Front: 'old', Extra: 'old' }, 'overwrite')).toEqual({
      Front: 'new front',
      Extra: 'new extra',
    });
  });

  it('append joins with <br> when an existing value is present', () => {
    expect(computeFieldUpdates(fields, { Front: 'old', Extra: '' }, 'append')).toEqual({
      Front: 'old<br>new front',
      Extra: 'new extra',
    });
  });

  it('skip writes only fields that are currently empty', () => {
    expect(computeFieldUpdates(fields, { Front: 'old', Extra: '' }, 'skip')).toEqual({
      Extra: 'new extra',
    });
    expect(computeFieldUpdates(fields, { Front: 'old', Extra: 'old' }, 'skip')).toEqual({});
  });
});
