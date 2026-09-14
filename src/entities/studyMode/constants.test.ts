import { describe, it, expect } from '@jest/globals';
import { PRESET_LOOKUP } from './constants';

describe('StudyMode presets', () => {
  it('defaults dictation to 1x speed, one repeat, and hidden subtitles', () => {
    const dictation = PRESET_LOOKUP.get('dictation');
    expect(dictation).toBeDefined();
    expect(dictation?.steps[0].speed).toBe(1);
    expect(dictation?.steps[0].repeat).toBe(1);
    expect(dictation?.steps[0].subtitle).toBe('none');
  });

  it('defaults cloze to 1x speed, one repeat, and hidden subtitles', () => {
    const cloze = PRESET_LOOKUP.get('cloze');
    expect(cloze).toBeDefined();
    expect(cloze?.steps[0].speed).toBe(1);
    expect(cloze?.steps[0].repeat).toBe(1);
    expect(cloze?.steps[0].subtitle).toBe('none');
  });

  it('defaults listen-check to one blind play then reveal subtitles at the end without replaying', () => {
    const listenCheck = PRESET_LOOKUP.get('listen-check');
    expect(listenCheck).toBeDefined();
    expect(listenCheck?.steps[0]).toEqual({
      subtitle: 'none',
      pause: 'none',
      repeat: 1,
      speed: 1,
      after: 'continue',
    });
    expect(listenCheck?.steps[1]).toEqual({
      subtitle: 'both',
      pause: 'end',
      repeat: 1,
      speed: 1,
      after: 'wait',
      seek: false,
    });
  });
});
