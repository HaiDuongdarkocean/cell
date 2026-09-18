declare const __CELL_DEBUG__: string | undefined;

export function isCellDebug(): boolean {
  return typeof __CELL_DEBUG__ !== 'undefined' && __CELL_DEBUG__ === 'true';
}
