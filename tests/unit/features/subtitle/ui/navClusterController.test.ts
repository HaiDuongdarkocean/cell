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

    it('grip tab has aria-grabbed=false by default (ADR-018 D5-rev)', () => {
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      const grip = container.querySelector('[data-testid="nav-cluster-grip"]') as HTMLElement;
      expect(grip).not.toBeNull();
      expect(grip.getAttribute('aria-grabbed')).toBe('false');
      expect(grip.getAttribute('role')).toBe('button');
      expect(grip.getAttribute('aria-label')).toBe('Kéo để di chuyển cluster');
      expect(grip.getAttribute('tabindex')).toBe('0');
      ctrl.destroy();
    });

    it('drag on grip tab starts drag (ADR-018 D5-rev — grip is the handle)', () => {
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      const grip = container.querySelector('[data-testid="nav-cluster-grip"]') as HTMLElement;
      grip.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      expect(grip.getAttribute('aria-grabbed')).toBe('true');
      const cluster = container.querySelector('[data-testid="nav-cluster"]') as HTMLElement;
      expect(cluster.classList.contains('dragging')).toBe(true);
      ctrl.destroy();
    });

    it('drag on cluster body (not grip) is skipped (ADR-018 D5-rev — body is not a handle)', () => {
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      const cluster = container.querySelector('[data-testid="nav-cluster"]') as HTMLElement;
      // pointerdown directly on cluster (not on grip child) → no drag
      cluster.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      const grip = container.querySelector('[data-testid="nav-cluster-grip"]') as HTMLElement;
      expect(grip.getAttribute('aria-grabbed')).toBe('false');
      expect(cluster.classList.contains('dragging')).toBe(false);
      ctrl.destroy();
    });

    it('drag on action button is skipped (ADR-015 skip sub-elements)', () => {
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      const prevBtn = container.querySelector('[data-testid="nav-cluster-prev"]') as HTMLButtonElement;
      prevBtn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      const grip = container.querySelector('[data-testid="nav-cluster-grip"]') as HTMLElement;
      expect(grip.getAttribute('aria-grabbed')).toBe('false');
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
      const grip = container.querySelector('[data-testid="nav-cluster-grip"]') as HTMLElement;
      expect(grip.getAttribute('aria-grabbed')).toBe('false');
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
      // Position should NOT reset to default (4, 75)
      expect(cluster.style.left).toBe('50%');
      expect(cluster.style.top).toBe('50%');
      ctrl.destroy();
    });

    it('double-click on grip tab resets position to default (ADR-018 D5-rev)', () => {
      const customPos = { x: 50, y: 50 };
      const ctrl = new NavClusterController(video, container, { ...DEFAULT_NAV_CLUSTER_SETTINGS, position: customPos }, { targetCues: CUES, nativeCues: [] });
      ctrl.init();
      ctrl.updateCues(CUES, []);
      const grip = container.querySelector('[data-testid="nav-cluster-grip"]') as HTMLElement;
      grip.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      const cluster = container.querySelector('[data-testid="nav-cluster"]') as HTMLElement;
      expect(cluster.style.left).toBe('4%');
      expect(cluster.style.top).toBe('75%');
      ctrl.destroy();
    });

    it('double-click on cluster body (not grip) does NOT reset (ADR-018 D5-rev)', () => {
      const customPos = { x: 50, y: 50 };
      const ctrl = new NavClusterController(video, container, { ...DEFAULT_NAV_CLUSTER_SETTINGS, position: customPos }, { targetCues: CUES, nativeCues: [] });
      ctrl.init();
      ctrl.updateCues(CUES, []);
      const cluster = container.querySelector('[data-testid="nav-cluster"]') as HTMLElement;
      cluster.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      expect(cluster.style.left).toBe('50%');
      expect(cluster.style.top).toBe('50%');
      ctrl.destroy();
    });

    it('collapsed cluster: drag on cluster circle starts drag (no buttons inside)', () => {
      const ctrl = new NavClusterController(video, container, { ...DEFAULT_NAV_CLUSTER_SETTINGS, collapsed: true }, { targetCues: CUES, nativeCues: [] });
      ctrl.init();
      const cluster = container.querySelector('[data-testid="nav-cluster"]') as HTMLElement;
      expect(cluster.classList.contains('collapsed')).toBe(true);
      cluster.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      // collapsed → cluster itself is the handle → aria-grabbed on cluster
      expect(cluster.getAttribute('aria-grabbed')).toBe('true');
      expect(cluster.classList.contains('dragging')).toBe(true);
      ctrl.destroy();
    });

    it('collapsed cluster: grip tab hidden via CSS class (verified in browser, not jsdom)', () => {
      const ctrl = new NavClusterController(video, container, { ...DEFAULT_NAV_CLUSTER_SETTINGS, collapsed: true }, { targetCues: CUES, nativeCues: [] });
      ctrl.init();
      const grip = container.querySelector('[data-testid="nav-cluster-grip"]') as HTMLElement;
      // Grip element exists in DOM; CSS (.nav-cluster.collapsed .nav-cluster-grip
      // { display: none }) hides it. jsdom doesn't load CSS → verify via class
      // on cluster (collapsed) which is the CSS hook. Visual hide verified in
      // browser test (mockup + Edge MCP).
      expect(grip).not.toBeNull();
      const cluster = container.querySelector('[data-testid="nav-cluster"]') as HTMLElement;
      expect(cluster.classList.contains('collapsed')).toBe(true);
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

    it('updates appearance CSS variables when buttonSize/bgOpacity/buttonOpacity change', () => {
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      ctrl.updateSettings({ buttonSize: 56, bgOpacity: 0.3, buttonOpacity: 0.5 });
      const cluster = container.querySelector('[data-testid="nav-cluster"]') as HTMLElement;
      expect(cluster.style.getPropertyValue('--nav-cluster-btn-size')).toBe('56px');
      expect(cluster.style.getPropertyValue('--nav-cluster-bg-opacity')).toBe('0.3');
      expect(cluster.style.getPropertyValue('--nav-cluster-btn-opacity')).toBe('0.5');
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

  describe('offset provider (ADR-019 sync — nav seeks so overlay DISPLAYS target cue)', () => {
    // 3 cues so prev/next have room and seek targets stay non-negative with offset.
    const CUES3: SrtCue[] = [
      { index: 1, start: 0, end: 2000, text: 'A' },
      { index: 2, start: 3000, end: 5000, text: 'B' },
      { index: 3, start: 6000, end: 8000, text: 'C' },
    ];

    it('prev seeks to (prevCue.start - offsetMs) so overlay displays the previous cue', () => {
      // Video at 4s (raw in 'B'), offset +3000ms → effective 7000ms → 'C' (index 2).
      // prev → cues[1] 'B'. Seek target = (B.start - offset) / 1000 = (3000-3000)/1000 = 0s.
      // After seek at 0s, effective = 3000 → overlay shows 'B' (the previous displayed cue). ✓
      // BUG (old fix): seek to B.start/1000 = 3s → effective 6000 → overlay shows 'C' (forward!). 
      video.currentTime = 4;
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: CUES3, nativeCues: [] });
      ctrl.init();
      ctrl.updateCues(CUES3, []);
      ctrl.setOffsetProvider(() => 3000);
      const prevBtn = container.querySelector('[data-testid="nav-cluster-prev"]') as HTMLButtonElement;
      prevBtn.click();
      expect(video.currentTime).toBe(0); // (3000 - 3000) / 1000
      ctrl.destroy();
    });

    it('next seeks to (nextCue.start - offsetMs) so overlay displays the next cue', () => {
      // Video at 1s (raw in 'A'), offset +3000ms → effective 4000ms → 'B' (index 1).
      // next → cues[2] 'C'. Seek target = (C.start - offset) / 1000 = (6000-3000)/1000 = 3s.
      // After seek at 3s, effective = 6000 → overlay shows 'C' (the next displayed cue). ✓
      video.currentTime = 1;
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: CUES3, nativeCues: [] });
      ctrl.init();
      ctrl.updateCues(CUES3, []);
      ctrl.setOffsetProvider(() => 3000);
      const nextBtn = container.querySelector('[data-testid="nav-cluster-next"]') as HTMLButtonElement;
      nextBtn.click();
      expect(video.currentTime).toBe(3); // (6000 - 3000) / 1000
      ctrl.destroy();
    });

    it('default offset provider returns 0 — seek target = cue.start/1000 (backward compat)', () => {
      // No setOffsetProvider → default () => 0. prev → cues[0].start/1000 = 0s.
      video.currentTime = 4;
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: CUES3, nativeCues: [] });
      ctrl.init();
      ctrl.updateCues(CUES3, []);
      const prevBtn = container.querySelector('[data-testid="nav-cluster-prev"]') as HTMLButtonElement;
      prevBtn.click();
      expect(video.currentTime).toBe(0); // (0 - 0) / 1000
      ctrl.destroy();
    });
  });

  describe('repeat — no-sub 3-state cycle (A / B / cancel)', () => {
    it('click 1 → Repeat A (record start), click 2 → Repeat B (record end + loop), click 3 → Repeat cancel', () => {
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      const repeatBtn = container.querySelector('[data-testid="nav-cluster-repeat"]') as HTMLButtonElement;

      // Click 1: record start at 2.0
      video.currentTime = 2.0;
      repeatBtn.click();
      expect(repeatBtn.getAttribute('aria-label')).toBe('Repeat B');
      expect(repeatBtn.getAttribute('aria-pressed')).toBe('false');

      // Click 2: record end at 4.0, start looping
      video.currentTime = 4.0;
      repeatBtn.click();
      expect(repeatBtn.getAttribute('aria-label')).toBe('Repeat cancel');
      expect(repeatBtn.getAttribute('aria-pressed')).toBe('true');

      // Simulate timeupdate reaching end → seek back to start
      video.currentTime = 4.1;
      video.dispatchEvent(new Event('timeupdate'));
      expect(video.currentTime).toBe(2.0);

      // Click 3: cancel loop
      repeatBtn.click();
      expect(repeatBtn.getAttribute('aria-label')).toBe('Repeat A');
      expect(repeatBtn.getAttribute('aria-pressed')).toBe('false');
      ctrl.destroy();
    });

    it('no-sub start==end clamps end to start+0.1s', () => {
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

    it('no-sub no loop after cancel', () => {
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

  describe('repeat — has-sub cue-based behavior', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('quick click repeat seeks to current cue start', () => {
      video.currentTime = 3.5; // in cue 1 (3000-5000)
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: CUES, nativeCues: [] });
      ctrl.init();
      ctrl.updateCues(CUES, []);
      const repeatBtn = container.querySelector('[data-testid="nav-cluster-repeat"]') as HTMLButtonElement;
      repeatBtn.click();
      expect(video.currentTime).toBe(3); // seek to cue start
      expect(repeatBtn.getAttribute('aria-label')).toBe('Repeat current sentence');
      ctrl.destroy();
    });

    it('hold ≥500ms loops current cue (no one-shot on release)', () => {
      video.currentTime = 3.5; // in cue 1 (3000-5000)
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: CUES, nativeCues: [] });
      ctrl.init();
      ctrl.updateCues(CUES, []);
      const repeatBtn = container.querySelector('[data-testid="nav-cluster-repeat"]') as HTMLButtonElement;
      repeatBtn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
      jest.advanceTimersByTime(600);
      video.currentTime = 5.1;
      video.dispatchEvent(new Event('timeupdate'));
      expect(video.currentTime).toBe(3); // loop back
      video.currentTime = 4.2;
      repeatBtn.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
      expect(video.currentTime).toBe(4.2); // no one-shot on release
      expect(repeatBtn.getAttribute('aria-pressed')).toBe('false');
      ctrl.destroy();
    });

    it('click repeat in gap seeks to nearest cue', () => {
      video.currentTime = 2.2;
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: CUES, nativeCues: [] });
      ctrl.init();
      ctrl.updateCues(CUES, []);
      const repeatBtn = container.querySelector('[data-testid="nav-cluster-repeat"]') as HTMLButtonElement;
      repeatBtn.click();
      expect(video.currentTime).toBe(0); // cue[0] nearest
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

  describe('theme sync (ADR-024)', () => {
    it('sets cluster data-theme to match container on init', () => {
      container.setAttribute('data-theme', 'dark');
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      const cluster = container.querySelector('[data-testid="nav-cluster"]') as HTMLElement;
      expect(cluster.getAttribute('data-theme')).toBe('dark');
      ctrl.destroy();
    });

    it('defaults cluster data-theme to dark when container has no data-theme', () => {
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      const cluster = container.querySelector('[data-testid="nav-cluster"]') as HTMLElement;
      expect(cluster.getAttribute('data-theme')).toBe('dark');
      ctrl.destroy();
    });

    it('syncs cluster data-theme when container changes', async () => {
      container.setAttribute('data-theme', 'dark');
      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      const cluster = container.querySelector('[data-testid="nav-cluster"]') as HTMLElement;
      expect(cluster.getAttribute('data-theme')).toBe('dark');

      container.setAttribute('data-theme', 'light');
      await new Promise<void>((r) => setTimeout(r, 0));
      expect(cluster.getAttribute('data-theme')).toBe('light');
      ctrl.destroy();
    });

    it('preserves cluster data-theme after fullscreen re-parent', async () => {
      // Simulate fullscreen where document.fullscreenElement is the <html> element.
      container.setAttribute('data-theme', 'dark');
      Object.defineProperty(document, 'fullscreenElement', {
        value: document.documentElement,
        writable: true,
        configurable: true,
      });

      const ctrl = new NavClusterController(video, container, DEFAULT_NAV_CLUSTER_SETTINGS, { targetCues: [], nativeCues: [] });
      ctrl.init();
      const cluster = container.querySelector('[data-testid="nav-cluster"]') as HTMLElement;
      expect(cluster.getAttribute('data-theme')).toBe('dark');

      document.dispatchEvent(new Event('fullscreenchange'));
      await new Promise<void>((r) => setTimeout(r, 0));

      expect(cluster.parentElement).toBe(document.documentElement);
      expect(cluster.getAttribute('data-theme')).toBe('dark');

      ctrl.destroy();
      // Restore the getter so other tests are not affected.
      Object.defineProperty(document, 'fullscreenElement', {
        value: undefined,
        writable: false,
        configurable: false,
      });
    });
  });
});
