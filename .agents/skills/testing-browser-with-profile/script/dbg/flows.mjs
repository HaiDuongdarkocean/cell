// Global flows — named step sequences any site can run. A flow is a list of
// step names; an entry may carry args as [name, ...args]. run.mjs resolves
// each name site-first (sites/<slug>.mjs `steps`) then here (dbg/steps.mjs).

import { PORTRAIT, LANDSCAPE } from './emulate.mjs';

export const flows = {
  // Any page: open, settle, one geometry dump + screenshot.
  sanity: [
    'open',
    ['capture', '00-state'],
  ],
  // Video page: split view open in portrait → landscape → back.
  rotate: [
    'open',
    'waitOverlay',
    'ensureSplit',
    ['capture', '01-portrait', PORTRAIT],
    ['capture', '02-landscape', LANDSCAPE],
    ['capture', '03-back', PORTRAIT],
  ],
};
