import { useEffect, useState } from 'react';
import { Box, Button, Heading, Separator, Text } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
import { audioAssetId, imageAssetId } from '@/features/srs/lib/helpers';
import type { SrsAudioAsset, SrsFieldValue, SrsImageAsset, SrsNote } from '@/entities/srs/types';
import { HighlightedSentence, playAudio, useImageBlobUrl } from './srsCardShared';
import styles from './SrsReviewCard.module.css';

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
  return <Text>{value.value}</Text>;
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

  const hasAudio = Boolean(sentAudioAsset || wordAudioAsset);
  const hasTranslation = note.fields.translation?.kind === 'translation' && Boolean(note.fields.translation.value);

  return (
    <Box className={styles.back}>
      <Heading level={1} className={styles.targetWord}>{note.targetWord}</Heading>

      {note.fields.sentence?.kind === 'text' && (
        <HighlightedSentence sentence={note.fields.sentence.value} target={note.targetWord} />
      )}

      {hasAudio && (
        <Box className={styles.audioRow}>
          {sentAudioAsset && (
            <Button
              shape="circle"
              size="sm"
              variant="ghost"
              onClick={() => playAudio(sentAudioAsset)}
              aria-label={t('srs.review.playSentence')}
              className={styles.audioButton}
            >
              <Icon name="audioWave" />
            </Button>
          )}
          {wordAudioAsset && (
            <Button
              shape="circle"
              size="sm"
              variant="ghost"
              onClick={() => playAudio(wordAudioAsset)}
              aria-label={t('srs.review.playWord')}
              className={styles.audioButton}
            >
              <Icon name="volumeHigh" />
            </Button>
          )}
        </Box>
      )}

      {hasTranslation && (
        translationRevealed ? (
          <Text className={styles.translation}>{note.fields.translation?.kind === 'translation' ? note.fields.translation.value : ''}</Text>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { setTranslationRevealed(true); }}
            className={styles.seeTranslation}
          >
            {t('srs.review.seeTranslation')}
          </Button>
        )
      )}

      {note.fields.def?.kind === 'text' && (
        <>
          <Separator className={styles.divider} />
          <Box className={styles.defBlock}>
            <Box className={styles.defHeader}>
              <Text className={styles.defTarget}>{note.targetWord}</Text>
              {note.fields.ipa?.kind === 'text' && (
                <Text className={styles.defIpa}>/{note.fields.ipa.value}/</Text>
              )}
              <Text className={styles.defStar} aria-hidden="true">★</Text>
            </Box>
            <BackFieldValue value={note.fields.def} />
          </Box>
        </>
      )}

      {imageUrl && (
        <Box className={styles.imageBlock}>
          <img src={imageUrl} alt={note.targetWord} className={styles.image} />
        </Box>
      )}

      {note.fields.notes?.kind === 'text' && note.fields.notes.value && (
        <Box className={styles.notesBlock}>
          <Heading level={3} className={styles.notesTitle}>{t('srs.review.notes')}</Heading>
          <BackFieldValue value={note.fields.notes} />
        </Box>
      )}
    </Box>
  );
}
