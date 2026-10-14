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
  // Regression gate: the spamRotate cycle repeated 3× with HARD assertions
  // after every burst — body-top fallback, collapsed wrapper height, and
  // orphaned sheet panels all fail the run. m.youtube collapses
  // .player-placeholder to 0x0 once the shell is inside the stage, so each
  // reopen depends on the remembered keeper; three rounds prove it holds.
  spamVerify: [
    'open',
    'waitOverlay',
    ['emulateDims', LANDSCAPE],
    ['settle', 1200],
    'ensureSplit',
    // round 1
    ['emulateDims', PORTRAIT], ['settle', 800],
    ['spamToggles', 4, 220], 'ensureSplit',
    ['assertSplit', 'open', 'r1-portrait'],
    ['emulateDims', LANDSCAPE], ['settle', 800],
    ['spamToggles', 4, 220], 'ensureSplit',
    ['assertSplit', 'open', 'r1-landscape'],
    // round 2
    ['emulateDims', PORTRAIT], ['settle', 800],
    ['spamToggles', 4, 220], 'ensureSplit',
    ['assertSplit', 'open', 'r2-portrait'],
    ['emulateDims', LANDSCAPE], ['settle', 800],
    ['spamToggles', 4, 220], 'ensureSplit',
    ['assertSplit', 'open', 'r2-landscape'],
    // round 3
    ['emulateDims', PORTRAIT], ['settle', 800],
    ['spamToggles', 4, 220], 'ensureSplit',
    ['assertSplit', 'open', 'r3-portrait'],
    ['emulateDims', LANDSCAPE], ['settle', 800],
    ['spamToggles', 4, 220], 'ensureSplit',
    ['assertSplit', 'open', 'r3-landscape'],
    ['capture', 'verify-final'],
    // close once more — nothing may survive in the DOM
    'toggleSplitView', ['settle', 900],
    ['assertSplit', 'closed', 'final-closed'],
  ],
};
