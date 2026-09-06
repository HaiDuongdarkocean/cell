// NOTE: tokenize controllers run in content scripts — repositories must be
// reached through resourceClient (background proxy), never directly, or the
// reads would hit the PAGE's IndexedDB and always come back empty.
import { listResources } from '@/features/dictionary/services/resourceClient';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { DEFAULT_BAND_THRESHOLDS, type FrequencyBandThresholds } from '@/shared/lib/frequencyBand';

export {
  rankToBand,
  entriesToBand,
  pickBestFrequencyEntry,
  DEFAULT_BAND_THRESHOLDS,
  type TokenFrequencyBand,
  type FrequencyBandThresholds,
} from '@/shared/lib/frequencyBand';

export interface FrequencyBandOptions {
  readonly thresholds: FrequencyBandThresholds;
  /** Frequency resource ids ordered highest-priority first (getAllResources order). */
  readonly resourcePriority: readonly number[];
}

/**
 * loadFrequencyBandOptions — thresholds from settings + enabled frequency
 * resources in priority order. Cache the result per controller lifetime;
 * `ponytail:` changes to bands/resources apply on next controller init —
 * a storage listener would be the upgrade path if live reload is needed.
 */
export async function loadFrequencyBandOptions(langCode: string): Promise<FrequencyBandOptions> {
  const [settings, resources] = await Promise.all([loadSettings(), listResources(langCode)]);
  return {
    thresholds: settings.frequencyBands ?? DEFAULT_BAND_THRESHOLDS,
    resourcePriority: resources
      .filter((r) => r.type === 'FREQUENCY' && r.enabled !== false)
      .map((r) => r.id!)
      .filter((id): id is number => id !== undefined),
  };
}
