import { describe, it, expect } from '@jest/globals';
import { buildClusterDOM, clampPosition, findNearestEdge } from '@/features/subtitle/ui/navClusterDom';
import type { NavClusterPosition } from '@/entities/settings';

describe('navClusterDom — pure helpers (ADR-018 D1, frontend design)', () => {
  describe('buildClusterDOM', () => {
    it('returns cluster root with role=toolbar + aria-label + data-testid', () => {
      const dom = buildClusterDOM();
      expect(dom.cluster.getAttribute('role')).toBe('toolbar');
      expect(dom.cluster.getAttribute('aria-label')).toBe('Subtitle navigation');
      expect(dom.cluster.getAttribute('aria-orientation')).toBe('horizontal');
      expect(dom.cluster.getAttribute('data-testid')).toBe('nav-cluster');
    });

    it('creates main column with 3 buttons (prev/repeat/next)', () => {
      const dom = buildClusterDOM();
      expect(dom.cluster.querySelector('[data-testid="nav-cluster-main"]')).not.toBeNull();
      expect(dom.prevBtn.getAttribute('data-testid')).toBe('nav-cluster-prev');
      expect(dom.prevBtn.getAttribute('aria-label')).toBe('Previous sentence');
      expect(dom.repeatBtn.getAttribute('data-testid')).toBe('nav-cluster-repeat');
      expect(dom.repeatBtn.getAttribute('aria-label')).toBe('Repeat current sentence');
      expect(dom.repeatBtn.getAttribute('aria-pressed')).toBe('false');
      expect(dom.nextBtn.getAttribute('data-testid')).toBe('nav-cluster-next');
      expect(dom.nextBtn.getAttribute('aria-label')).toBe('Next sentence');
    });

    it('creates secondary column with 2 buttons (rewind/forward)', () => {
      const dom = buildClusterDOM();
      expect(dom.cluster.querySelector('[data-testid="nav-cluster-secondary"]')).not.toBeNull();
      expect(dom.rewindBtn.getAttribute('data-testid')).toBe('nav-cluster-rewind');
      expect(dom.rewindBtn.getAttribute('aria-label')).toBe('Rewind 5 seconds');
      expect(dom.forwardBtn.getAttribute('data-testid')).toBe('nav-cluster-forward');
      expect(dom.forwardBtn.getAttribute('aria-label')).toBe('Forward 10 seconds');
    });

    it('all buttons are HTMLButtonElement', () => {
      const dom = buildClusterDOM();
      expect(dom.prevBtn.tagName).toBe('BUTTON');
      expect(dom.repeatBtn.tagName).toBe('BUTTON');
      expect(dom.nextBtn.tagName).toBe('BUTTON');
      expect(dom.rewindBtn.tagName).toBe('BUTTON');
      expect(dom.forwardBtn.tagName).toBe('BUTTON');
    });

    it('cluster has aria-grabbed=false (ADR-015 drag pattern)', () => {
      const dom = buildClusterDOM();
      expect(dom.cluster.getAttribute('aria-grabbed')).toBe('false');
    });

    it('creates grip tab drag handle (ADR-018 D5-rev — touch + mouse)', () => {
      const dom = buildClusterDOM();
      expect(dom.grip).toBeDefined();
      expect(dom.grip.getAttribute('data-testid')).toBe('nav-cluster-grip');
      expect(dom.grip.getAttribute('role')).toBe('button');
      expect(dom.grip.getAttribute('aria-label')).toBe('Kéo để di chuyển cluster');
      expect(dom.grip.getAttribute('aria-grabbed')).toBe('false');
      expect(dom.grip.getAttribute('tabindex')).toBe('0');
      expect(dom.grip.className).toBe('nav-cluster-grip');
      // Grip is first child of cluster (appended before columns)
      expect(dom.cluster.firstElementChild).toBe(dom.grip);
    });

    it('action buttons render inline SVG icons (not text glyphs)', () => {
      const dom = buildClusterDOM();
      expect(dom.prevBtn.querySelector('svg.nav-cluster-icon')).not.toBeNull();
      expect(dom.nextBtn.querySelector('svg.nav-cluster-icon')).not.toBeNull();
      expect(dom.repeatBtn.querySelector('svg.nav-cluster-icon')).not.toBeNull();
      expect(dom.rewindBtn.querySelector('svg.nav-cluster-icon')).not.toBeNull();
      expect(dom.forwardBtn.querySelector('svg.nav-cluster-icon')).not.toBeNull();
    });

    it('SVG icons are aria-hidden (decorative — button has aria-label)', () => {
      const dom = buildClusterDOM();
      const svgs = dom.cluster.querySelectorAll('svg.nav-cluster-icon');
      expect(svgs.length).toBe(5); // prev + next + repeat + rewind + forward
      Array.from(svgs).forEach((svg) => {
        expect(svg.getAttribute('aria-hidden')).toBe('true');
      });
    });
  });

  describe('clampPosition', () => {
    const containerRect = { width: 800, height: 600 } as DOMRect;
    const clusterRect = { width: 120, height: 160 } as DOMRect;

    it('clamps x > 100 to max valid center (100 - half clusterWidth%)', () => {
      const pos: NavClusterPosition = { x: 150, y: 50 };
      const result = clampPosition(pos, containerRect, clusterRect);
      // max x% = 100 - (120/800)*50 = 100 - 7.5 = 92.5
      expect(result.x).toBe(92.5);
      expect(result.y).toBe(50);
    });

    it('clamps y > 100 to max valid center (100 - half clusterHeight%)', () => {
      const pos: NavClusterPosition = { x: 50, y: 200 };
      const result = clampPosition(pos, containerRect, clusterRect);
      // max y% = 100 - (160/600)*50 = 100 - 13.33 = 86.67
      expect(result.y).toBeCloseTo(86.67, 1);
    });

    it('clamps x < 0 to half clusterWidth%', () => {
      const pos: NavClusterPosition = { x: -10, y: 50 };
      const result = clampPosition(pos, containerRect, clusterRect);
      // min x% = (120/800)*50 = 7.5
      expect(result.x).toBe(7.5);
    });

    it('clamps y < 0 to half clusterHeight%', () => {
      const pos: NavClusterPosition = { x: 50, y: -5 };
      const result = clampPosition(pos, containerRect, clusterRect);
      // min y% = (160/600)*50 = 13.33
      expect(result.y).toBeCloseTo(13.33, 1);
    });

    it('passes through valid position unchanged', () => {
      const pos: NavClusterPosition = { x: 40, y: 30 };
      const result = clampPosition(pos, containerRect, clusterRect);
      expect(result.x).toBe(40);
      expect(result.y).toBe(30);
    });

    it('returns a copy when container or cluster rect has zero size', () => {
      const pos: NavClusterPosition = { x: 40, y: 30 };
      expect(clampPosition(pos, { width: 0, height: 600 } as DOMRect, clusterRect)).toEqual(pos);
      expect(clampPosition(pos, containerRect, { width: 0, height: 0 } as DOMRect)).toEqual(pos);
    });
  });

  describe('findNearestEdge', () => {
    const containerRect = { width: 800, height: 600, left: 0, top: 0 } as DOMRect;

    it('returns left when x is near left edge', () => {
      const pos: NavClusterPosition = { x: 5, y: 50 };
      expect(findNearestEdge(pos, containerRect)).toBe('left');
    });

    it('returns right when x is near right edge', () => {
      const pos: NavClusterPosition = { x: 95, y: 50 };
      expect(findNearestEdge(pos, containerRect)).toBe('right');
    });

    it('returns left when x is in left half (default for middle)', () => {
      const pos: NavClusterPosition = { x: 40, y: 50 };
      expect(findNearestEdge(pos, containerRect)).toBe('left');
    });

    it('returns right when x is in right half', () => {
      const pos: NavClusterPosition = { x: 60, y: 50 };
      expect(findNearestEdge(pos, containerRect)).toBe('right');
    });

    it('returns left at x=50 boundary (left wins tie)', () => {
      const pos: NavClusterPosition = { x: 50, y: 50 };
      expect(findNearestEdge(pos, containerRect)).toBe('left');
    });
  });
});
