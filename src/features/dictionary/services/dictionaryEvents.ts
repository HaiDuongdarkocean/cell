// dictionaryEvents — context-local dictionary-corpus change events.
//
// Mirrors wordStatusEvents: producers (resource mutations in this context,
// or the cross-tab relay forwarding DICTIONARY_CHANGED broadcasts) emit;
// token-metadata consumers (preloader, cue list) re-resolve readings and
// frequency bands when the corpus changes under them.

export type DictionaryChangedDetail = { langCode: string; reason: string };

const listeners = new Set<(detail: DictionaryChangedDetail) => void>();

export function onDictionaryChanged(listener: (detail: DictionaryChangedDetail) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function emitDictionaryChanged(detail: DictionaryChangedDetail): void {
  for (const listener of [...listeners]) listener(detail);
}

/** Subscribe like onDictionaryChanged but skip the re-resolve work while the
 *  document is hidden: DICTIONARY_CHANGED fans out to every open tab, and
 *  background tabs must not stampede the service worker for updates they do
 *  not display. The last event is held and flushed on visibilitychange. */
export function onDictionaryChangedVisible(
  listener: (detail: DictionaryChangedDetail) => void,
): () => void {
  if (typeof document === 'undefined') return onDictionaryChanged(listener);
  let pending: DictionaryChangedDetail | null = null;
  const flush = (): void => {
    if (pending === null || document.visibilityState !== 'visible') return;
    const detail = pending;
    pending = null;
    listener(detail);
  };
  const unsubscribe = onDictionaryChanged((detail) => {
    if (document.visibilityState === 'visible') {
      listener(detail);
      return;
    }
    pending = detail;
  });
  document.addEventListener('visibilitychange', flush);
  return () => {
    unsubscribe();
    document.removeEventListener('visibilitychange', flush);
  };
}
