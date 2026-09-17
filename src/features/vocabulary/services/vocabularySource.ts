import {
  listWordStatuses,
  cycleWordStatus,
  deleteWordStatus,
  normalizeLangCode,
  emitWordStatusChanged,
  emitWordStatusRemoved,
  onWordStatusChanged,
  onWordStatusRemoved,
} from '@/features/dictionary';
import {
  upsertEntry,
  removeEntry,
  type VocabularyEntry,
} from '../logic/vocabularyList';
import type { WordStatus } from '@/entities/dictionary';

type SourceEvent =
  | { kind: 'changed'; term: string; status: WordStatus }
  | { kind: 'removed'; term: string };

export interface VocabularySourceState {
  readonly entries: readonly VocabularyEntry[];
  readonly loaded: boolean;
}

export interface VocabularySource {
  readonly getState: () => VocabularySourceState;
  readonly subscribe: (listener: (state: VocabularySourceState) => void) => () => void;
  readonly cycle: (term: string) => Promise<void>;
  readonly remove: (term: string) => Promise<void>;
  readonly refresh: () => Promise<void>;
  readonly destroy: () => void;
}

export function createVocabularySource(langCode: string): VocabularySource {
  const lang = normalizeLangCode(langCode);
  let state: VocabularySourceState = { entries: [], loaded: false };
  let buffer: SourceEvent[] | null = [];
  let destroyed = false;
  const listeners = new Set<(state: VocabularySourceState) => void>();

  function notify(): void {
    for (const listener of listeners) listener(state);
  }

  function apply(event: SourceEvent): void {
    state = {
      ...state,
      entries: event.kind === 'changed'
        ? upsertEntry(state.entries, event.term, event.status, Date.now())
        : removeEntry(state.entries, event.term),
    };
    notify();
  }

  function onEvent(event: SourceEvent, eventLang: string): void {
    if (destroyed || normalizeLangCode(eventLang) !== lang) return;
    if (buffer) buffer.push(event);
    else apply(event);
  }

  const unsubChanged = onWordStatusChanged((d) =>
    onEvent({ kind: 'changed', term: d.term, status: d.status }, d.langCode));
  const unsubRemoved = onWordStatusRemoved((d) =>
    onEvent({ kind: 'removed', term: d.term }, d.langCode));

  async function load(): Promise<void> {
    const entries = await listWordStatuses(lang);
    if (destroyed) return;
    const pending = buffer ?? [];
    buffer = null;
    let next: VocabularyEntry[] = entries.map((e) => ({ ...e }));
    for (const event of pending) {
      next = event.kind === 'changed'
        ? upsertEntry(next, event.term, event.status, Date.now())
        : removeEntry(next, event.term);
    }
    state = { entries: next, loaded: true };
    notify();
  }

  void load();

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async cycle(term) {
      const status = await cycleWordStatus(lang, term);
      emitWordStatusChanged({ langCode: lang, term, status });
    },
    async remove(term) {
      await deleteWordStatus(lang, term);
      emitWordStatusRemoved({ langCode: lang, term });
    },
    refresh: load,
    destroy() {
      destroyed = true;
      unsubChanged();
      unsubRemoved();
      listeners.clear();
    },
  };
}
