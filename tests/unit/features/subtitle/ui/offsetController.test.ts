import { OffsetController, tryParseInput } from '@/features/subtitle/ui/offsetController';
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

describe('OffsetController (V2 — direct apply + persist, no lazy/badge)', () => {
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
    container.remove();
  });

  describe('init', () => {
    it('creates section (nested trong manager panel), no badge', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      const section = managerPanel.querySelector('[data-testid="offset-section"]');
      expect(section).not.toBeNull();
      // V2: no badge
      const badge = container.querySelector('[data-testid="offset-lazy-badge"]');
      expect(badge).toBeNull();
      ctrl.destroy();
    });

    it('defers init when managerPanel null (no-op)', () => {
      const ctrl = new OffsetController(video, container, url, undefined, null);
      ctrl.init();
      expect(managerPanel.querySelector('[data-testid="offset-section"]')).toBeNull();
      ctrl.destroy();
    });

    it('loads persisted offset on init', () => {
      const snapshot = { subtitleOffset: { [url]: 700 } };
      const ctrl = new OffsetController(video, container, url, snapshot, managerPanel);
      ctrl.init();
      expect(ctrl.getOffsetMs()).toBe(700);
      ctrl.destroy();
    });

    it('clamps persisted offset to ±60s', () => {
      const snapshot = { subtitleOffset: { [url]: 999999 } };
      const ctrl = new OffsetController(video, container, url, snapshot, managerPanel);
      ctrl.init();
      expect(ctrl.getOffsetMs()).toBe(60000);
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
    it('loadCues(true) sets hasSubtitle, section updates (controls enabled)', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      const reset = managerPanel.querySelector('[data-testid="offset-reset"]') as HTMLButtonElement;
      expect(reset.disabled).toBe(false);
      ctrl.destroy();
    });

    it('loadCues(false) after true resets offset to 0 + persist', async () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      // Step +500
      const btn = managerPanel.querySelector('[data-testid="offset-step-500"]') as HTMLButtonElement;
      btn.click();
      expect(ctrl.getOffsetMs()).toBe(500);
      // Unload → reset
      ctrl.loadCues(false);
      expect(ctrl.getOffsetMs()).toBe(0);
      await new Promise((r) => setTimeout(r, 50));
      ctrl.destroy();
    });
  });

  describe('handleStep (accumulate + persist ngay)', () => {
    it('step +500 then +2000 → 2500', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      (managerPanel.querySelector('[data-testid="offset-step-500"]') as HTMLButtonElement).click();
      (managerPanel.querySelector('[data-testid="offset-step-2000"]') as HTMLButtonElement).click();
      expect(ctrl.getOffsetMs()).toBe(2500);
      ctrl.destroy();
    });

    it('step -500 then -2000 → -2500', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      (managerPanel.querySelector('[data-testid="offset-step--500"]') as HTMLButtonElement).click();
      (managerPanel.querySelector('[data-testid="offset-step--2000"]') as HTMLButtonElement).click();
      expect(ctrl.getOffsetMs()).toBe(-2500);
      ctrl.destroy();
    });

    it('step does nothing when no subtitle loaded', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      (managerPanel.querySelector('[data-testid="offset-step-500"]') as HTMLButtonElement).click();
      expect(ctrl.getOffsetMs()).toBe(0);
      ctrl.destroy();
    });

    it('step persists to settingsStore ngay (no lazy)', async () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      (managerPanel.querySelector('[data-testid="offset-step-500"]') as HTMLButtonElement).click();
      await new Promise((r) => setTimeout(r, 50));
      const stored = storage.settings as { subtitleOffset: Record<string, number> };
      expect(stored.subtitleOffset[url]).toBe(500);
      ctrl.destroy();
    });

    it('step broadcasts VIDEO_TIME_UPDATE to side panel', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      mockedSendMessage.mockClear();
      video.currentTime = 123;
      (managerPanel.querySelector('[data-testid="offset-step-500"]') as HTMLButtonElement).click();
      expect(mockedSendMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'VIDEO_TIME_UPDATE',
        payload: expect.objectContaining({
          currentTimeMs: 123000,
          offsetMs: 500,
        }),
      }));
      ctrl.destroy();
    });

    it('step clamps to ±60s', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      // Click +2s 31 times → 62s → clamp to 60s
      const btn = managerPanel.querySelector('[data-testid="offset-step-2000"]') as HTMLButtonElement;
      for (let i = 0; i < 31; i++) btn.click();
      expect(ctrl.getOffsetMs()).toBe(60000);
      ctrl.destroy();
    });
  });

  describe('handleReset', () => {
    it('reset sets value=0 + persist ngay', async () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      (managerPanel.querySelector('[data-testid="offset-step-500"]') as HTMLButtonElement).click();
      expect(ctrl.getOffsetMs()).toBe(500);
      (managerPanel.querySelector('[data-testid="offset-reset"]') as HTMLButtonElement).click();
      expect(ctrl.getOffsetMs()).toBe(0);
      await new Promise((r) => setTimeout(r, 50));
      // value=0 → key removed from storage
      const stored = storage.settings as { subtitleOffset: Record<string, number> };
      expect(stored.subtitleOffset[url]).toBeUndefined();
      ctrl.destroy();
    });

    it('reset broadcasts to side panel', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      mockedSendMessage.mockClear();
      (managerPanel.querySelector('[data-testid="offset-reset"]') as HTMLButtonElement).click();
      expect(mockedSendMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'VIDEO_TIME_UPDATE',
        payload: expect.objectContaining({ offsetMs: 0 }),
      }));
      ctrl.destroy();
    });
  });

  describe('handleInput', () => {
    it('valid input replaces value + persist ngay', async () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      ctrl.stepBy(500); // start from 500
      const input = managerPanel.querySelector('[data-testid="offset-input"]') as HTMLInputElement;
      input.value = '1.5';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(ctrl.getOffsetMs()).toBe(1500);
      await new Promise((r) => setTimeout(r, 50));
      const stored = storage.settings as { subtitleOffset: Record<string, number> };
      expect(stored.subtitleOffset[url]).toBe(1500);
      ctrl.destroy();
    });

    it('invalid input does not change value', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.loadCues(true);
      const input = managerPanel.querySelector('[data-testid="offset-input"]') as HTMLInputElement;
      input.value = 'abc';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(ctrl.getOffsetMs()).toBe(0);
      ctrl.destroy();
    });
  });

  describe('destroy', () => {
    it('removes section from DOM (no badge in V2)', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      expect(managerPanel.querySelector('[data-testid="offset-section"]')).not.toBeNull();
      ctrl.destroy();
      expect(managerPanel.querySelector('[data-testid="offset-section"]')).toBeNull();
    });

    it('safe to call twice', () => {
      const ctrl = new OffsetController(video, container, url, undefined, managerPanel);
      ctrl.init();
      ctrl.destroy();
      expect(() => ctrl.destroy()).not.toThrow();
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
});
