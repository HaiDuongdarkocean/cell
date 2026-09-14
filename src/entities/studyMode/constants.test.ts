import { describe, it, expect } from '@jest/globals';
import { PRESET_LOOKUP } from './constants';

describe('StudyMode presets', () => {
  it('defaults dictation to 1x speed and one repeat', () => {
    const dictation = PRESET_LOOKUP.get('dictation');
    expect(dictation).toBeDefined();
    expect(dictation?.steps[0].speed).toBe(1);
    expect(dictation?.steps[0].repeat).toBe(1);
  });
});
