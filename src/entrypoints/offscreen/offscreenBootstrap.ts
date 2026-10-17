const done = new Set<string>();

export function runOffscreenBootstrapOnce(key: string, start: () => void): void {
  if (done.has(key)) return;
  if (typeof process !== 'undefined' && process.env?.JEST_WORKER_ID) return;
  done.add(key);
  start();
}
