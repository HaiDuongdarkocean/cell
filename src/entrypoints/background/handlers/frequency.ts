/**
 * Frequency message handler — FREQUENCY_GET.
 *
 * Content scripts ask the background to read frequency entries because
 * IndexedDB is origin-isolated: the extension's IDB lives in the extension
 * origin, not the web page. Background keeps the single source of truth.
 *
 * Only enabled resources with a 'frequency' component contribute ranks —
 * a disabled resource (or a resource whose frequency component is toggled
 * off) must not leak ranks into lookup.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import { FrequencyGetPayloadSchema } from '@/entities/message/dictionarySchemas';
import { findFrequencyByTerms } from '@/features/dictionary/repositories/resourceEntryRepository';
import { getAllResources } from '@/features/dictionary/repositories/resourceRepository';
import { resourceOffersComponent } from '@/features/dictionary/logic/dictionaryComponents';
import type { FrequencyEntry, ResourceInfo } from '@/entities/dictionary';

/** Enabled resources that may contribute frequency ranks. */
function frequencyAllowedIds(resources: readonly ResourceInfo[]): Set<number> {
  const ids = new Set<number>();
  for (const r of resources) {
    if (r.id === undefined || r.enabled === false || !r.installationFinished) continue;
    if (resourceOffersComponent(r, 'frequency')) ids.add(r.id);
  }
  return ids;
}

/** Register frequency GET handler. */
export function registerFrequencyHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.FREQUENCY_GET, async (request): Promise<MessageResponse<{ entries: Record<string, FrequencyEntry[]> }>> => {
    const parsed = FrequencyGetPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid FREQUENCY_GET payload: ${parsed.error.message}`,
      };
    }

    const { langCode, terms } = parsed.data;
    try {
      const allowed = frequencyAllowedIds(await getAllResources(langCode));
      const map = allowed.size === 0
        ? new Map<string, FrequencyEntry[]>()
        : await findFrequencyByTerms(langCode, terms, allowed);
      const entries: Record<string, FrequencyEntry[]> = {};
      for (const [term, value] of map.entries()) {
        entries[term] = value;
      }
      return { success: true, data: { entries } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });
}
