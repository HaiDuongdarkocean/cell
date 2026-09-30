import { useEffect, useState } from 'react';
import { Box, Button, Heading, Text } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { Sheet } from '@/shared/ui/Sheet';
import { t } from '@/shared/i18n';
import { audioAssetId, imageAssetId } from '@/features/srs/lib/helpers';
import { ensureFirstRun } from '@/features/srs/services/firstRunService';
import { getCollection } from '@/features/srs/repositories/collectionRepository';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { DictionaryPanelView } from '@/features/dictionaryPopup/ui/DictionaryPanelView';
import type { SrsAudioAsset, SrsFieldValue, SrsImageAsset, SrsNote } from '@/entities/srs/types';
import { HighlightedSentence, playAudio, useImageBlobUrl } from './srsCardShared';
import styles from './SrsReviewCard.module.css';

const BUILTIN_FIELDS = new Set(['target', 'ipa', 'sentence', 'def', 'wordAudio', 'sentAudio', 'image', 'translation', 'notes', 'examples']);

const FIELD_LABEL_KEYS: Record<string, Parameters<typeof t>[0]> = {
  examples: 'srs.review.examples',
  notes: 'srs.review.notes',
};

function fieldText(value: SrsFieldValue | undefined): string {
  if (!value) return '';
  return value.kind === 'list' ? value.value.join('\n') : 'value' in value ? value.value : '';
}

function fieldLabel(fieldId: string): string {
  const key = FIELD_LABEL_KEYS[fieldId];
  if (key) return t(key);
  return fieldId.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

function FieldBox({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <Box bg="muted" className={styles.fieldBox}>
      <Text className={styles.fieldBoxLabel}>{label}</Text>
      {children}
    </Box>
  );
}

function BackFieldValue({ value }: { value: SrsFieldValue }): React.JSX.Element | null {
  if (value.kind === 'list') {
    return (
      <ul className={styles.list}>
        {value.value.map((item, i) => (
          <li key={i} className={styles.listItem}>
            <Text>{item}</Text>
          </li>
        ))}
      </ul>
    );
  }
  const text = 'value' in value ? value.value : '';
  const senses = text.split('•').map((s) => s.trim()).filter(Boolean);
  if (senses.length > 1) {
    return (
      <ul className={styles.list}>
        {senses.map((sense, i) => (
          <li key={i} className={styles.listItem}>
            <Text>{sense}</Text>
          </li>
        ))}
      </ul>
    );
  }
  return <Text className={styles.fieldText}>{text}</Text>;
}

interface SrsReviewCardBackProps {
  readonly note: SrsNote;
  readonly audioCache: ReadonlyMap<string, SrsAudioAsset>;
  readonly imageCache: ReadonlyMap<string, SrsImageAsset>;
}

export function SrsReviewCardBack({
  note,
  audioCache,
  imageCache,
}: SrsReviewCardBackProps): React.JSX.Element {
  const [translationRevealed, setTranslationRevealed] = useState(false);
  const [lookup, setLookup] = useState<{ term: string } | null>(null);
  const [langs, setLangs] = useState<{ source: string; target: string }>({ source: 'en', target: 'vi' });

  const wordAudio = note.fields.wordAudio?.kind === 'audio' ? note.fields.wordAudio : undefined;
  const sentAudio = note.fields.sentAudio?.kind === 'audio' ? note.fields.sentAudio : undefined;
  const image = note.fields.image?.kind === 'image' ? note.fields.image : undefined;

  const wordAudioAsset = wordAudio ? audioCache.get(audioAssetId(note.id, 'wordAudio', wordAudio.source)) : undefined;
  const sentAudioAsset = sentAudio ? audioCache.get(audioAssetId(note.id, 'sentAudio', sentAudio.source)) : undefined;
  const imageAsset = image ? imageCache.get(imageAssetId(note.id, 'image')) : undefined;

  const imageUrl = useImageBlobUrl(imageAsset);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  useEffect(() => {
    void (async () => {
      const { collectionId } = await ensureFirstRun();
      const collection = await getCollection(collectionId);
      const settings = await loadSettings();
      const profile = settings.languageProfiles.find((p) => p.id === collection.languageProfileId)
        ?? settings.languageProfiles.find((p) => p.id === settings.activeProfileId);
      setLangs({ source: collection.targetLanguage || 'en', target: profile?.native || 'vi' });
    })().catch(() => {});
  }, []);

  const hasTranslation = note.fields.translation?.kind === 'translation' && Boolean(note.fields.translation.value);
  const ipa = fieldText(note.fields.ipa);
  const extraFields = Object.entries(note.fields).filter(([id, v]) => !BUILTIN_FIELDS.has(id) && fieldText(v).trim());

  return (
    <Box className={styles.back}>
      <Heading level={1} className={styles.targetWord}>{note.targetWord}</Heading>

      {note.fields.sentence?.kind === 'text' && (
        <HighlightedSentence sentence={note.fields.sentence.value} target={note.targetWord} />
      )}

      {hasTranslation && (
        translationRevealed ? (
          <Text className={styles.translation}>{fieldText(note.fields.translation)}</Text>
        ) : (
          <button
            type="button"
            className={styles.translationHint}
            onClick={() => { setTranslationRevealed(true); }}
          >
            {t('srs.review.sentenceTranslation')}
          </button>
        )
      )}

      <Box bg="muted" className={styles.lookupBar}>
        <Text className={styles.lookupTerm}>{note.targetWord}</Text>
        <Button
          variant="primary"
          size="sm"
          className={styles.lookupGo}
          onClick={() => { setLookup({ term: note.targetWord }); }}
        >
          {t('srs.review.lookupGo')}
        </Button>
      </Box>

      {(sentAudioAsset || wordAudioAsset) && (
        <Box className={styles.audioRow}>
          {sentAudioAsset && (
            <Button
              shape="circle"
              size="md"
              variant="primary"
              onClick={() => playAudio(sentAudioAsset)}
              aria-label={t('srs.review.playSentence')}
            >
              <Icon name="play" />
            </Button>
          )}
          {wordAudioAsset && (
            <Button
              shape="circle"
              size="md"
              variant="primary"
              onClick={() => playAudio(wordAudioAsset)}
              aria-label={t('srs.review.playWord')}
            >
              <Icon name="play" />
            </Button>
          )}
        </Box>
      )}

      {(note.fields.def || ipa) && (
        <Box className={styles.defBlock}>
          <Box className={styles.defHeader}>
            <Text className={styles.defTarget}>{note.targetWord}</Text>
            {ipa && <Text className={styles.defIpa}>({ipa})</Text>}
            <Text className={styles.defStar} aria-hidden="true">★★★</Text>
          </Box>
          {note.fields.def && <BackFieldValue value={note.fields.def} />}
        </Box>
      )}

      {imageUrl && (
        <Box className={styles.imageBlock}>
          <img src={imageUrl} alt={note.targetWord} className={styles.image} />
        </Box>
      )}

      {note.fields.examples && fieldText(note.fields.examples).trim() && (
        <FieldBox label={fieldLabel('examples')}>
          <BackFieldValue value={note.fields.examples} />
        </FieldBox>
      )}

      {note.fields.notes && fieldText(note.fields.notes).trim() && (
        <FieldBox label={fieldLabel('notes')}>
          <BackFieldValue value={note.fields.notes} />
        </FieldBox>
      )}

      {extraFields.map(([id, value]) => (
        <FieldBox key={id} label={fieldLabel(id)}>
          <BackFieldValue value={value} />
        </FieldBox>
      ))}

      <Sheet open={lookup !== null} onClose={() => { setLookup(null); }} aria-label={t('srs.review.lookupTitle')}>
        {lookup && (
          <DictionaryPanelView
            variant="integrated"
            langCode={langs.source}
            sourceLang={langs.source}
            targetLang={langs.target}
            initialTerm={lookup.term}
            contextSentence={note.fields.sentence?.kind === 'text' ? note.fields.sentence.value : undefined}
          />
        )}
      </Sheet>
    </Box>
  );
}
