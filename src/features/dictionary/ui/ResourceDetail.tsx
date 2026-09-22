// ResourceDetail — expandable body of a ResourceCard.
//
// Lazy-loads ~10 sample entries (term + reading | term + rank) when the card
// expands. Test lookups live in the integrated dictionary column beside the
// panel — not here.

import { useEffect, useState, type ReactElement } from 'react';
import { t } from '@/shared/i18n';
import { Spinner } from '@/shared/ui/Spinner';
import {
  sampleDictionaryEntries,
  sampleFrequencyEntries,
} from '@/features/dictionary/services/resourceClient';
import type { DictionaryEntry, FrequencyEntry, ResourceInfo } from '@/entities/dictionary';
import styles from './ResourceCard.module.css';

const SAMPLE_LIMIT = 10;

interface ResourceDetailProps {
  readonly resource: ResourceInfo;
}

export function ResourceDetail({ resource }: ResourceDetailProps): ReactElement {
  const isDict = resource.type === 'DICTIONARY';
  const resourceId = resource.id;
  const langCode = resource.langCode;

  const [samples, setSamples] = useState<readonly (DictionaryEntry | FrequencyEntry)[] | null>(null);
  const [sampleError, setSampleError] = useState(false);

  useEffect(() => {
    if (resourceId == null) return;
    let alive = true;

    const load = isDict
      ? sampleDictionaryEntries(langCode, resourceId, SAMPLE_LIMIT)
      : sampleFrequencyEntries(langCode, resourceId, SAMPLE_LIMIT);
    load
      .then((entries) => { if (alive) setSamples(entries); })
      .catch(() => { if (alive) setSampleError(true); });

    return () => { alive = false; };
  }, [langCode, resourceId, isDict]);

  return (
    <div className={styles.detail} data-cell-id={`resource-detail-${resourceId}`}>
      {sampleError ? (
        <p className={styles.detailNote}>{t('resources.detail.error')}</p>
      ) : samples == null ? (
        <p className={styles.detailNote}>
          <Spinner size="sm" ariaLabel={t('resources.detail.loading')} /> {t('resources.detail.loadingSamples')}
        </p>
      ) : samples.length === 0 ? (
        <p className={styles.detailNote}>{t('resources.detail.empty')}</p>
      ) : (
        <ul className={styles.sampleList} data-cell-id={`sample-list-${resourceId}`}>
          {samples.map((entry, i) => (
            <li key={entry.id ?? i} className={styles.sampleItem}>
              <span className={styles.sampleTerm}>{entry.term}</span>
              <span className={styles.sampleMeta}>
                {isDict
                  ? (entry as DictionaryEntry).reading
                  : `#${(entry as FrequencyEntry).frequency}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
