// m.youtube.com — fixed sticky player; inherits global flows.
// Usage: node script/run.mjs youtube [sanity|rotate|spamRotate|spamVerify|all] [--url u]
// spamVerify = the split-view regression gate (rotate + spam t ×3, asserted).
export const match = 'youtube.com/watch';
export const url = 'https://m.youtube.com/watch?v=lY2yjAdbvdQ';
export const settleMs = 5000;

export const steps = {};
export const flows = {};
