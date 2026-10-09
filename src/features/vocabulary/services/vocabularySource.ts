import {
  listWordStatuses,
  setWordStatus,
  setWordStatuses,
  trashWordStatus,
  trashWordStatuses,
  listWordTrash,
  restoreWordStatus,
  restoreWordStatuses,
  deleteWordTrash,
  normalizeLangCode,
  emitWordStatusChanged,
  emitWordStatusRemoved,
  emitWordStatusesReload,
  onWordStatusChanged,
  onWordStatusRemoved,
  onWordStatusesReload,
  type TrashedWordEntry,
} from '@/features/dictionary';
import { getCardSourceTerms } from '@/features/ankiStatusSync';
import {
  nextMarkedStatus,
  upsertEntry,
  removeEntry,
  type VocabularyEntry,
} from '../logic/vocabularyList';
import type { WordStatus } from '@/entities/dictionary';

type SourceEvent =
  | { kind: 'changed'; term: string; status: WordStatus }
  | { kind: 'removed'; term: string };

export interface CardSources {
  readonly anki: ReadonlySet<string>;
  readonly srs: ReadonlySet<string>;
}

const EMPTY_CARD_SOURCES: CardSources = { anki: new Set(), srs: new Set() };

export interface VocabularySourceState {
  readonly entries: readonly VocabularyEntry[];
  readonly trash: readonly TrashedWordEntry[];
  readonly cardSources: CardSources;
  readonly loaded: boolean;
}

export interface VocabularySource {
  readonly getState: () => VocabularySourceState;
  readonly subscribe: (listener: (state: VocabularySourceState) => void) => () => void;
  readonly cycle: (term: string) => Promise<void>;
  readonly trash: (term: string) => Promise<void>;
  readonly restore: (term: string) => Promise<void>;
  readonly deleteTrash: (term: string) => Promise<void>;
  readonly setStatusMany: (terms: readonly string[], status: WordStatus) => Promise<void>;
  readonly trashMany: (terms: readonly string[]) => Promise<void>;
  readonly restoreMany: (terms: readonly string[]) => Promise<void>;
  readonly refreshTrash: () => Promise<void>;
  readonly refreshCardSources: () => Promise<void>;
  readonly refresh: () => Promise<void>;
  readonly destroy: () => void;
}

export function createVocabularySource(langCode: string): VocabularySource {
  const lang = normalizeLangCode(langCode);
  let state: VocabularySourceState = { entries: [], trash: [], cardSources: EMPTY_CARD_SOURCES, loaded: false };
  let buffer: SourceEvent[] | null = [];
  let destroyed = false;
  const listeners = new Set<(state: VocabularySourceState) => void>();

  function notify(): void {
    for (const listener of listeners) listener(state);
  }

  function apply(event: SourceEvent): void {
    if (event.kind === 'changed' && event.status !== 'unknown') {
      state = {
        ...state,
        entries: upsertEntry(state.entries, event.term, event.status, Date.now()),
        trash: state.trash.filter((e) => e.term !== event.term),
      };
    } else {
      state = { ...state, entries: removeEntry(state.entries, event.term) };
    }
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
  const unsubReload = onWordStatusesReload((eventLang) => {
    if (!destroyed && normalizeLangCode(eventLang) === lang) void load();
  });

  async function load(): Promise<void> {
    const [entries, trash, cardSources] = await Promise.all([
      listWordStatuses(lang),
      listWordTrash(lang),
      loadCardSources(),
    ]);
    if (destroyed) return;
    const pending = buffer ?? [];
    buffer = null;
    let next: VocabularyEntry[] = entries.map((e) => ({ ...e }));
    let nextTrash: TrashedWordEntry[] = [...trash];
    for (const event of pending) {
      if (event.kind === 'changed' && event.status !== 'unknown') {
        next = upsertEntry(next, event.term, event.status, Date.now());
        nextTrash = nextTrash.filter((e) => e.term !== event.term);
      } else {
        next = removeEntry(next, event.term);
      }
    }
    state = { entries: next, trash: nextTrash, cardSources, loaded: true };
    notify();
  }

  async function refreshTrash(): Promise<void> {
    const trash = await listWordTrash(lang);
    if (destroyed) return;
    state = { ...state, trash };
    notify();
  }

  async function loadCardSources(): Promise<CardSources> {
    try {
      const terms = await getCardSourceTerms(lang);
      return { anki: new Set(terms.anki), srs: new Set(terms.srs) };
    } catch {
      return EMPTY_CARD_SOURCES;
    }
  }

  async function refreshCardSources(): Promise<void> {
    const cardSources = await loadCardSources();
    if (destroyed) return;
    state = { ...state, cardSources };
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
      const entry = state.entries.find((e) => e.term === term);
      const status = entry ? nextMarkedStatus(entry.status) : 'tracking';
      await setWordStatus(lang, term, status);
      emitWordStatusChanged({ langCode: lang, term, status });
    },
    async trash(term) {
      await trashWordStatus(lang, term);
      emitWordStatusRemoved({ langCode: lang, term });
      await refreshTrash();
    },
    async restore(term) {
      const status = await restoreWordStatus(lang, term);
      emitWordStatusChanged({ langCode: lang, term, status });
      await refreshTrash();
    },
    async deleteTrash(term) {
      await deleteWordTrash(lang, term);
      if (destroyed) return;
      state = { ...state, trash: state.trash.filter((e) => e.term !== term) };
      notify();
    },
    async setStatusMany(terms, status) {
      await setWordStatuses(lang, terms, status);
      emitWordStatusesReload(lang);
    },
    async trashMany(terms) {
      await trashWordStatuses(lang, terms);
      emitWordStatusesReload(lang);
      await refreshTrash();
    },
    async restoreMany(terms) {
      await restoreWordStatuses(lang, terms);
      emitWordStatusesReload(lang);
      await refreshTrash();
    },
    refreshTrash,
    refreshCardSources,
    refresh: load,
    destroy() {
      destroyed = true;
      unsubChanged();
      unsubRemoved();
      unsubReload();
      listeners.clear();
    },
  };
}
