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
  // Race repro: rotate + spam split-view toggles — catches transient slot
  // misses where the wrapper lands at the shell's DOM spot (body top)
  // instead of the flow slot keeper.
  spamRotate: [
    'open',
    'waitOverlay',
    ['emulateDims', LANDSCAPE],
    ['settle', 1200],
    'toggleSplitView',
    ['emulateDims', PORTRAIT],
    ['settle', 800],
    ['dump', 'spam-01-rotated-open'],
    'toggleSplitView',
    'toggleSplitView',
    ['dump', 'spam-02-reopened'],
    ['emulateDims', LANDSCAPE],
    ['settle', 800],
    'toggleSplitView',
    'toggleSplitView',
    ['dump', 'spam-03-final'],
    ['capture', 'spam-04-shot'],
  ],
};
