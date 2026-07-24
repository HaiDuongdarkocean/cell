// Nav cluster SVG icons — sourced from ICON_CATALOG (ADR-018, design-system icon set).
// ponytail: pure string map, no side effects. SVGs use currentColor for stroke
// so they inherit button color (theme-aware: dark/light + active state).
// aria-hidden="true" per design-system rule (decorative icons, button has aria-label).
//
// The nav-cluster-icon class + display/fill style are injected via `navIcon()` because
// CSS (.nav-cluster-btn .nav-cluster-icon in navClusterCss.ts) and tests
// (navClusterButton.test.ts) select on that class. Registry .svg files don't carry it.

import { ICON_CATALOG } from '@/shared/icons';

/** Inject nav-cluster-icon class + display/fill style into a registry SVG string. */
function navIcon(svg: string): string {
  return svg.replace(
    '<svg ',
    '<svg class="nav-cluster-icon" focusable="false" style="display:block;fill:none !important" ',
  );
}

/** Inline SVG markup for each cluster button icon. currentColor stroke, 24x24 viewBox. */
export const NAV_CLUSTER_ICONS: Record<NavClusterIconName, string> = {
  prev: navIcon(ICON_CATALOG.navPrev.svg),
  next: navIcon(ICON_CATALOG.navNext.svg),
  repeat: navIcon(ICON_CATALOG.navRepeat.svg),
  repeatA: navIcon(ICON_CATALOG.navRepeatA.svg),
  repeatB: navIcon(ICON_CATALOG.navRepeatB.svg),
  repeatCancel: navIcon(ICON_CATALOG.navRepeatCancel.svg),
  rewind: navIcon(ICON_CATALOG.navRewind.svg),
  forward: navIcon(ICON_CATALOG.navForward.svg),
  play: navIcon(ICON_CATALOG.play.svg),
  pause: navIcon(ICON_CATALOG.pause.svg),
};

/** Icon names that have SVG markup. */
export type NavClusterIconName = 'prev' | 'next' | 'repeat' | 'repeatA' | 'repeatB' | 'repeatCancel' | 'rewind' | 'forward' | 'play' | 'pause';
