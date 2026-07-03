import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
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

  describe('repeat 3-state cycle', () => {
    it('click 1 records start, click 2 records end + loops, click 3 cancels', () => {
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      const repeatBtn = container.querySelector('[data-testid="nav-cluster-repeat"]') as HTMLButtonElement;

      // Click 1: record start at 2.0
      video.currentTime = 2.0;
      repeatBtn.click();
      expect(repeatBtn.getAttribute('aria-label')).toBe('Record loop end');
      expect(repeatBtn.getAttribute('aria-pressed')).toBe('false');

      // Click 2: record end at 4.0, start looping
      video.currentTime = 4.0;
      repeatBtn.click();
      expect(repeatBtn.getAttribute('aria-label')).toBe('Cancel loop');
      expect(repeatBtn.getAttribute('aria-pressed')).toBe('true');

      // Simulate timeupdate reaching end → seek back to start
      video.currentTime = 4.1;
      video.dispatchEvent(new Event('timeupdate'));
      expect(video.currentTime).toBe(2.0);

      // Click 3: cancel loop
      repeatBtn.click();
      expect(repeatBtn.getAttribute('aria-label')).toBe('Record loop start');
      expect(repeatBtn.getAttribute('aria-pressed')).toBe('false');
      ctrl.destroy();
    });

    it('3-state cycle: start==end clamps end to start+0.1s', () => {
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      const repeatBtn = container.querySelector('[data-testid="nav-cluster-repeat"]') as HTMLButtonElement;
      video.currentTime = 5.0;
      repeatBtn.click(); // start
      repeatBtn.click(); // end at same time → should clamp
      video.currentTime = 5.2;
      video.dispatchEvent(new Event('timeupdate'));
      expect(video.currentTime).toBe(5.0); // loops back to start
      ctrl.destroy();
    });

    it('3-state cycle: no loop after cancel', () => {
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      const repeatBtn = container.querySelector('[data-testid="nav-cluster-repeat"]') as HTMLButtonElement;
      video.currentTime = 1.0;
      repeatBtn.click(); // start
      video.currentTime = 3.0;
      repeatBtn.click(); // end + loop
      repeatBtn.click(); // cancel
      video.currentTime = 3.5;
      video.dispatchEvent(new Event('timeupdate'));
      expect(video.currentTime).toBe(3.5); // no loop
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
