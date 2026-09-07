// ResourceDetail — expandable body of a ResourceCard.
//
// Lazy-loads on mount (the card only renders this when expanded):
//   - ~10 sample entries (term + reading | term + rank)
//   - language profiles for the "Hồ sơ áp dụng" multi-select (≥2 profiles)
// Inline "Thử tra từ" lookup runs find*Entry against this resource only.

import { useEffect, useState, type ReactElement } from 'react';
import { Button, Input } from '@/shared/ui';
import { Checkbox } from '@/shared/ui/Checkbox';
import { Spinner } from '@/shared/ui/Spinner';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import {
  sampleDictionaryEntries,
  findDictionaryEntry,
  sampleFrequencyEntries,
  findFrequencyEntry,
  setResourceProfiles,
} from '@/features/dictionary/services/resourceClient';
import type { DictionaryEntry, FrequencyEntry, ResourceInfo } from '@/entities/dictionary';
import type { LanguageProfile } from '@/entities/settings';
import styles from './ResourceCard.module.css';

const SAMPLE_LIMIT = 10;
const DEFINITION_PREVIEW = 200;

interface ResourceDetailProps {
  readonly resource: ResourceInfo;
  /** Called after a mutation (profile assignment) so the panel can refresh. */
  readonly onChanged?: () => void;
}

function truncate(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

export function ResourceDetail({ resource, onChanged }: ResourceDetailProps): ReactElement {
  const isDict = resource.type === 'DICTIONARY';
  const resourceId = resource.id;
  const langCode = resource.langCode;

  const [samples, setSamples] = useState<readonly (DictionaryEntry | FrequencyEntry)[] | null>(null);
  const [sampleError, setSampleError] = useState(false);
  const [profiles, setProfiles] = useState<readonly LanguageProfile[] | null>(null);
  const [term, setTerm] = useState('');
  const [lookup, setLookup] = useState<{ text: string; found: boolean } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  // Lazy-load samples + profiles once when the detail expands.
  useEffect(() => {
    if (resourceId == null) return;
    let alive = true;

    const load = isDict
      ? sampleDictionaryEntries(langCode, resourceId, SAMPLE_LIMIT)
      : sampleFrequencyEntries(langCode, resourceId, SAMPLE_LIMIT);
    load
      .then((entries) => { if (alive) setSamples(entries); })
      .catch(() => { if (alive) setSampleError(true); });

    loadSettings()
      .then((s) => { if (alive) setProfiles(s.languageProfiles); })
      .catch(() => { if (alive) setProfiles([]); });

    return () => { alive = false; };
  }, [langCode, resourceId, isDict]);

  const handleLookup = async (): Promise<void> => {
    const q = term.trim();
    if (!q || resourceId == null || lookingUp) return;
    setLookingUp(true);
    try {
      if (isDict) {
        const entry = await findDictionaryEntry(langCode, resourceId, q);
        setLookup(
          entry
            ? { text: truncate(entry.definition || entry.reading || '—', DEFINITION_PREVIEW), found: true }
            : { text: 'Không có trong từ điển này.', found: false },
        );
      } else {
        const entry = await findFrequencyEntry(langCode, resourceId, q);
        setLookup(
          entry
            ? { text: `Hạng #${entry.frequency}`, found: true }
            : { text: 'Không có trong danh sách này.', found: false },
        );
      }
    } catch {
      setLookup({ text: 'Không tra được — thử lại sau.', found: false });
    } finally {
      setLookingUp(false);
    }
  };

  const handleProfileToggle = async (profileId: string, checked: boolean): Promise<void> => {
    if (resourceId == null) return;
    const current = new Set(resource.profileIds ?? []);
    if (checked) current.add(profileId);
    else current.delete(profileId);
    try {
      await setResourceProfiles(langCode, resourceId, [...current]);
      onChanged?.();
    } catch {
      // Keep the panel silent on failure — checkbox state resyncs on refresh.
    }
  };

  const showProfiles = profiles != null && profiles.length >= 2;

  return (
    <div className={styles.detail} data-cell-id={`resource-detail-${resourceId}`}>
      {/* Sample preview */}
      {sampleError ? (
        <p className={styles.detailNote}>Không tải được mục mẫu.</p>
      ) : samples == null ? (
        <p className={styles.detailNote}>
          <Spinner size="sm" ariaLabel="Đang tải" /> Đang tải mục mẫu…
        </p>
      ) : samples.length === 0 ? (
        <p className={styles.detailNote}>Chưa có dữ liệu mẫu.</p>
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

      {/* Test lookup */}
      <div className={styles.lookupRow}>
        <Input
          type="text"
          size="sm"
          placeholder="Thử tra từ…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleLookup(); }}
          aria-label="Thử tra từ"
          data-cell-id={`lookup-input-${resourceId}`}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleLookup()}
          disabled={lookingUp || term.trim() === ''}
          data-cell-id={`lookup-button-${resourceId}`}
        >
          Tra
        </Button>
      </div>
      {lookup && (
        <p
          className={`${styles.lookupResult} ${lookup.found ? '' : styles.lookupMiss}`}
          role="status"
          data-cell-id={`lookup-result-${resourceId}`}
        >
          {lookup.text}
        </p>
      )}

      {/* Profile assignment — only when the user has ≥2 profiles */}
      {showProfiles && (
        <div className={styles.profileBlock} data-cell-id={`profile-picker-${resourceId}`}>
          <span className={styles.profileLabel}>Hồ sơ áp dụng</span>
          <span className={styles.detailNote}>Để trống = áp dụng cho tất cả hồ sơ.</span>
          {profiles.map((p) => (
            <Checkbox
              key={p.id}
              label={p.name}
              checked={resource.profileIds?.includes(p.id) ?? false}
              onChange={(e) => void handleProfileToggle(p.id, e.target.checked)}
              data-cell-id={`profile-option-${p.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
