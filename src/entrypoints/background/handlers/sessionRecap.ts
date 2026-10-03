import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type { MessageResponse, GetSessionRecapResult } from '@/entities/message';
import { GetSessionRecapPayloadSchema } from '@/entities/message/schema';
import {
  getHistory,
  getAllVideos,
  getSessionEventsInRange,
  pruneSessionEventsOnce,
} from '@/features/local-player';
import { getAllWordStatuses } from '@/features/dictionary/services/wordStatusStore';
import { composeSessionRecaps, SESSION_EVENTS_MAX_AGE_DAYS } from '@/features/sessionRecap';
import type { StatusEntryLike } from '@/features/sessionRecap';

const DAY_MS = 86_400_000;
const DICT_DB_PREFIX = 'orca-dict-';

async function listDictLangCodes(): Promise<string[]> {
  const dbs = await indexedDB.databases().catch(() => [] as IDBDatabaseInfo[]);
  const langs = new Set<string>();
  for (const db of dbs) {
    const name = db.name;
    if (!name?.startsWith(DICT_DB_PREFIX)) continue;
    const lang = name.slice(name.lastIndexOf('-') + 1);
    if (/^[a-z]{2}$/i.test(lang)) langs.add(lang);
  }
  return [...langs];
}

async function collectStatusEntries(): Promise<StatusEntryLike[]> {
  const langs = await listDictLangCodes();
  const out: StatusEntryLike[] = [];
  for (const langCode of langs) {
    const entries = await getAllWordStatuses(langCode).catch(() => []);
    for (const e of entries) {
      out.push({
        term: e.term,
        ...(e.pos ? { pos: e.pos } : {}),
        status: e.status,
        updatedAt: e.updatedAt,
        ...(e.source ? { source: e.source } : {}),
        ...(e.sourceAt !== undefined ? { sourceAt: e.sourceAt } : {}),
      });
    }
  }
  return out;
}

/** GET_SESSION_RECAP — composed per-session immersion recap for the
 *  universal panel Recap tab. Local-first: everything is read from the
 *  extension's own IndexedDB stores; nothing is sent off-device. */
export function registerSessionRecapHandlers(ctx: BackgroundContext): void {
  ctx.on(
    MESSAGE_TYPES.GET_SESSION_RECAP,
    async (request): Promise<MessageResponse<GetSessionRecapResult>> => {
      const parsed = GetSessionRecapPayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return {
          success: false,
          error: `Invalid GET_SESSION_RECAP payload: ${parsed.error.message}`,
        };
      }
      const nowMs = Date.now();
      void pruneSessionEventsOnce(nowMs - SESSION_EVENTS_MAX_AGE_DAYS * DAY_MS).catch(
        () => undefined,
      );

      const [records, events, videos, statusEntries] = await Promise.all([
        getHistory().catch(() => []),
        getSessionEventsInRange(nowMs - SESSION_EVENTS_MAX_AGE_DAYS * DAY_MS, nowMs).catch(
          () => [],
        ),
        getAllVideos().catch(() => []),
        collectStatusEntries().catch(() => []),
      ]);

      const sessions = composeSessionRecaps({
        records,
        events,
        videos,
        statusEntries,
        nowMs,
      });
      return { success: true, data: { sessions } };
    },
  );
}
