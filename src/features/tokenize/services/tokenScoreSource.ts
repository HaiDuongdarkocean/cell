import { onWordStatusChanged, type WordStatusChangedDetail } from '@/features/dictionary';
import { createScoreTracker, isScorableToken, type ScoreTracker } from '@/features/tokenize/logic/comprehensionScore';
import { fetchTermStatuses } from './scoreStatusFetch';
import type { ComprehensionStore } from './comprehensionStore';
import type { ComprehensionKind } from '@/entities/comprehension';
import type { Token } from '@/features/tokenize/types';
import type { WordStatus } from '@/entities/dictionary';
import { baseLangCode, languageMatches } from '@/shared/config/languageRegistry';

const DEBOUNCE_MS = 400;
const MAX_DELAY_MS = 1500;

export interface TokenScoreSourceDeps<S> {
  kind: ComprehensionKind;
  langCode: string;
  store: ComprehensionStore;
  getSource: () => S;
  signature: (source: S) => string;
  tokenize: (source: S, langCode: string) => readonly Token[];
  subscribeChanges: (listener: () => void) => () => void;
}

export function startTokenScoreSource<S>(deps: TokenScoreSourceDeps<S>): () => void {
  const lang = baseLangCode(deps.langCode);
  const { kind, store } = deps;

  if (languageMatches('zh', lang)) {
    store.setStats(kind, null);
    return () => {};
  }

  let tracker: ScoreTracker | null = null;
  let lastKey = '';
  let buffered: WordStatusChangedDetail[] = [];
  let resolving = false;
  let generation = 0;
  let warned = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let firstTriggerAt: number | null = null;

  async function rebuild(): Promise<void> {
    const gen = ++generation;
    const source = deps.getSource();
    if (!deps.signature(source)) {
      resolving = false;
      tracker = null;
      store.setStats(kind, null);
      return;
    }
    const tokens = deps.tokenize(source, lang);
    resolving = true;
    buffered = [];
    let statuses: Map<string, WordStatus>;
    try {
      statuses = await fetchTermStatuses(
        lang,
        tokens.filter(isScorableToken).map((t) => t.term),
      );
    } catch (err) {
      if (gen !== generation) return;
      resolving = false;
      tracker = null;
      store.setStats(kind, null);
      if (!warned) {
        warned = true;
        console.warn(`[comprehension] ${kind} score resolve failed`, err);
      }
      return;
    }
    if (gen !== generation) return;
    resolving = false;
    if (statuses.size === 0) {
      tracker = null;
      store.setStats(kind, null);
      return;
    }
    tracker = createScoreTracker(tokens, statuses, lang);
    for (const e of buffered) tracker.applyStatus(e.term, e.status);
    buffered = [];
    store.setStats(kind, tracker.stats(kind));
  }

  function schedule(): void {
    const key = deps.signature(deps.getSource());
    if (key === lastKey) return;
    lastKey = key;
    const now = Date.now();
    firstTriggerAt ??= now;
    const overdue = now - firstTriggerAt >= MAX_DELAY_MS;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (overdue) {
      firstTriggerAt = null;
      void rebuild();
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      firstTriggerAt = null;
      void rebuild();
    }, DEBOUNCE_MS);
  }

  const offStatus = onWordStatusChanged((e) => {
    if (!languageMatches(lang, e.langCode)) return;
    if (resolving) {
      buffered.push(e);
      return;
    }
    if (tracker?.applyStatus(e.term, e.status)) {
      store.setStats(kind, tracker.stats(kind));
    }
  });

  const offChanges = deps.subscribeChanges(schedule);
  schedule();

  return () => {
    generation++;
    resolving = false;
    if (timer) clearTimeout(timer);
    offChanges();
    offStatus();
    store.setStats(kind, null);
  };
}
