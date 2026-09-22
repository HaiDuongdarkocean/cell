import { useEffect, useState, type ReactElement } from 'react';
import { VocabularyTab } from '@/features/vocabulary';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import {
  getAllWordStatuses,
  setWordStatus,
  cycleWordStatus,
  deleteWordStatus,
} from '@/features/dictionary/services/wordStatusStore';
import {
  trashWordStatus,
  listWordTrash,
  restoreWordStatus,
  deleteWordTrash,
  purgeExpiredTrash,
} from '@/features/dictionary/services/wordTrashStore';
import type { WordStatus } from '@/entities/dictionary';
import { SHOWCASE_DATA } from '../showcaseParams';
import styles from './VocabularyPanelPage.module.css';

const LANG = 'en';

const SEED_WORDS: readonly { term: string; status: WordStatus }[] = [
  { term: 'serendipity', status: 'tracking' },
  { term: 'ephemeral', status: 'tracking' },
  { term: 'ubiquitous', status: 'tracking' },
  { term: 'meticulous', status: 'tracking' },
  { term: 'ambiguous', status: 'tracking' },
  { term: 'resilient', status: 'tracking' },
  { term: 'pragmatic', status: 'tracking' },
  { term: 'nuance', status: 'tracking' },
  { term: 'hello', status: 'known' },
  { term: 'world', status: 'known' },
  { term: 'water', status: 'known' },
  { term: 'friend', status: 'known' },
  { term: 'house', status: 'known' },
  { term: 'book', status: 'known' },
  { term: 'computer', status: 'known' },
  { term: 'language', status: 'known' },
  { term: 'the', status: 'ignore' },
  { term: 'a', status: 'ignore' },
  { term: 'an', status: 'ignore' },
  { term: 'extraordinarily-long-compound-term-for-overflow-testing', status: 'tracking' },
];

const SEED_TRASH: readonly { term: string; previousStatus: WordStatus }[] = [
  { term: 'obsolete', previousStatus: 'tracking' },
  { term: 'archaic', previousStatus: 'known' },
  { term: 'outdated', previousStatus: 'tracking' },
];

interface WordStatusPayload {
  readonly langCode?: string;
  readonly term?: string;
  readonly terms?: readonly string[];
  readonly status?: WordStatus;
}

async function handleWordStatusMessage(message: unknown): Promise<unknown> {
  const { type, payload } = message as { type: string; payload: WordStatusPayload };
  const langCode = payload.langCode ?? LANG;
  const term = payload.term ?? '';
  try {
    switch (type) {
      case MESSAGE_TYPES.WORD_STATUSES_GET: {
        const entries = await getAllWordStatuses(langCode);
        const wanted = new Set(payload.terms ?? []);
        const statuses: Record<string, WordStatus> = {};
        for (const e of entries) if (wanted.has(e.term)) statuses[e.term] = e.status;
        return { success: true, data: { statuses } };
      }
      case MESSAGE_TYPES.WORD_STATUS_LIST: {
        await purgeExpiredTrash(langCode).catch(() => undefined);
        const entries = await getAllWordStatuses(langCode);
        return { success: true, data: { entries: [...entries] } };
      }
      case MESSAGE_TYPES.WORD_STATUS_SET:
        await setWordStatus(langCode, term, payload.status ?? 'tracking');
        return { success: true };
      case MESSAGE_TYPES.WORD_STATUS_CYCLE: {
        const status = await cycleWordStatus(langCode, term);
        return { success: true, data: { status } };
      }
      case MESSAGE_TYPES.WORD_STATUS_DELETE:
        await deleteWordStatus(langCode, term);
        return { success: true };
      case MESSAGE_TYPES.WORD_STATUS_TRASH:
        await trashWordStatus(langCode, term);
        return { success: true };
      case MESSAGE_TYPES.WORD_STATUS_TRASH_LIST: {
        const entries = await listWordTrash(langCode);
        return { success: true, data: { entries } };
      }
      case MESSAGE_TYPES.WORD_STATUS_RESTORE: {
        const status = await restoreWordStatus(langCode, term);
        return { success: true, data: { status } };
      }
      case MESSAGE_TYPES.WORD_STATUS_TRASH_DELETE:
        await deleteWordTrash(langCode, term);
        return { success: true };
      default:
        return { success: false, error: `Unhandled message type: ${type}` };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function resetVocabulary(langCode: string): Promise<void> {
  const [entries, trash] = await Promise.all([
    getAllWordStatuses(langCode),
    listWordTrash(langCode),
  ]);
  await Promise.all([
    ...entries.map((e) => deleteWordStatus(langCode, e.term)),
    ...trash.map((e) => deleteWordTrash(langCode, e.term)),
  ]);
}

async function seedVocabulary(langCode: string): Promise<void> {
  await resetVocabulary(langCode);
  if (SHOWCASE_DATA === 'empty') return;

  if (SHOWCASE_DATA === 'overflow') {
    const statuses: readonly WordStatus[] = ['tracking', 'known', 'ignore'];
    const batch = Array.from({ length: 240 }, (_, i) => ({
      term: `vocab-item-${String(i + 1).padStart(3, '0')}`,
      status: statuses[i % statuses.length],
    }));
    for (const w of batch) await setWordStatus(langCode, w.term, w.status);
    return;
  }

  for (const w of SEED_WORDS) await setWordStatus(langCode, w.term, w.status);
  for (const w of SEED_TRASH) {
    await setWordStatus(langCode, w.term, w.previousStatus);
    await trashWordStatus(langCode, w.term);
  }
}

export function Showcase(): ReactElement {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const g = globalThis as { __cellSendMessage?: (m: unknown) => Promise<unknown> };
    const previous = g.__cellSendMessage;
    g.__cellSendMessage = handleWordStatusMessage;
    let cancelled = false;
    void seedVocabulary(LANG).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
      g.__cellSendMessage = previous;
    };
  }, []);

  return (
    <div className={styles.page}>
      {ready ? <VocabularyTab langCode={LANG} onLookup={() => undefined} /> : null}
    </div>
  );
}

export const showcaseMeta = {
  title: 'Vocabulary Panel',
  description:
    'Universal Panel tab for managing tracked vocabulary. Toolbar with filter/sort menus, search, segments, edit mode, status badges, trash, and pagination.',
  level: 'pages' as const,
  category: 'Side Panel',
  order: 36,
};
