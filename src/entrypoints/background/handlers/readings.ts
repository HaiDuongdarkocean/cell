/**
 * Readings message handler — READINGS_GET (spec reading-annotation).
 *
 * Batch pronunciation/reading resolution for tokenized surfaces. Content
 * scripts cannot reach the extension-origin IndexedDB directly, so the
 * background resolves readings for a chunk of terms in one cursor pass.
 *
 * Source selection mirrors the dictionary popup exactly: eligible resources
 * ordered by explicit priority then descending resourceId; the first entry
 * with a usable `pronunciation` or distinct `reading` wins; resources whose
 * 'pronunciation' component is disabled are skipped; a `reading === term`
 * row never shadows a lower-priority real reading.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import { ReadingsGetPayloadSchema } from '@/entities/message/dictionarySchemas';
import { findDictionaryByTerms } from '@/features/dictionary/repositories/resourceEntryRepository';
import { getAllResources } from '@/features/dictionary/repositories/resourceRepository';
import { buildResourcePriority } from '@/features/dictionaryPopup/logic/lookupOrchestrator';
import type { DictionaryComponent, DictionaryEntry, ResourceInfo } from '@/entities/dictionary';

/** Eligible dictionary-capable resources (mirrors lookupOrchestrator's filter). */
function readingResources(resources: readonly ResourceInfo[]): ResourceInfo[] {
  return resources.filter((r) => {
    if (r.installationFinished === false || r.enabled === false) return false;
    return r.components?.length ? r.components.some((c) => c !== 'frequency') : r.type === 'DICTIONARY';
  });
}

/** Pick the winning reading for one term, mirroring the popup's find rule. */
function pickReading(
  term: string,
  entries: readonly DictionaryEntry[],
  rankOf: ReadonlyMap<number, number>,
  disabledOf: (resourceId: number) => ReadonlySet<DictionaryComponent>,
): string {
  const ordered = [...entries].sort(
    (a, b) => (rankOf.get(a.resourceId) ?? Number.MAX_SAFE_INTEGER) - (rankOf.get(b.resourceId) ?? Number.MAX_SAFE_INTEGER),
  );
  const lower = term.toLowerCase();
  const hit = ordered.find(
    (e) => !disabledOf(e.resourceId).has('pronunciation')
      && (e.pronunciation || (e.reading && e.reading.toLowerCase() !== lower)),
  );
  const raw = hit?.pronunciation || hit?.reading || '';
  return raw.toLowerCase() === lower ? '' : raw;
}

export function registerReadingsHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.READINGS_GET, async (request): Promise<MessageResponse<{ readings: Record<string, string> }>> => {
    const parsed = ReadingsGetPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid READINGS_GET payload: ${parsed.error.message}` };
    }

    const { langCode, terms } = parsed.data;
    try {
      const eligible = readingResources(await getAllResources(langCode));
      const readings: Record<string, string> = {};
      if (eligible.length === 0) {
        return { success: true, data: { readings } };
      }

      const rankOf = new Map<number, number>();
      buildResourcePriority(eligible).forEach((id, i) => rankOf.set(id, i));
      const disabledByResource = new Map<number, ReadonlySet<DictionaryComponent>>();
      for (const r of eligible) {
        if (r.id !== undefined && r.disabledComponents?.length) {
          disabledByResource.set(r.id, new Set(r.disabledComponents));
        }
      }
      const disabledOf = (resourceId: number): ReadonlySet<DictionaryComponent> =>
        disabledByResource.get(resourceId) ?? new Set<DictionaryComponent>();

      const allowed = new Set(eligible.map((r) => r.id).filter((id): id is number => id !== undefined));
      const map = await findDictionaryByTerms(langCode, terms, allowed);
      for (const [term, entries] of map.entries()) {
        const reading = pickReading(term, entries, rankOf, disabledOf);
        if (reading) readings[term] = reading;
      }
      return { success: true, data: { readings } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });
}
