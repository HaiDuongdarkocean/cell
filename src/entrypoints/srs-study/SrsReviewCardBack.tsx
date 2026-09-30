import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Heading, Text } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
import { audioAssetId, imageAssetId } from '@/features/srs/lib/helpers';
import { parseDefEntries } from '@/features/srs';
import { getImageAssetsByNote } from '@/features/srs/repositories/imageAssetRepository';
import { getAudioAssetsByNote } from '@/features/srs/repositories/audioAssetRepository';
import type { SrsAudioAsset, SrsFieldValue, SrsImageAsset, SrsNote } from '@/entities/srs/types';
import { HighlightedSentence, playAudio, playAudioUrl, playableUrl, sequentialAudio, useImageBlobUrl } from './srsCardShared';
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

function BackImage({ note, value, asset }: { note: SrsNote; value: SrsFieldValue; asset: SrsImageAsset | undefined }): React.JSX.Element | null {
  const blobUrl = useImageBlobUrl(asset);
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);
  const src = blobUrl ?? (value.kind === 'image' && /^(https?|data|blob):/.test(value.value) ? value.value : undefined);
  if (!src) return null;
  return (
    <Box className={styles.imageBlock}>
      <img src={src} alt={note.targetWord} className={styles.image} />
    </Box>
  );
}

function DefEntryBlock({ entry }: { entry: { header: string; otherForms: string; senses: string } }): React.JSX.Element {
  const lines = entry.senses.split('\n').map((l) => l.trim()).filter(Boolean);
  const hasBullets = lines.some((l) => l.startsWith('•'));
  return (
    <Box className={styles.defBlock}>
      {entry.header && <Text className={styles.defEntryHeader}>{entry.header}</Text>}
      {entry.otherForms && <Text className={styles.otherForms}>{entry.otherForms}</Text>}
      {lines.map((line, i) =>
        line.startsWith('•') ? (
          <Text key={i} className={styles.defSense}>{line}</Text>
        ) : hasBullets ? (
          <Text key={i} className={styles.defExample}>{line}</Text>
        ) : (
          <Text key={i} className={styles.defSense}>{line}</Text>
        ),
      )}
    </Box>
  );
}

interface SrsReviewCardBackProps {
  readonly note: SrsNote;
  readonly audioCache: ReadonlyMap<string, SrsAudioAsset>;
  readonly imageCache: ReadonlyMap<string, SrsImageAsset>;
  readonly onFlipBack: () => void;
}

export function SrsReviewCardBack({
  note,
  audioCache,
  imageCache,
  onFlipBack,
}: SrsReviewCardBackProps): React.JSX.Element {
  const [translationRevealed, setTranslationRevealed] = useState(false);

  const wordAudio = note.fields.wordAudio?.kind === 'audio' ? note.fields.wordAudio : undefined;
  const sentAudio = note.fields.sentAudio?.kind === 'audio' ? note.fields.sentAudio : undefined;
  const imageFields = Object.entries(note.fields).filter(([, v]) => v.kind === 'image');

  const [repoImages, setRepoImages] = useState<ReadonlyMap<string, SrsImageAsset>>(new Map());
  const [repoAudio, setRepoAudio] = useState<ReadonlyMap<string, SrsAudioAsset>>(new Map());

  const wordAudioAsset = wordAudio
    ? (audioCache.get(audioAssetId(note.id, 'wordAudio', wordAudio.source)) ?? repoAudio.get('wordAudio'))
    : undefined;
  const sentAudioAsset = sentAudio
    ? (audioCache.get(audioAssetId(note.id, 'sentAudio', sentAudio.source)) ?? repoAudio.get('sentAudio'))
    : undefined;
  const wordAudioUrl = wordAudio ? playableUrl(wordAudio.value) : undefined;
  const sentAudioUrl = sentAudio ? playableUrl(sentAudio.value) : undefined;
  const hasWordAudio = Boolean(wordAudioAsset || wordAudioUrl);
  const hasSentAudio = Boolean(sentAudioAsset || sentAudioUrl);

  useEffect(() => {
    if (imageFields.length === 0) return;
    void getImageAssetsByNote(note.id)
      .then((assets) => { setRepoImages(new Map(assets.map((a) => [a.fieldId, a]))); })
      .catch(() => {});
  }, [note.id, imageFields.length]);

  useEffect(() => {
    if (!(wordAudio && !wordAudioUrl) && !(sentAudio && !sentAudioUrl)) return;
    void getAudioAssetsByNote(note.id)
      .then((assets) => { setRepoAudio(new Map(assets.map((a) => [a.fieldId, a]))); })
      .catch(() => {});
  }, [note.id, wordAudio, sentAudio, wordAudioUrl, sentAudioUrl]);

  const backAudio = useMemo(() => {
    const sources: (SrsAudioAsset | string)[] = [];
    const sent = sentAudioUrl ?? sentAudioAsset;
    const word = wordAudioUrl ?? wordAudioAsset;
    if (sent) sources.push(sent);
    if (word) sources.push(word);
    return sources;
  }, [sentAudioUrl, sentAudioAsset, wordAudioUrl, wordAudioAsset]);

  useEffect(() => sequentialAudio(backAudio), [backAudio]);

  const hasTranslation = note.fields.translation?.kind === 'translation' && Boolean(note.fields.translation.value);
  const ipa = fieldText(note.fields.ipa);
  const extraFields = Object.entries(note.fields).filter(([id, v]) => !BUILTIN_FIELDS.has(id) && v.kind !== 'image' && v.kind !== 'audio' && fieldText(v).trim());

  return (
    <div
      className={styles.back}
      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('button,input,audio,a,textarea,select')) return;
        onFlipBack();
      }}
    >
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

      {(hasSentAudio || hasWordAudio) && (
        <Box className={styles.audioRow}>
          {hasSentAudio && (
            <Button
              size="md"
              variant="primary"
              className={styles.audioPill}
              onClick={() => { if (sentAudioAsset) playAudio(sentAudioAsset); else playAudioUrl(sentAudioUrl!); }}
              aria-label={t('srs.review.playSentence')}
            >
              <Icon name="audioWave" />
            </Button>
          )}
          {hasWordAudio && (
            <Button
              shape="circle"
              size="md"
              variant="primary"
              onClick={() => { if (wordAudioAsset) playAudio(wordAudioAsset); else playAudioUrl(wordAudioUrl!); }}
              aria-label={t('srs.review.playWord')}
            >
              <Icon name="volumeHigh" />
            </Button>
          )}
        </Box>
      )}

      {note.fields.def ? (
        parseDefEntries(fieldText(note.fields.def)).map((entry, i) => (
          <DefEntryBlock key={i} entry={entry} />
        ))
      ) : ipa ? (
        <Box className={styles.defBlock}>
          <Box className={styles.defHeader}>
            <Text className={styles.defTarget}>{note.targetWord}</Text>
            <Text className={styles.defIpa}>{ipa}</Text>
          </Box>
        </Box>
      ) : null}

      {imageFields.map(([id, value]) => (
        <BackImage
          key={id}
          note={note}
          value={value}
          asset={imageCache.get(imageAssetId(note.id, id)) ?? repoImages.get(id)}
        />
      ))}

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
    </div>
  );
}
