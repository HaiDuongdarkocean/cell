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
