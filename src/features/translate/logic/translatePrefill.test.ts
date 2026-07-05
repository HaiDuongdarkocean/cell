import { BackgroundPrefillController } from '@/features/translate/logic/translatePrefill';
import type { SrtCue } from '@/entities/media';
import type { TranslateFn } from '@/features/translate/logic/translatePrefill';

function makeCue(text: string, i: number): SrtCue {
  return { index: i, start: i * 1000, end: (i + 1) * 1000, text };
}

function makeCues(texts: string[]): SrtCue[] {
  return texts.map((t, i) => makeCue(t, i));
}

/** Mock translate that returns uppercase of each line (deterministic, testable). */
const mockTranslate: TranslateFn = async (text: string) => {
  return text.split('\n').map((line) => line.toUpperCase());
};

/** Mock translate that always fails (simulates Google rate-limit). */
const failingTranslate: TranslateFn = async () => {
  throw new Error('429 Too Many Requests');
};

describe('BackgroundPrefillController', () => {
  describe('start + sequential prefill', () => {
    it('translates all cues sequentially and caches results', async () => {
      const cues = makeCues(['hello', 'world', 'foo', 'bar']);
      const translatedCalls: SrtCue[][] = [];
      const ctrl = new BackgroundPrefillController({
        translate: mockTranslate,
        onChunkTranslated: (tc) => translatedCalls.push(tc),
        requestGapMs: 10, // fast for tests
      });
      ctrl.start(cues, 'en', 'vi');
      // Wait for completion
      await waitFor(() => !ctrl.isRunning);
      expect(ctrl.get(0)).toBe('HELLO');
      expect(ctrl.get(1)).toBe('WORLD');
      expect(ctrl.get(2)).toBe('FOO');
      expect(ctrl.get(3)).toBe('BAR');
      expect(translatedCalls.length).toBeGreaterThan(0);
    });

    it('is idempotent — second start is no-op', async () => {
      const cues = makeCues(['hello']);
      const ctrl = new BackgroundPrefillController({
        translate: mockTranslate,
        onChunkTranslated: () => {},
        requestGapMs: 10,
      });
      ctrl.start(cues, 'en', 'vi');
      ctrl.start(cues, 'en', 'vi'); // no-op
      await waitFor(() => !ctrl.isRunning);
      expect(ctrl.get(0)).toBe('HELLO');
    });
  });

  describe('seek', () => {
    it('returns true when cache has seekIdx (instant)', async () => {
      const cues = makeCues(['hello', 'world']);
      const ctrl = new BackgroundPrefillController({
        translate: mockTranslate,
        onChunkTranslated: () => {},
        requestGapMs: 10,
      });
      ctrl.start(cues, 'en', 'vi');
      await waitFor(() => !ctrl.isRunning);
      expect(ctrl.seek(0)).toBe(true);
    });

    it('returns false when cache does not have seekIdx', () => {
      const ctrl = new BackgroundPrefillController({
        translate: mockTranslate,
        onChunkTranslated: () => {},
        requestGapMs: 10,
      });
      expect(ctrl.seek(5)).toBe(false);
    });
  });

  describe('pause + resume', () => {
    it('pauses queue when paused, resumes when resumed', async () => {
      const cues = makeCues(['a', 'b', 'c', 'd', 'e', 'f']);
      // Delayed translate so pause() takes effect before first chunk completes
      const slowTranslate: TranslateFn = async (text) => {
        await sleep(50);
        return text.split('\n').map((l) => l.toUpperCase());
      };
      const ctrl = new BackgroundPrefillController({
        translate: slowTranslate,
        onChunkTranslated: () => {},
        requestGapMs: 10,
        charBudget: 2,
      });
      ctrl.start(cues, 'en', 'vi');
      ctrl.pause();
      // Wait a bit — should not complete all chunks while paused
      await sleep(100);
      // Some chunks may have completed, but not all (paused mid-queue)
      const sizeWhilePaused = ctrl.cacheSize;
      expect(sizeWhilePaused).toBeLessThan(6);
      ctrl.resume();
      await waitFor(() => !ctrl.isRunning);
      expect(ctrl.cacheSize).toBe(6);
    });
  });

  describe('clear', () => {
    it('clears cache + cancels queue', async () => {
      const cues = makeCues(['hello', 'world']);
      const ctrl = new BackgroundPrefillController({
        translate: mockTranslate,
        onChunkTranslated: () => {},
        requestGapMs: 10,
      });
      ctrl.start(cues, 'en', 'vi');
      await waitFor(() => !ctrl.isRunning);
      expect(ctrl.cacheSize).toBe(2);
      ctrl.clear();
      expect(ctrl.cacheSize).toBe(0);
      expect(ctrl.isRunning).toBe(false);
    });
  });

  describe('error handling + backoff', () => {
    it('calls onError after MAX_RETRIES and stops', async () => {
      const cues = makeCues(['hello']);
      const errors: string[] = [];
      const ctrl = new BackgroundPrefillController({
        translate: failingTranslate,
        onChunkTranslated: () => {},
        onError: (msg) => errors.push(msg),
        requestGapMs: 10,
        maxRetries: 2,
        backoffBaseMs: 10, // fast backoff for tests
      });
      ctrl.start(cues, 'en', 'vi');
      await waitFor(() => !ctrl.isRunning);
      expect(errors.length).toBe(1);
      expect(errors[0]).toContain('temporarily unavailable');
      expect(ctrl.cacheSize).toBe(0);
    });
  });

  describe('getTranslatedCues', () => {
    it('returns cues with cached text + empty for misses', async () => {
      const cues = makeCues(['hello', 'world', 'foo']);
      const ctrl = new BackgroundPrefillController({
        translate: mockTranslate,
        onChunkTranslated: () => {},
        requestGapMs: 10,
      });
      ctrl.start(cues, 'en', 'vi');
      await waitFor(() => !ctrl.isRunning);
      const translated = ctrl.getTranslatedCues();
      expect(translated).toHaveLength(3);
      expect(translated[0].text).toBe('HELLO');
      expect(translated[1].text).toBe('WORLD');
      expect(translated[2].text).toBe('FOO');
      // Timing preserved from target
      expect(translated[0].start).toBe(0);
      expect(translated[0].end).toBe(1000);
    });
  });

  describe('has', () => {
    it('returns true for cached index, false for uncached', async () => {
      const cues = makeCues(['hello']);
      const ctrl = new BackgroundPrefillController({
        translate: mockTranslate,
        onChunkTranslated: () => {},
        requestGapMs: 10,
      });
      ctrl.start(cues, 'en', 'vi');
      await waitFor(() => !ctrl.isRunning);
      expect(ctrl.has(0)).toBe(true);
      expect(ctrl.has(99)).toBe(false);
    });
  });
});

/** Helper: wait until condition is true (poll every 10ms, timeout 2s). */
function waitFor(condition: () => boolean, timeoutMs: number = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (condition()) resolve();
      else if (Date.now() - start > timeoutMs) reject(new Error('waitFor timeout'));
      else setTimeout(check, 10);
    };
    check();
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

