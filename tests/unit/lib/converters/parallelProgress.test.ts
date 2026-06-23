import {
  phaseToPercent,
  phaseLabel,
  ParallelProgressTracker,
  type ParallelConversionPhase,
} from '@/lib/converters/parallelProgress';

describe('parallelProgress', () => {
  describe('phaseToPercent', () => {
    it('returns start of range for 0 progress', () => {
      expect(phaseToPercent('planning', 0)).toBe(85);
      expect(phaseToPercent('transmuxing', 0)).toBe(86);
      expect(phaseToPercent('merging', 0)).toBe(95);
      expect(phaseToPercent('validating', 0)).toBe(98);
    });

    it('returns end of range for 1 progress', () => {
      expect(phaseToPercent('planning', 1)).toBe(86);
      expect(phaseToPercent('transmuxing', 1)).toBe(95);
      expect(phaseToPercent('merging', 1)).toBe(98);
      expect(phaseToPercent('validating', 1)).toBe(99);
      expect(phaseToPercent('done', 1)).toBe(100);
    });

    it('returns midpoint for 0.5 progress', () => {
      expect(phaseToPercent('transmuxing', 0.5)).toBe(90); // (86+95)/2 = 90.5 → 90
    });

    it('clamps progress below 0', () => {
      expect(phaseToPercent('transmuxing', -1)).toBe(86);
    });

    it('clamps progress above 1', () => {
      expect(phaseToPercent('transmuxing', 2)).toBe(95);
    });

    it('done phase is always 99–100', () => {
      expect(phaseToPercent('done', 0)).toBe(99);
      expect(phaseToPercent('done', 1)).toBe(100);
    });
  });

  describe('phaseLabel', () => {
    it('returns human-readable label for each phase', () => {
      expect(phaseLabel('planning')).toContain('Planning');
      expect(phaseLabel('transmuxing')).toContain('parallel');
      expect(phaseLabel('merging')).toContain('Merging');
      expect(phaseLabel('validating')).toContain('Validating');
      expect(phaseLabel('done')).toBe('Done');
    });
  });

  describe('ParallelProgressTracker', () => {
    it('starts at planning phase', () => {
      const calls: Array<{ percent: number; phase: ParallelConversionPhase }> = [];
      const tracker = new ParallelProgressTracker((percent, phase) => {
        calls.push({ percent, phase });
      });
      expect(tracker.phase).toBe('planning');
      expect(tracker.percent).toBe(85);
      expect(calls).toHaveLength(1);
    });

    it('transitions through phases', () => {
      const calls: Array<{ percent: number; phase: ParallelConversionPhase }> = [];
      const tracker = new ParallelProgressTracker((percent, phase) => {
        calls.push({ percent, phase });
      });

      tracker.start('transmuxing');
      tracker.update(0.5);
      tracker.start('merging');
      tracker.start('validating');
      tracker.done();

      expect(calls.map((c) => c.phase)).toEqual([
        'planning',
        'transmuxing',
        'transmuxing',
        'merging',
        'validating',
        'done',
      ]);
    });

    it('reports correct percentages', () => {
      const percents: number[] = [];
      const tracker = new ParallelProgressTracker((p) => percents.push(p));

      tracker.start('transmuxing');
      tracker.update(0.5); // 90%
      tracker.done(); // 100%

      expect(percents).toContain(86); // start of transmuxing
      expect(percents).toContain(90); // 50% through transmuxing
      expect(percents).toContain(100); // done
    });

    it('calls onProgress on each update', () => {
      let callCount = 0;
      const tracker = new ParallelProgressTracker(() => callCount++);

      expect(callCount).toBe(1); // initial report
      tracker.start('transmuxing');
      expect(callCount).toBe(2);
      tracker.update(0.3);
      expect(callCount).toBe(3);
      tracker.update(0.6);
      expect(callCount).toBe(4);
      tracker.done();
      expect(callCount).toBe(5);
    });

    it('works without onProgress callback', () => {
      const tracker = new ParallelProgressTracker();
      tracker.start('transmuxing');
      tracker.update(0.5);
      tracker.done();
      expect(tracker.percent).toBe(100);
    });
  });
});
