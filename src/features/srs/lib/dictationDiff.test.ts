import { alignDictation } from './dictationDiff';

describe('alignDictation', () => {
  it('marks exact match as correct with all chars matched', () => {
    const r = alignDictation('shipment', 'shipment');
    expect(r.correct).toBe(true);
    expect(r.expectedMarks.every(Boolean)).toBe(true);
    expect(r.typedMarks.every(Boolean)).toBe(true);
  });

  it('normalizes case, whitespace and edge punctuation', () => {
    expect(alignDictation('Shipment!', ' shipment ').correct).toBe(true);
    expect(alignDictation('The  big  cat.', 'the big cat').correct).toBe(true);
  });

  it('flags a missing character in the expected marks', () => {
    const r = alignDictation('shipment', 'shipmnt');
    expect(r.correct).toBe(false);
    expect(r.expectedMarks[5]).toBe(false);
    expect(r.typedMarks.every(Boolean)).toBe(true);
  });

  it('flags an extra typed character', () => {
    const r = alignDictation('shipment', 'shipxment');
    expect(r.correct).toBe(false);
    expect(r.typedMarks[4]).toBe(false);
    expect(r.expectedMarks.every(Boolean)).toBe(true);
  });

  it('flags a substitution on both sides', () => {
    const r = alignDictation('cat', 'cut');
    expect(r.correct).toBe(false);
    expect(r.expectedMarks[1]).toBe(false);
    expect(r.typedMarks[1]).toBe(false);
  });

  it('aligns around inserted characters in the middle of a word', () => {
    const r = alignDictation('summer', 'sumemer');
    expect(r.correct).toBe(false);
    expect(r.typedMarks.filter(Boolean).length).toBe(6);
    expect(r.expectedMarks.filter(Boolean).length).toBe(6);
  });

  it('is not correct when expected normalizes to empty', () => {
    expect(alignDictation('!!!', '!!!').correct).toBe(false);
  });
});
