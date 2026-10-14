// en.wikipedia.org — non-video control page: no player, no overlay.
// `rotate` will fail at waitOverlay by design; run `sanity`.
// Usage: node script/run.mjs wikipedia [sanity|--list] [--url u]
export const match = 'wikipedia.org';
export const url = 'https://en.wikipedia.org/wiki/Hello,_world';
export const settleMs = 3000;

export const steps = {};
export const flows = {};
