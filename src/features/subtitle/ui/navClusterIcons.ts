// Nav cluster SVG icons — inline SVG strings (ADR-018, design-system icon set).
// ponytail: pure string map, no side effects. SVGs use currentColor for stroke
// so they inherit button color (theme-aware: dark/light + active state).
// Source: docs/mockups/icon-svg/ (svgrepo), stripped XML header + recolored.
// aria-hidden="true" per design-system rule (decorative icons, button has aria-label).

/** Inline SVG markup for each cluster button icon. currentColor stroke, 24x24 viewBox. */
export const NAV_CLUSTER_ICONS: Record<NavClusterIconName, string> = {
  // prev sentence — round-alt-arrow-left (circle + chevron left)
  prev: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" class="nav-cluster-icon"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M13.5 9L10.5 12L13.5 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  // next sentence — round-alt-arrow-right (circle + chevron right)
  next: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" class="nav-cluster-icon"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.5 9L13.5 12L10.5 15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  // repeat — restart (loop arrow). Use a thin circular arrow matching the
  // rewind/forward icon stroke weight (1.5) so the icon stays crisp at all sizes.
  repeat: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" class="nav-cluster-icon"><path d="M14 4.5L12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 7.89936 4.46819 4.3752 8 2.83209" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  // repeat A — no-sub loop recorder: set loop start. Thin circular arrow + A.
  repeatA: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" class="nav-cluster-icon"><path d="M14 4.5L12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 7.89936 4.46819 4.3752 8 2.83209" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><text x="12" y="15.5" text-anchor="middle" fill="currentColor" font-size="7" font-family="system-ui, -apple-system, sans-serif" font-weight="600">A</text></svg>',
  // repeat B — no-sub loop recorder: set loop end. Thin circular arrow + B.
  repeatB: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" class="nav-cluster-icon"><path d="M14 4.5L12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 7.89936 4.46819 4.3752 8 2.83209" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><text x="12" y="15.5" text-anchor="middle" fill="currentColor" font-size="7" font-family="system-ui, -apple-system, sans-serif" font-weight="600">B</text></svg>',
  // repeat cancel — no-sub loop recorder: stop loop. Thin circular arrow + X centered.
  repeatCancel: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" class="nav-cluster-icon"><path d="M14 4.5L12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 7.89936 4.46819 4.3752 8 2.83209" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  // rewind 5s — rewind-5-seconds-back (arc + "5")
  rewind: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" class="nav-cluster-icon"><path d="M14 4.5L12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 7.89936 4.46819 4.3752 8 2.83209" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 8.5H11.3604C11.1452 8.5 10.9541 8.63772 10.886 8.84189L10.2194 10.8419C10.1114 11.1657 10.3524 11.5 10.6937 11.5H12C13.1046 11.5 14 12.3954 14 13.5C14 14.6046 13.1046 15.5 12 15.5H10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  // forward 10s — rewind-10-seconds-forward (arc + "10")
  forward: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" class="nav-cluster-icon"><path d="M10 4.5L12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 7.89936 19.5318 4.3752 16 2.83209" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.5 10.5L10 8.5V15.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.5 13.75V10.25C12.5 9.2835 13.2835 8.5 14.25 8.5C15.2165 8.5 16 9.2835 16 10.25V13.75C16 14.7165 15.2165 15.5 14.25 15.5C13.2835 15.5 12.5 14.7165 12.5 13.75Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
};

/** Icon names that have SVG markup. */
export type NavClusterIconName = 'prev' | 'next' | 'repeat' | 'repeatA' | 'repeatB' | 'repeatCancel' | 'rewind' | 'forward';
