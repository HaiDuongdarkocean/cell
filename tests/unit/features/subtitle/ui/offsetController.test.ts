import { OffsetController, tryParseInput } from '@/features/subtitle/ui/offsetController';
import { INITIAL_OFFSET_STATE, AUTO_COMMIT_MS } from '@/features/subtitle/logic/subtitleOffset';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';

// Mock chrome runtime messaging (OffsetController broadcasts offset changes to side panel)
jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  sendMessage: jest.fn(),
}));
const mockedSendMessage = sendMessage as jest.MockedFunction<typeof sendMessage>;

// Mock settingsStore
const storage: Record<string, unknown> = {};
const chromeMock = {
  storage: {
    local: {
      get: jest.fn(async (keys: string | string[]) => {
        const key = Array.isArray(keys) ? keys[0] : keys;
        return { [key]: storage[key] };
      }),
      set: jest.fn(async (obj: Record<string, unknown>) => {
        Object.assign(storage, obj);
      }),
    },
  },
};
(global as { chrome?: unknown }).chrome = chromeMock;

describe('OffsetController', () => {
  let video: HTMLVideoElement;
  let container: HTMLDivElement;
  let managerPanel: HTMLDivElement;
  const url = 'https://example.com/video?id=abc';

  beforeEach(() => {
    Object.keys(storage).forEach((k) => delete storage[k]);
    chromeMock.storage.local.get.mockClear();
    chromeMock.storage.local.set.mockClear();
    video = document.createElement('video');
    container = document.createElement('div');
    managerPanel = document.createElement('div');
    managerPanel.setAttribute('data-testid', 'subtitle-manager-panel');
    container.appendChild(managerPanel);
    document.body.appendChild(container);
    // Mock Date.now
    jest.spyOn(Date, 'now').mockReturnValue(1000000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    container.remove();
  });

  describe('init', () => {
    it('creates section (nested trong manager panel) + badge (floating)', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      const section = managerPanel.querySelector('[data-testid="offset-section"]');
      const badge = container.querySelector('[data-testid="offset-lazy-badge"]');
      expect(section).not.toBeNull();
      expect(badge).not.toBeNull();
      expect((badge as HTMLElement).style.display).toBe('none');
      ctrl.destroy();
    });

    it('defers init when managerPanel null (no-op)', () => {
      const ctrl = new OffsetController(video, container, url, undefined, null);
      ctrl.init();
      // Section not created
      expect(managerPanel.querySelector('[data-testid="offset-section"]')).toBeNull();
      ctrl.destroy();
    });

    it('loads persisted offset on init (mode=committed, no lazy)', () => {
      const snapshot = { subtitleOffset: { [url]: 700 } };
      const ctrl = new OffsetController(video, container, url, snapshot, managerPanel);
      ctrl.init();
      expect(ctrl.getOffsetMs()).toBe(700);
      // Badge should NOT show (committed mode)
      const badge = container.querySelector('[data-testid="offset-lazy-badge"]') as HTMLElement;
      expect(badge.style.display).toBe('none');
      ctrl.destroy();
    });

    it('clamps persisted offset to ±60s', () => {
      const snapshot = { subtitleOffset: { [url]: 999999 } };
      const ctrl = new OffsetController(video, container, url, snapshot, managerPanel);
      ctrl.init();
      expect(ctrl.getOffsetMs()).toBe(60000); // clamped to max
      ctrl.destroy();
    });

    it('ignores persisted offset of 0 (no key stored)', () => {
      const snapshot = { subtitleOffset: { [url]: 0 } };
      const ctrl = new OffsetController(video, container, url, snapshot, managerPanel);
      ctrl.init();
      expect(ctrl.getOffsetMs()).toBe(0);
      ctrl.destroy();
    });
  });

  describe('loadCues', () => {
    it('loadCues(true) sets hasSubtitle, section updates', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      // Section should reflect hasSubtitle=true (controls enabled)
      const reset = managerPanel.querySelector('[data-testid="offset-reset"]') as HTMLButtonElement;
      expect(reset.disabled).toBe(false);
      ctrl.destroy();
    });

    it('loadCues(false) after true resets offset to 0', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      // Simulate step +500
      ctrl.loadCues(true); // no-op (already loaded)
      // Step via section click
      const stepper = managerPanel.querySelector('[data-testid="offset-stepper"]')!;
      const plusBtn = stepper.querySelectorAll('button')[2] as HTMLButtonElement; // +0.5s
      plusBtn.click();
      expect(ctrl.getOffsetMs()).toBe(500);
      // Unload → reset
      ctrl.loadCues(false);
      expect(ctrl.getOffsetMs()).toBe(0);
      ctrl.destroy();
    });
  });

  describe('handleStep (accumulate)', () => {
    it('step +500 then +2000 → 2500', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      const stepper = managerPanel.querySelector('[data-testid="offset-stepper"]')!;
      const btns = stepper.querySelectorAll('button');
      (btns[2] as HTMLButtonElement).click(); // +0.5s
      (btns[3] as HTMLButtonElement).click(); // +2s
      expect(ctrl.getOffsetMs()).toBe(2500);
      ctrl.destroy();
    });

    it('step -500 then -2000 → -2500', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      const stepper = managerPanel.querySelector('[data-testid="offset-stepper"]')!;
      const btns = stepper.querySelectorAll('button');
      (btns[1] as HTMLButtonElement).click(); // -0.5s
      (btns[0] as HTMLButtonElement).click(); // -2s
      expect(ctrl.getOffsetMs()).toBe(-2500);
      ctrl.destroy();
    });

    it('step enters lazy mode + shows badge', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      const stepper = managerPanel.querySelector('[data-testid="offset-stepper"]')!;
      const plusBtn = stepper.querySelectorAll('button')[2] as HTMLButtonElement;
      plusBtn.click();
      const badge = container.querySelector('[data-testid="offset-lazy-badge"]') as HTMLElement;
      expect(badge.style.display).toBe('inline-flex');
      ctrl.destroy();
    });

    it('step does nothing when no subtitle loaded', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      // Don't loadCues — hasSubtitle=false
      const stepper = managerPanel.querySelector('[data-testid="offset-stepper"]')!;
      const plusBtn = stepper.querySelectorAll('button')[2] as HTMLButtonElement;
      plusBtn.click();
      expect(ctrl.getOffsetMs()).toBe(0);
      ctrl.destroy();
    });

    it('broadcasts VIDEO_TIME_UPDATE to side panel when offset changes', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      mockedSendMessage.mockClear();
      video.currentTime = 123;
      const stepper = managerPanel.querySelector('[data-testid="offset-stepper"]')!;
      (stepper.querySelectorAll('button')[2] as HTMLButtonElement).click(); // +0.5s
      expect(mockedSendMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'VIDEO_TIME_UPDATE',
        payload: expect.objectContaining({
          currentTimeMs: 123000,
          durationMs: 0,
          offsetMs: 500,
        }),
      }));
      ctrl.destroy();
    });

    it('step clamps to ±60s', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      const stepper = managerPanel.querySelector('[data-testid="offset-stepper"]')!;
      const btns = stepper.querySelectorAll('button');
      // Click +2s 31 times → 62s → clamp to 60s
      for (let i = 0; i < 31; i++) {
        (btns[3] as HTMLButtonElement).click();
      }
      expect(ctrl.getOffsetMs()).toBe(60000);
      ctrl.destroy();
    });
  });

  describe('handleReset', () => {
    it('reset sets value=0, stays lazy, timer reset', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      const stepper = managerPanel.querySelector('[data-testid="offset-stepper"]')!;
      (stepper.querySelectorAll('button')[2] as HTMLButtonElement).click(); // +0.5s
      expect(ctrl.getOffsetMs()).toBe(500);
      // Reset
      const reset = managerPanel.querySelector('[data-testid="offset-reset"]') as HTMLButtonElement;
      reset.click();
      expect(ctrl.getOffsetMs()).toBe(0);
      // Badge still visible (lazy mode)
      const badge = container.querySelector('[data-testid="offset-lazy-badge"]') as HTMLElement;
      expect(badge.style.display).toBe('inline-flex');
      ctrl.destroy();
    });
  });

  describe('handleApply (commit + persist)', () => {
    it('apply commits + persists to settingsStore', async () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      const stepper = managerPanel.querySelector('[data-testid="offset-stepper"]')!;
      (stepper.querySelectorAll('button')[2] as HTMLButtonElement).click(); // +0.5s
      // Apply
      const apply = managerPanel.querySelector('[data-testid="offset-apply"]') as HTMLButtonElement;
      apply.click();
      // Wait for persist (async)
      await new Promise((r) => setTimeout(r, 50));
      expect(ctrl.getOffsetMs()).toBe(500);
      // Check storage
      const stored = storage.settings as { subtitleOffset: Record<string, number> };
      expect(stored.subtitleOffset[url]).toBe(500);
      // Badge hidden (committed)
      const badge = container.querySelector('[data-testid="offset-lazy-badge"]') as HTMLElement;
      expect(badge.style.display).toBe('none');
      ctrl.destroy();
    });

    it('apply with value=0 removes key from storage (no zeros stored)', async () => {
      // Pre-populate storage with offset
      storage.settings = { subtitleOffset: { [url]: 500 }, schemaVersion: 3 };
      const snapshot = { subtitleOffset: { [url]: 500 } };
      const ctrl = new OffsetController(video, container, url, snapshot, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      // Reset to 0 then apply
      const reset = managerPanel.querySelector('[data-testid="offset-reset"]') as HTMLButtonElement;
      reset.click();
      const apply = managerPanel.querySelector('[data-testid="offset-apply"]') as HTMLButtonElement;
      apply.click();
      await new Promise((r) => setTimeout(r, 50));
      const stored = storage.settings as { subtitleOffset: Record<string, number> };
      expect(stored.subtitleOffset[url]).toBeUndefined();
      ctrl.destroy();
    });

    it('apply flashes "✓ Đã lưu" on button', async () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      const stepper = managerPanel.querySelector('[data-testid="offset-stepper"]')!;
      (stepper.querySelectorAll('button')[2] as HTMLButtonElement).click();
      const apply = managerPanel.querySelector('[data-testid="offset-apply"]') as HTMLButtonElement;
      apply.click();
      // Flash should change text
      expect(apply.textContent).toContain('Đã lưu');
      ctrl.destroy();
    });
  });

  describe('auto-commit (wall-clock)', () => {
    it('does not auto-commit when mode=committed', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      // Advance time beyond 2 phút
      jest.spyOn(Date, 'now').mockReturnValue(1000000 + AUTO_COMMIT_MS + 1000);
      // Trigger timeupdate
      video.dispatchEvent(new Event('timeupdate'));
      expect(ctrl.getOffsetMs()).toBe(0); // unchanged (was 0, committed)
      ctrl.destroy();
    });

    it('auto-commits when lazy + > 2 phút since last action (timeupdate)', async () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      const stepper = managerPanel.querySelector('[data-testid="offset-stepper"]')!;
      (stepper.querySelectorAll('button')[2] as HTMLButtonElement).click(); // +0.5s, lazy
      expect(ctrl.getOffsetMs()).toBe(500);
      // Advance time beyond 2 phút
      jest.spyOn(Date, 'now').mockReturnValue(1000000 + AUTO_COMMIT_MS + 100);
      // Trigger timeupdate → auto-commit
      video.dispatchEvent(new Event('timeupdate'));
      await new Promise((r) => setTimeout(r, 50));
      // Persisted
      const stored = storage.settings as { subtitleOffset: Record<string, number> };
      expect(stored.subtitleOffset[url]).toBe(500);
      // Badge hidden
      const badge = container.querySelector('[data-testid="offset-lazy-badge"]') as HTMLElement;
      expect(badge.style.display).toBe('none');
      ctrl.destroy();
    });

    it('auto-commits on visibilitychange (tab visible lại after 2 phút)', async () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      const stepper = managerPanel.querySelector('[data-testid="offset-stepper"]')!;
      (stepper.querySelectorAll('button')[2] as HTMLButtonElement).click(); // +0.5s, lazy
      // Simulate tab sleep 2 phút
      jest.spyOn(Date, 'now').mockReturnValue(1000000 + AUTO_COMMIT_MS + 500);
      // visibilitychange → visible
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((r) => setTimeout(r, 50));
      const stored = storage.settings as { subtitleOffset: Record<string, number> };
      expect(stored.subtitleOffset[url]).toBe(500);
      ctrl.destroy();
    });

    it('does NOT auto-commit when lazy but < 2 phút (timer still running)', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      const stepper = managerPanel.querySelector('[data-testid="offset-stepper"]')!;
      (stepper.querySelectorAll('button')[2] as HTMLButtonElement).click();
      // Advance only 90s
      jest.spyOn(Date, 'now').mockReturnValue(1000000 + 90000);
      video.dispatchEvent(new Event('timeupdate'));
      // Still lazy, not committed
      const badge = container.querySelector('[data-testid="offset-lazy-badge"]') as HTMLElement;
      expect(badge.style.display).toBe('inline-flex');
      expect(ctrl.getOffsetMs()).toBe(500);
      ctrl.destroy();
    });

    it('each action resets timer (90s + 90s + 30s = no commit)', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      const stepper = managerPanel.querySelector('[data-testid="offset-stepper"]')!;
      (stepper.querySelectorAll('button')[2] as HTMLButtonElement).click(); // t=0
      // 90s later, click again → timer reset
      jest.spyOn(Date, 'now').mockReturnValue(1000000 + 90000);
      (stepper.querySelectorAll('button')[2] as HTMLButtonElement).click(); // t=90s, reset
      // 90s after that = 180s total, but only 90s since last action → no commit
      jest.spyOn(Date, 'now').mockReturnValue(1000000 + 180000);
      video.dispatchEvent(new Event('timeupdate'));
      const badge = container.querySelector('[data-testid="offset-lazy-badge"]') as HTMLElement;
      expect(badge.style.display).toBe('inline-flex'); // still lazy
      ctrl.destroy();
    });
  });

  describe('destroy', () => {
    it('removes section + badge from DOM', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      expect(managerPanel.querySelector('[data-testid="offset-section"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="offset-lazy-badge"]')).not.toBeNull();
      ctrl.destroy();
      expect(managerPanel.querySelector('[data-testid="offset-section"]')).toBeNull();
      expect(container.querySelector('[data-testid="offset-lazy-badge"]')).toBeNull();
    });

    it('safe to call twice', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.destroy();
      expect(() => ctrl.destroy()).not.toThrow();
    });

    it('removes timeupdate + visibilitychange listeners', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      const stepper = managerPanel.querySelector('[data-testid="offset-stepper"]')!;
      (stepper.querySelectorAll('button')[2] as HTMLButtonElement).click();
      ctrl.destroy();
      // Advance time + trigger events → no commit (listeners removed)
      jest.spyOn(Date, 'now').mockReturnValue(1000000 + AUTO_COMMIT_MS + 1000);
      video.dispatchEvent(new Event('timeupdate'));
      document.dispatchEvent(new Event('visibilitychange'));
      // No persist happened (storage empty)
      expect(storage.settings).toBeUndefined();
    });
  });

  describe('tryParseInput (exported helper)', () => {
    it('parses valid input', () => {
      expect(tryParseInput('0.5')).toBe(500);
      expect(tryParseInput('-2')).toBe(-2000);
    });

    it('returns null for invalid', () => {
      expect(tryParseInput('abc')).toBeNull();
      expect(tryParseInput('')).toBeNull();
    });
  });

  describe('INITIAL_OFFSET_STATE (sanity)', () => {
    it('starts committed with zero offset', () => {
      expect(INITIAL_OFFSET_STATE.valueMs).toBe(0);
      expect(INITIAL_OFFSET_STATE.mode).toBe('committed');
      expect(INITIAL_OFFSET_STATE.lastActionAt).toBe(0);
    });
  });
});
