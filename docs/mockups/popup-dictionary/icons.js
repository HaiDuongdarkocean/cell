/* ============================================================
   icons.js — SVG icon sprite (neutral names, no third-party)
   Use: ${ICONS.audio} in template strings, or iconEl('audio')
   ============================================================ */

const SVG_PATHS = {
  // audio: waveform / equalizer (matches MediaList audio thumb in src/features/cardCreator/ui/MediaList.tsx)
  audio: '<path d="M3 10v4"/><path d="M7 6v12"/><path d="M11 3v18"/><path d="M15 8v8"/><path d="M19 11v2"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  translate: '<path d="M4 5h7"/><path d="M9 3v2c0 4.418-2.239 8-5 8"/><path d="M5 9c-.003 2.144 2.952 3.908 6.5 4"/><path d="M12 20l4-9 4 9"/><path d="M19.1 18h-6.2"/>',
  links: '<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/>',
  card: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/>',
  // quickAdd: lightning bolt (instant add — quick action)
  // Cell style: stroke 1.5, round caps, classic bolt shape
  quickAdd: '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
  // sendToCreator: paper plane (send content to creator workspace)
  // Cell style: stroke 1.5, round caps, classic paper plane
  sendToCreator: '<path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2z"/>',
  // nonePanel: eye-slash (hide all panels, show only definitions)
  // Cell style: stroke 1.5, round caps
  nonePanel: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/><path d="M2 2l20 20"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  close: '<path d="M18 6L6 18"/><path d="M6 6l12 12"/>',
  play: '<polygon points="5 3 19 12 5 21 5 3"/>',
  pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>',
  external: '<path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/>',
  resize: '<polyline points="22 17 22 22 17 22"/><polyline points="2 7 2 2 7 2"/><line x1="22" y1="2" x2="14" y2="10"/><line x1="2" y1="22" x2="10" y2="14"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  edit: '<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  // chevronDown: dropdown trigger indicator (YouTube-style)
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
};

/** Build an SVG icon element. */
export function iconEl(name, size = 20) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.style.width = `${size}px`;
  svg.style.height = `${size}px`;
  svg.innerHTML = SVG_PATHS[name] || '';
  return svg;
}

/** Build an icon button (icon-btn class). */
export function iconBtn(name, label, size = 20) {
  const btn = document.createElement('button');
  btn.className = 'icon-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', label);
  btn.setAttribute('title', label);
  btn.appendChild(iconEl(name, size));
  return btn;
}

/** Inline SVG string for template literals. */
export function iconStr(name, size = 20) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" width="${size}" height="${size}">${SVG_PATHS[name] || ''}</svg>`;
}

export const ICONS = SVG_PATHS;
