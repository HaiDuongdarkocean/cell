/**
 * Card Creator settings panel — destination, AnkiConnect URL + connection test,
 * default note type / deck, and per-note-type field mapping editor.
 *
 * spec anki-config-in-settings (schema v29).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import type { ReactElement } from 'react';
import type { CardCreatorSettings, SrsDestination } from '@/entities/settings';
import { testConnection } from '@/features/cardCreator/service/cardCreatorService';
import {
  loadAnkiSchemaCache,
  refreshAnkiSchemaCache,
  getModelFields,
} from '@/features/cardCreator/service/ankiSchemaCache';
import { SOURCE_FIELD_ORDER, autoMapFields } from '@/features/cardCreator/service/fieldMapping';
import { t, type MessageKey } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Select } from '@/shared/ui/Select';
import { Text } from '@/shared/ui/Text';
import styles from './CardCreatorSettingsPanel.module.css';

interface CardCreatorSettingsPanelProps {
  /** Current Card Creator settings. */
  settings: CardCreatorSettings;
  /** Current SRS destination (lives in settings.dictionaryPopup.srsDestination). */
  srsDestination: SrsDestination;
  /** Called with partial CardCreatorSettings update. */
  onChange: (partial: Partial<CardCreatorSettings>) => void;
  /** Called when the SRS destination changes. */
  onDestinationChange: (srsDestination: SrsDestination) => void;
}

type ConnectionStatus = 'idle' | 'testing' | 'online' | 'offline';

function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

function statusLabel(status: ConnectionStatus): string {
  switch (status) {
    case 'testing':
      return t('cardCreator.settings.test.testing');
    case 'online':
      return t('cardCreator.settings.test.online');
    case 'offline':
      return t('cardCreator.settings.test.offline');
    default:
      return t('cardCreator.settings.test.idle');
  }
}

function buildStatusDetail(status: ConnectionStatus, version: number | null, url: string): string {
  if (status === 'testing') return t('cardCreator.settings.test.testing');
  if (status === 'offline') return t('cardCreator.settings.test.offlineDetail');
  if (status === 'online' && version !== null) {
    return t('cardCreator.settings.test.onlineDetail', [shortUrl(url), String(version)]);
  }
  return shortUrl(url);
}

const sourceFieldI18n: Record<string, MessageKey> = {
  targetWord: 'cardCreator.field.targetWord',
  sentence: 'cardCreator.field.sentence',
  sentenceTranslation: 'cardCreator.field.sentenceTranslation',
  definitions: 'cardCreator.field.definitions',
  images: 'cardCreator.field.image',
  sentenceAudios: 'cardCreator.field.sentenceAudio',
  wordAudios: 'cardCreator.field.wordAudio',
  note: 'cardCreator.field.note',
  moreExample: 'cardCreator.field.moreExample',
};

export function CardCreatorSettingsPanel({
  settings,
  srsDestination,
  onChange,
  onDestinationChange,
}: CardCreatorSettingsPanelProps): ReactElement {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [version, setVersion] = useState<number | null>(null);
  const [decks, setDecks] = useState<readonly string[]>([]);
  const [models, setModels] = useState<readonly string[]>([]);
  const [fields, setFields] = useState<readonly string[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);

  const isAnki = srsDestination === 'anki';
  const noteType = settings.defaultNoteType;

  const firstLoadRef = useRef(false);

  // Load persisted cache whenever the panel mounts / URL changes.
  useEffect(() => {
    let cancelled = false;
    firstLoadRef.current = true;

    async function loadCache() {
      const cache = await loadAnkiSchemaCache(settings.ankiConnectUrl);
      if (cancelled) return;
      if (cache) {
        setDecks(cache.decks);
        setModels(cache.models);
      }
      // Fields for the current note type (cache-first).
      if (noteType) {
        setLoadingFields(true);
        const f = await getModelFields(settings.ankiConnectUrl, noteType);
        if (!cancelled) {
          setFields(f ?? []);
          setLoadingFields(false);
          if (f && !settings.fieldMappings?.[noteType]) {
            onChange({
              fieldMappings: { ...(settings.fieldMappings ?? {}), [noteType]: autoMapFields(f) },
            });
          }
        }
      }
    }

    void loadCache();
    return () => { cancelled = true; };
  }, [settings.ankiConnectUrl, noteType, onChange, settings.fieldMappings]);

  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ankiConnectUrl: e.target.value });
      setStatus('idle');
      setVersion(null);
    },
    [onChange],
  );

  const handleTest = useCallback(async () => {
    setStatus('testing');
    const r = await testConnection(settings.ankiConnectUrl);
    if (r.ok) {
      setVersion(r.value);
      setStatus('online');
      const refreshed = await refreshAnkiSchemaCache(settings.ankiConnectUrl);
      if (refreshed.ok) {
        setDecks(refreshed.value.decks);
        setModels(refreshed.value.models);
      }
    } else {
      setVersion(null);
      setStatus('offline');
    }
  }, [settings.ankiConnectUrl]);

  const handleDestinationChange = useCallback(
    (value: string) => {
      onDestinationChange(value as SrsDestination);
    },
    [onDestinationChange],
  );

  const handleNoteTypeChange = useCallback(
    async (value: string) => {
      onChange({ defaultNoteType: value });
      setLoadingFields(true);
      const f = await getModelFields(settings.ankiConnectUrl, value);
      setFields(f ?? []);
      setLoadingFields(false);
      if (f && !settings.fieldMappings?.[value]) {
        onChange({
          fieldMappings: { ...(settings.fieldMappings ?? {}), [value]: autoMapFields(f) },
        });
      }
    },
    [settings.ankiConnectUrl, settings.fieldMappings, onChange],
  );

  const handleDeckChange = useCallback(
    (value: string) => {
      onChange({ defaultDeck: value });
    },
    [onChange],
  );

  const handleMappingChange = useCallback(
    (sourceKey: string, ankiField: string) => {
      const mapping = settings.fieldMappings?.[noteType] ?? {};
      onChange({
        fieldMappings: {
          ...(settings.fieldMappings ?? {}),
          [noteType]: { ...mapping, [sourceKey]: ankiField },
        },
      });
    },
    [noteType, settings.fieldMappings, onChange],
  );

  const displayedMapping = settings.fieldMappings?.[noteType] ?? {};

  const indicatorClass =
    status === 'online'
      ? styles.online
      : status === 'offline'
        ? styles.offline
        : status === 'testing'
          ? styles.testing
          : '';

  const destinationOptions = [
    { value: 'anki', label: t('cardCreator.settings.destination.anki') },
    { value: 'ocean-srs', label: t('cardCreator.settings.destination.oceanSrs') },
  ];

  return (
    <div className={styles.container} data-cell-id="card-creator-settings-panel">
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="cc-srs-destination">
          {t('cardCreator.settings.destination.label')}
        </label>
        <Select
          id="cc-srs-destination"
          value={srsDestination}
          onChange={handleDestinationChange}
          options={destinationOptions}
          aria-label={t('cardCreator.settings.destination.aria')}
          data-cell-id="cc-srs-destination"
        />
      </div>

      {!isAnki && (
        <Text as="p" color="secondary" className={styles.hint} data-cell-id="cc-ocean-srs-hint">
          {t('cardCreator.settings.destination.oceanHint')}
        </Text>
      )}

      {isAnki && (
        <>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="cc-anki-url">
              {t('cardCreator.settings.ankiUrl')}
            </label>
            <Input
              id="cc-anki-url"
              type="text"
              value={settings.ankiConnectUrl}
              onChange={handleUrlChange}
              placeholder={t('cardCreator.settings.ankiUrlPlaceholder')}
              aria-label={t('cardCreator.settings.ankiUrlAria')}
              data-cell-id="cc-anki-url-input"
            />
            <Text as="p" color="secondary" className={styles.hint}>
              {t('cardCreator.settings.ankiUrlHint')}
            </Text>
          </div>

          <div className={styles.connectionStatus}>
            <div
              className={`${styles.statusIndicator} ${indicatorClass}`}
              aria-live="polite"
              data-cell-id="cc-connection-status"
            >
              <span className={styles.statusDot} aria-hidden="true" />
              <span className={styles.statusLabel}>{statusLabel(status)}</span>
              <span className={styles.statusDetail}>
                {buildStatusDetail(status, version, settings.ankiConnectUrl)}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={status === 'testing'}
              aria-label={t('cardCreator.settings.test.againAria')}
              data-cell-id="cc-test-again-button"
            >
              {status === 'testing' ? t('cardCreator.settings.test.testing') : t('cardCreator.settings.test.again')}
            </Button>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="cc-note-type">
              {t('cardCreator.destination.noteType')}
            </label>
            <Select
              id="cc-note-type"
              value={noteType}
              onChange={handleNoteTypeChange}
              options={models.map((m) => ({ value: m, label: m }))}
              placeholder={t('cardCreator.settings.noteTypePlaceholder')}
              disabled={models.length === 0}
              aria-label={t('cardCreator.destination.noteType')}
              data-cell-id="cc-note-type-select"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="cc-deck">
              {t('cardCreator.destination.deck')}
            </label>
            <Select
              id="cc-deck"
              value={settings.defaultDeck}
              onChange={handleDeckChange}
              options={decks.map((d) => ({ value: d, label: d }))}
              placeholder={t('cardCreator.settings.deckPlaceholder')}
              disabled={decks.length === 0}
              aria-label={t('cardCreator.destination.deck')}
              data-cell-id="cc-deck-select"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>{t('cardCreator.settings.mapping.title')}</label>
            {loadingFields ? (
              <Text as="p" color="secondary" className={styles.hint}>
                {t('cardCreator.settings.mapping.loading')}
              </Text>
            ) : fields.length === 0 ? (
              <Text as="p" color="secondary" className={styles.hint} data-cell-id="cc-mapping-empty">
                {t('cardCreator.settings.mapping.empty')}
              </Text>
            ) : (
              <div className={styles.mappingList} data-cell-id="cc-mapping-list">
                {SOURCE_FIELD_ORDER.map((sourceKey) => (
                  <div key={sourceKey} className={styles.mappingRow} data-cell-id={`cc-mapping-row-${sourceKey}`}>
                    <span className={styles.mappingLabel}>{t(sourceFieldI18n[sourceKey]!)}</span>
                    <Select
                      className={styles.mappingSelect}
                      value={displayedMapping[sourceKey] ?? ''}
                      onChange={(val) => handleMappingChange(sourceKey, val)}
                      options={[
                        { value: '', label: t('cardCreator.fieldMap.none') },
                        ...fields.map((f) => ({ value: f, label: f })),
                      ]}
                      aria-label={t('cardCreator.settings.mapping.aria', [t(sourceFieldI18n[sourceKey]!)])}
                      data-cell-id={`cc-mapping-select-${sourceKey}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
