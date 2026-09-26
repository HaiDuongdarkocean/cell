export { getWordStatuses, setWordStatus, listWordStatuses, cycleWordStatus, deleteWordStatus, normalizeLangCode, trashWordStatus, listWordTrash, restoreWordStatus, deleteWordTrash } from './services/wordStatusClient';
export { TRASH_TTL_MS } from './services/wordTrashStore';
export type { TrashedWordEntry } from './services/wordTrashStore';
export { getFrequencyEntries } from './services/frequencyClient';
export { subscribeResourceChanges, setResourceEnabled } from './services/resourceClient';
export { onWordStatusChanged, emitWordStatusChanged, onWordStatusRemoved, emitWordStatusRemoved } from './services/wordStatusEvents';
export type { WordStatusChangedDetail } from './services/wordStatusEvents';
export { classifyLine, lineToCanonicalText } from './logic/normalize/rules';
export { buildPhraseIndexForResource } from './logic/phraseIndexBuilder';
