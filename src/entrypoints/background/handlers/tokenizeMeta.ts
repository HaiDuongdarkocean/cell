/**
 * TOKENIZE_META_GET — the tokenize fast lane in ONE roundtrip.
 *
 * The first token paint needs statuses + frequency bands together; serving
 * them as one message saves a sendMessage hop plus one getAllResources pass
 * versus separate WORD_STATUSES_GET + FREQUENCY_GET requests. Dictionary
 * readings stay on the slower detached READINGS_GET lane.
 *
 * TOKENIZE_PING — zero-work keep-alive. A sendMessage wakes a suspended
 * service worker, so content scripts ping at init to warm the background
 * before the user ever toggles tokenize.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import {
  TokenizeMetaGetPayloadSchema,
  TokenizePingPayloadSchema,
} from '@/entities/message/dictionarySchemas';
import { getWordStatuses } from '@/features/dictionary/services/wordStatusStore';
import { findFrequencyByTerms } from '@/features/dictionary/repositories/resourceEntryRepository';
import { getAllResources } from '@/features/dictionary/repositories/resourceRepository';
import { prewarmFreqIndex } from '@/features/dictionary/repositories/entryBlobStore';
import { resourceOffersComponent } from '@/features/dictionary/logic/dictionaryComponents';
import type { FrequencyEntry, WordStatus } from '@/entities/dictionary';
import type { ResourceInfo } from '@/entities/dictionary';

function frequencyAllowedIds(resources: readonly ResourceInfo[]): Set<number> {
  const ids = new Set<number>();
  for (const r of resources) {
    if (r.id === undefined || r.enabled === false || !r.installationFinished) continue;
    if (resourceOffersComponent(r, 'frequency')) ids.add(r.id);
  }
  return ids;
}

export function registerTokenizeMetaHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.TOKENIZE_PING, async (request): Promise<MessageResponse> => {
    const parsed = TokenizePingPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid TOKENIZE_PING payload: ${parsed.error.message}` };
    }
    // Besides waking the SW, kick the in-memory freq index build — the first
    // meta flush then reads Map hits instead of deserializing chunks.
    const { langCode } = parsed.data;
    if (langCode) void prewarmFreqIndex(langCode).catch(() => {});
    return { success: true };
  });

  ctx.on(
    MESSAGE_TYPES.TOKENIZE_META_GET,
    async (
      request,
    ): Promise<
      MessageResponse<{
        statuses: Record<string, WordStatus>;
        frequencyEntries: Record<string, FrequencyEntry[]>;
      }>
    > => {
      const parsed = TokenizeMetaGetPayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return { success: false, error: `Invalid TOKENIZE_META_GET payload: ${parsed.error.message}` };
      }
      const { langCode, terms } = parsed.data;
      try {
        const t0 = performance.now();
        // Each leg fails soft into an empty map — callers flag an empty
        // authoritative map the same way they flagged a rejected leg, and one
        // bad store must not take down the other.
        const [statusMap, resources] = await Promise.all([
          getWordStatuses(langCode, terms).catch(() => new Map<string, WordStatus>())
            .then((m) => ((globalThis as any).__legSt = Math.round(performance.now() - t0), m)),
          getAllResources(langCode)
            .then((r) => ((globalThis as any).__legRes = Math.round(performance.now() - t0), r)),
        ]);
        const allowed = frequencyAllowedIds(resources);
        const t1 = performance.now();
        const freqMap = allowed.size === 0
          ? new Map<string, FrequencyEntry[]>()
          : await findFrequencyByTerms(langCode, terms, allowed).catch(() => new Map<string, FrequencyEntry[]>());
        (globalThis as any).__legFreq = Math.round(performance.now() - t1);
        (globalThis as any).__legTotal = Math.round(performance.now() - t0);
        (globalThis as any).__legTerms = terms.length;
        const statuses: Record<string, WordStatus> = {};
        for (const [term, status] of statusMap) statuses[term] = status;
        const frequencyEntries: Record<string, FrequencyEntry[]> = {};
        for (const [term, entries] of freqMap) frequencyEntries[term] = entries;
        return { success: true, data: { statuses, frequencyEntries } };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: message };
      }
    },
  );
}
