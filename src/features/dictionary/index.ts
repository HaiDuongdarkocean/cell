export { getWordStatuses, setWordStatus, listWordStatuses, cycleWordStatus, deleteWordStatus, normalizeLangCode, trashWordStatus, listWordTrash, restoreWordStatus, deleteWordTrash } from './services/wordStatusClient';
export { TRASH_TTL_MS } from './services/wordTrashStore';
export type { TrashedWordEntry } from './services/wordTrashStore';
export { getFrequencyEntries } from './services/frequencyClient';
export { onWordStatusChanged, emitWordStatusChanged, onWordStatusRemoved, emitWordStatusRemoved } from './services/wordStatusEvents';
export type { WordStatusChangedDetail } from './services/wordStatusEvents';
