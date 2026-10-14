// m.youtube.com — fixed sticky player; inherits global flows (rotate, sanity).
// Usage: node script/run.mjs youtube [rotate|sanity|--list] [--url u]
export const match = 'youtube.com/watch';
export const url = 'https://m.youtube.com/watch?v=lY2yjAdbvdQ';
export const settleMs = 5000;

export const steps = {};
export const flows = {};
