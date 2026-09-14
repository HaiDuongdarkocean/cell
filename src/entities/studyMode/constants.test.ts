import { describe, it, expect } from '@jest/globals';
import { PRESET_LOOKUP } from './constants';

describe('StudyMode presets', () => {
  it('defaults dictation speed to 1x', () => {
    const dictation = PRESET_LOOKUP.get('dictation');
    expect(dictation).toBeDefined();
    expect(dictation?.steps[0].speed).toBe(1);
  });
});
