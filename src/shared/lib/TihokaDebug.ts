declare const __Tihoka_DEBUG__: string | undefined;

export function isTihokaDebug(): boolean {
  return typeof __Tihoka_DEBUG__ !== 'undefined' && __Tihoka_DEBUG__ === 'true';
}
