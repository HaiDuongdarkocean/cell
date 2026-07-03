import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { NavClusterController } from '@/features/subtitle/ui/navClusterController';
import { DEFAULT_NAV_CLUSTER_SETTINGS } from '@/shared/config/config';
import type { SrtCue } from '@/entities/media';

function makeVideo(overrides: Partial<HTMLVideoElement> = {}): HTMLVideoElement {
  const video = document.createElement('video');
  // duration is read-only on HTMLMediaElement — use defineProperty
  Object.defineProperty(video, 'duration', {
    value: overrides.duration ?? 100,
    writable: true,
    configurable: true,
  });
  video.currentTime = overrides.currentTime ?? 0;
  return video as unknown as HTMLVideoElement;
}

function makeContainer(): HTMLDivElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

const CUES: SrtCue[] = [
  { index: 1, start: 0, end: 2000, text: 'Hello' },
  { index: 2, start: 3000, end: 5000, text: 'World' },
];

describe('NavClusterController (ADR-018 D1, frontend design)', () => {
  let video: HTMLVideoElement;
  let container: HTMLDivElement;

  beforeEach(() => {
    video = makeVideo();
    container = makeContainer();
  });

  afterEach(() => {
    container.remove();
  });

  describe('init', () => {
    it('builds cluster DOM with role=toolbar + 6 buttons', () => {
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      const cluster = container.querySelector('[data-testid="nav-cluster"]');
      expect(cluster).not.toBeNull();
      expect(cluster?.getAttribute('role')).toBe('toolbar');
      expect(container.querySelector('[data-testid="nav-cluster-prev"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="nav-cluster-repeat"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="nav-cluster-next"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="nav-cluster-rewind"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="nav-cluster-forward"]')).not.toBeNull();
      ctrl.destroy();
    });

    it('applies initial position via left/top %', () => {
      const settings = { ...DEFAULT_NAV_CLUSTER_SETTINGS, position: { x: 30, y: 60 } };
      const ctrl = new NavClusterController(video, container, settings, { targetCues: [], nativeCues: [] });
      ctrl.init();
      const cluster = container.querySelector('[data-testid="nav-cluster"]') as HTMLElement;
      expect(cluster.style.left).toBe('30%');
      expect(cluster.style.top).toBe('60%');
      ctrl.destroy();
    });

    it('is idempotent — second init is no-op', () => {
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      const cluster1 = container.querySelector('[data-testid="nav-cluster"]');
      ctrl.init();
      const cluster2 = container.querySelector('[data-testid="nav-cluster"]');
      expect(cluster1).toBe(cluster2);
      ctrl.destroy();
    });

    it('cluster has aria-grabbed=false by default (ADR-015 pattern)', () => {
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      const cluster = container.querySelector('[data-testid="nav-cluster"]') as HTMLElement;
      expect(cluster.getAttribute('aria-grabbed')).toBe('false');
      ctrl.destroy();
    });

    it('drag on cluster background starts drag (ADR-015)', () => {
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      const cluster = container.querySelector('[data-testid="nav-cluster"]') as HTMLElement;
      cluster.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      expect(cluster.getAttribute('aria-grabbed')).toBe('true');
      ctrl.destroy();
    });

    it('drag on action button is skipped (ADR-015 skip sub-elements)', () => {
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      const prevBtn = container.querySelector('[data-testid="nav-cluster-prev"]') as HTMLButtonElement;
      prevBtn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      const cluster = container.querySelector('[data-testid="nav-cluster"]') as HTMLElement;
      expect(cluster.getAttribute('aria-grabbed')).toBe('false');
      ctrl.destroy();
    });

    it('drag on SVG icon inside button is skipped (closest() check, regression)', () => {
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: CUES, nativeCues: [] });
      ctrl.init();
      ctrl.updateCues(CUES, []);
      const prevBtn = container.querySelector('[data-testid="nav-cluster-prev"]') as HTMLButtonElement;
      const svg = prevBtn.querySelector('svg');
      expect(svg).not.toBeNull();
      svg!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      const cluster = container.querySelector('[data-testid="nav-cluster"]') as HTMLElement;
      expect(cluster.getAttribute('aria-grabbed')).toBe('false');
      ctrl.destroy();
    });

    it('double-click on action button does NOT reset position (regression)', () => {
      const customPos = { x: 50, y: 50 };
      const ctrl = new NavClusterController(video, container, { ...DEFAULT_NAV_CLUSTER_SETTINGS, position: customPos }, { targetCues: CUES, nativeCues: [] });
      ctrl.init();
      ctrl.updateCues(CUES, []);
      const prevBtn = container.querySelector('[data-testid="nav-cluster-prev"]') as HTMLButtonElement;
      prevBtn.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      const cluster = container.querySelector('[data-testid="nav-cluster"]') as HTMLElement;
      // Position should NOT reset to default (0, 75)
      expect(cluster.style.left).toBe('50%');
      expect(cluster.style.top).toBe('50%');
      ctrl.destroy();
    });

    it('double-click on cluster background resets position to default', () => {
      const customPos = { x: 50, y: 50 };
      const ctrl = new NavClusterController(video, container, { ...DEFAULT_NAV_CLUSTER_SETTINGS, position: customPos }, { targetCues: CUES, nativeCues: [] });
      ctrl.init();
      ctrl.updateCues(CUES, []);
      const cluster = container.querySelector('[data-testid="nav-cluster"]') as HTMLElement;
      cluster.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      expect(cluster.style.left).toBe('0%');
      expect(cluster.style.top).toBe('75%');
      ctrl.destroy();
    });
  });

  describe('updateCues — 4↔6 nút transition', () => {
    it('starts in no-sub state (4 nút, secondary hidden)', () => {
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      const cluster = container.querySelector('[data-testid="nav-cluster"]') as HTMLElement;
      expect(cluster.classList.contains('no-sub')).toBe(true);
      ctrl.destroy();
    });

    it('transitions to 6-nút when cues loaded', () => {
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      ctrl.updateCues(CUES, []);
      const cluster = container.querySelector('[data-testid="nav-cluster"]') as HTMLElement;
      expect(cluster.classList.contains('no-sub')).toBe(false);
      ctrl.destroy();
    });

    it('transitions back to 4-nút when cues unloaded', () => {
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      ctrl.updateCues(CUES, []);
      ctrl.updateCues([], []);
      const cluster = container.querySelector('[data-testid="nav-cluster"]') as HTMLElement;
      expect(cluster.classList.contains('no-sub')).toBe(true);
      ctrl.destroy();
    });
  });

  describe('updateSettings — realtime apply', () => {
    it('updates visibility when enabled=false', () => {
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      ctrl.updateSettings({ enabled: false });
      const cluster = container.querySelector('[data-testid="nav-cluster"]') as HTMLElement;
      expect(cluster.style.display).toBe('none');
      ctrl.destroy();
    });

    it('updates position when position changes', () => {
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      ctrl.updateSettings({ position: { x: 50, y: 25 } });
      const cluster = container.querySelector('[data-testid="nav-cluster"]') as HTMLElement;
      expect(cluster.style.left).toBe('50%');
      expect(cluster.style.top).toBe('25%');
      ctrl.destroy();
    });
  });

  describe('setVisible', () => {
    it('hides cluster when visible=false', () => {
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      ctrl.setVisible(false);
      const cluster = container.querySelector('[data-testid="nav-cluster"]') as HTMLElement;
      expect(cluster.style.display).toBe('none');
      ctrl.destroy();
    });

    it('shows cluster when visible=true', () => {
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      ctrl.setVisible(false);
      ctrl.setVisible(true);
      const cluster = container.querySelector('[data-testid="nav-cluster"]') as HTMLElement;
      expect(cluster.style.display).not.toBe('none');
      ctrl.destroy();
    });
  });

  describe('button actions', () => {
    it('prev button click seeks to previous cue', () => {
      video.currentTime = 4; // index 1
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: CUES, nativeCues: [] });
      ctrl.init();
      ctrl.updateCues(CUES, []);
      const prevBtn = container.querySelector('[data-testid="nav-cluster-prev"]') as HTMLButtonElement;
      prevBtn.click();
      expect(video.currentTime).toBe(0); // cues[0].start/1000
      ctrl.destroy();
    });

    it('next button click seeks to next cue', () => {
      video.currentTime = 1; // index 0
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: CUES, nativeCues: [] });
      ctrl.init();
      ctrl.updateCues(CUES, []);
      const nextBtn = container.querySelector('[data-testid="nav-cluster-next"]') as HTMLButtonElement;
      nextBtn.click();
      expect(video.currentTime).toBe(3); // cues[1].start/1000
      ctrl.destroy();
    });

    it('rewind button click seeks -5s', () => {
      video.currentTime = 20;
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      const rewindBtn = container.querySelector('[data-testid="nav-cluster-rewind"]') as HTMLButtonElement;
      rewindBtn.click();
      expect(video.currentTime).toBe(15);
      ctrl.destroy();
    });

    it('forward button click seeks +10s', () => {
      video.currentTime = 20;
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      const forwardBtn = container.querySelector('[data-testid="nav-cluster-forward"]') as HTMLButtonElement;
      forwardBtn.click();
      expect(video.currentTime).toBe(30);
      ctrl.destroy();
    });
  });

  describe('repeat hold', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('pointerdown on repeat starts 500ms timer; fires loop after threshold', () => {
      video.currentTime = 3.5; // in cue 1 (3000-5000)
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: CUES, nativeCues: [] });
      ctrl.init();
      ctrl.updateCues(CUES, []);
      const repeatBtn = container.querySelector('[data-testid="nav-cluster-repeat"]') as HTMLButtonElement;
      repeatBtn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      expect(repeatBtn.getAttribute('aria-pressed')).toBe('true');
      // Advance past 500ms threshold to start repeat loop
      jest.advanceTimersByTime(600);
      // Simulate timeupdate reaching cue end
      video.currentTime = 5.1;
      video.dispatchEvent(new Event('timeupdate'));
      // Should seek back to cue start (3s)
      expect(video.currentTime).toBe(3);
      repeatBtn.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
      expect(repeatBtn.getAttribute('aria-pressed')).toBe('false');
      ctrl.destroy();
    });

    it('pointerup before 500ms cancels loop AND one-shot repeats current cue (click = repeat once)', () => {
      video.currentTime = 3.5; // in cue 1 (3000-5000)
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: CUES, nativeCues: [] });
      ctrl.init();
      ctrl.updateCues(CUES, []);
      const repeatBtn = container.querySelector('[data-testid="nav-cluster-repeat"]') as HTMLButtonElement;
      repeatBtn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      jest.advanceTimersByTime(200); // < 500ms → quick click
      repeatBtn.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
      expect(repeatBtn.getAttribute('aria-pressed')).toBe('false');
      // One-shot repeat: seek to current cue start (3s)
      expect(video.currentTime).toBe(3);
      ctrl.destroy();
    });

    it('quick click repeat with no cues is a no-op (nothing to repeat)', () => {
      video.currentTime = 10;
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      const repeatBtn = container.querySelector('[data-testid="nav-cluster-repeat"]') as HTMLButtonElement;
      repeatBtn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      jest.advanceTimersByTime(200);
      repeatBtn.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
      expect(video.currentTime).toBe(10); // unchanged
      ctrl.destroy();
    });

    it('hold ≥500ms loops (no one-shot seek on release)', () => {
      video.currentTime = 3.5; // in cue 1 (3000-5000)
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: CUES, nativeCues: [] });
      ctrl.init();
      ctrl.updateCues(CUES, []);
      const repeatBtn = container.querySelector('[data-testid="nav-cluster-repeat"]') as HTMLButtonElement;
      repeatBtn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      jest.advanceTimersByTime(600); // ≥ 500ms → loop starts
      // Simulate timeupdate reaching cue end → seek back to start
      video.currentTime = 5.1;
      video.dispatchEvent(new Event('timeupdate'));
      expect(video.currentTime).toBe(3);
      // Release — loop was active, so NO one-shot seek (currentTime stays at loop position)
      video.currentTime = 4.2;
      repeatBtn.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
      expect(video.currentTime).toBe(4.2); // unchanged — no one-shot on hold release
      expect(repeatBtn.getAttribute('aria-pressed')).toBe('false');
      ctrl.destroy();
    });

    it('quick click repeat in gap seeks to nearest cue (ADR-018 edge case)', () => {
      // gap between cue[0] (0-2000) and cue[1] (3000-5000), t=2.2s
      // nearest = cue[0] (dist 200 to end) vs cue[1] (dist 800 to start)
      video.currentTime = 2.2;
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: CUES, nativeCues: [] });
      ctrl.init();
      ctrl.updateCues(CUES, []);
      const repeatBtn = container.querySelector('[data-testid="nav-cluster-repeat"]') as HTMLButtonElement;
      repeatBtn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      jest.advanceTimersByTime(200); // quick click
      repeatBtn.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
      expect(video.currentTime).toBe(0); // seek to nearest cue start
      ctrl.destroy();
    });

    it('quick click repeat in gap closer to next cue seeks forward', () => {
      // t=2.8s: dist to cue[0].end(2000) = 800; dist to cue[1].start(3000) = 200
      video.currentTime = 2.8;
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: CUES, nativeCues: [] });
      ctrl.init();
      ctrl.updateCues(CUES, []);
      const repeatBtn = container.querySelector('[data-testid="nav-cluster-repeat"]') as HTMLButtonElement;
      repeatBtn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      jest.advanceTimersByTime(200);
      repeatBtn.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
      expect(video.currentTime).toBe(3); // seek to nearest cue (cue[1]) start
      ctrl.destroy();
    });

    it('hold repeat in gap loops nearest cue (not [t-3s,t] window)', () => {
      // t=2.8s in gap, nearest = cue[1] (3000-5000)
      video.currentTime = 2.8;
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: CUES, nativeCues: [] });
      ctrl.init();
      ctrl.updateCues(CUES, []);
      const repeatBtn = container.querySelector('[data-testid="nav-cluster-repeat"]') as HTMLButtonElement;
      repeatBtn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      jest.advanceTimersByTime(600); // ≥ 500ms → loop starts
      // Simulate timeupdate reaching cue[1] end (5s) → seek back to cue[1] start (3s)
      video.currentTime = 5.1;
      video.dispatchEvent(new Event('timeupdate'));
      expect(video.currentTime).toBe(3); // loops cue[1], not [t-3s,t] window
      repeatBtn.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
      ctrl.destroy();
    });
  });

  describe('destroy', () => {
    it('removes cluster from DOM', () => {
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      expect(container.querySelector('[data-testid="nav-cluster"]')).not.toBeNull();
      ctrl.destroy();
      expect(container.querySelector('[data-testid="nav-cluster"]')).toBeNull();
    });

    it('does not throw when called twice', () => {
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      ctrl.destroy();
      expect(() => ctrl.destroy()).not.toThrow();
    });
  });
});
