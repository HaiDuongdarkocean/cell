import { ConversionTimer } from '@/features/transmux/merging/conversionTimer';

describe('ConversionTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('records duration for a completed phase', () => {
    const timer = new ConversionTimer('dl-1');
    timer.start('convert');
    jest.advanceTimersByTime(1500);
    timer.end('convert');

    expect(timer.getDuration('convert')).toBe(1500);
  });

  it('returns undefined for unrecorded phase', () => {
    const timer = new ConversionTimer('dl-1');
    expect(timer.getDuration('save')).toBeUndefined();
  });

  it('returns undefined for started-but-not-ended phase', () => {
    const timer = new ConversionTimer('dl-1');
    timer.start('download');
    expect(timer.getDuration('download')).toBeUndefined();
  });

  it('does not overwrite duration on double end()', () => {
    const timer = new ConversionTimer('dl-1');
    timer.start('convert');
    jest.advanceTimersByTime(1000);
    timer.end('convert');
    const firstDuration = timer.getDuration('convert');

    jest.advanceTimersByTime(2000);
    timer.end('convert'); // should be a no-op

    expect(timer.getDuration('convert')).toBe(firstDuration);
  });

  it('logSummary does not throw with no phases', () => {
    const timer = new ConversionTimer('dl-empty');
    expect(() => timer.logSummary()).not.toThrow();
  });

  it('logSummary includes all recorded phases', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const timer = new ConversionTimer('dl-2');
    timer.start('download');
    jest.advanceTimersByTime(5000);
    timer.end('download');
    timer.start('convert');
    jest.advanceTimersByTime(360000);
    timer.end('convert');

    timer.logSummary();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('download=5000ms'),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('convert=360000ms'),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('total='),
    );

    consoleSpy.mockRestore();
  });
});
