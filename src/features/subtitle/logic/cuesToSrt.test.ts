import { cuesToSrt } from './cuesToSrt';
import type { SrtCue } from '@/entities/media';

describe('cuesToSrt', () => {
  it('serializes empty cues to empty string', () => {
    expect(cuesToSrt([])).toBe('');
  });

  it('serializes a single cue with correct SRT format', () => {
    const cues: SrtCue[] = [
      { index: 0, start: 1000, end: 3000, text: 'Hello world' },
    ];
    const result = cuesToSrt(cues);
    expect(result).toBe('1\n00:00:01,000 --> 00:00:03,000\nHello world');
  });

  it('serializes multiple cues with correct numbering and separators', () => {
    const cues: SrtCue[] = [
      { index: 0, start: 1000, end: 3000, text: 'First' },
      { index: 1, start: 4000, end: 6000, text: 'Second' },
    ];
    const result = cuesToSrt(cues);
    expect(result).toBe(
      '1\n00:00:01,000 --> 00:00:03,000\nFirst\n\n' +
      '2\n00:00:04,000 --> 00:00:06,000\nSecond',
    );
  });

  it('handles hours in timestamp', () => {
    const cues: SrtCue[] = [
      { index: 0, start: 3661000, end: 3663000, text: 'Over an hour' },
    ];
    const result = cuesToSrt(cues);
    expect(result).toContain('01:01:01,000 --> 01:01:03,000');
  });
});
