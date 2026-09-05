import { useEffect, useMemo } from 'react';
import { Box, Button, Heading, Text } from '@/shared/ui';
import { Icon } from '@/shared/icons/Icon';
import { audioAssetId, imageAssetId, normalizeSpelling } from '@/features/srs/lib/helpers';
import type { ComponentType, SrsAudioAsset, SrsFieldValue, SrsImageAsset, SrsNote } from '@/entities/srs/types';
import styles from './SrsReviewCard.module.css';

function playAudio(asset: SrsAudioAsset): void {
  const blob = new Blob([asset.bytes], { type: asset.mimeType });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play().catch(() => {});
  audio.onended = () => {
    URL.revokeObjectURL(url);
  };
}

function useImageBlobUrl(asset: SrsImageAsset | undefined): string | undefined {
  return useMemo(() => {
    if (!asset) return undefined;
    const blob = new Blob([asset.bytes], { type: asset.mimeType });
    return URL.createObjectURL(blob);
  }, [asset]);
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
  return <Text>{value.value}</Text>;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function HighlightedSentence({ sentence, target }: { sentence: string; target: string }): React.JSX.Element {
  const normalizedTarget = normalizeSpelling(target);
  const regex = new RegExp(`(${escapeRegExp(normalizedTarget)})`, 'gi');
  const parts = sentence.split(regex);
  return (
    <Text className={styles.sentence}>
      {parts.map((part, i) =>
        normalizeSpelling(part) === normalizedTarget ? (
          <strong key={i} className={styles.sentenceTarget}>{part}</strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </Text>
  );
}

interface SrsReviewCardBackProps {
  readonly note: SrsNote;
  readonly componentType: ComponentType;
  readonly audioCache: ReadonlyMap<string, SrsAudioAsset>;
  readonly imageCache: ReadonlyMap<string, SrsImageAsset>;
  readonly onSubmit: (judgment: 'forget' | 'remember') => void;
  readonly markStudyAgain: (componentType: ComponentType) => void;
  readonly resetCurrentComponent: () => Promise<void>;
  readonly resetCurrentCard: () => Promise<void>;
}

export function SrsReviewCardBack({
  note,
  componentType,
  audioCache,
  imageCache,
  onSubmit,
  markStudyAgain,
  resetCurrentComponent,
  resetCurrentCard,
}: SrsReviewCardBackProps): React.JSX.Element {
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

  return (
    <Box className={styles.back}>
      <Box className={styles.backHeader}>
        <Text className={styles.badgeNew}>New</Text>
        <Heading level={1} className={styles.targetWord}>{note.targetWord}</Heading>
      </Box>

      {note.fields.sentence?.kind === 'text' && (
        <Box className={styles.sentenceBlock}>
          <HighlightedSentence sentence={note.fields.sentence.value} target={note.targetWord} />

          <Box className={styles.audioRow}>
            {sentAudioAsset && (
              <Button
                shape="circle"
                size="sm"
                variant="ghost"
                onClick={() => playAudio(sentAudioAsset)}
                aria-label="Play sentence audio"
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
                aria-label="Play word audio"
                className={styles.audioButton}
              >
                <Icon name="volumeHigh" />
              </Button>
            )}
          </Box>

          {note.fields.translation?.kind === 'translation' && (
            <Text className={styles.translation}>{note.fields.translation.value}</Text>
          )}
        </Box>
      )}

      {note.fields.def?.kind === 'text' && (
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
      )}

      {imageUrl && (
        <Box className={styles.imageBlock}>
          <img src={imageUrl} alt={note.targetWord} className={styles.image} />
        </Box>
      )}

      {note.fields.notes?.kind === 'text' && note.fields.notes.value && (
        <Box className={styles.notesBlock}>
          <Heading level={3} className={styles.notesTitle}>NOTES</Heading>
          <BackFieldValue value={note.fields.notes} />
        </Box>
      )}

      <Box className={styles.rating}>
        <Button
          shape="circle"
          size="lg"
          variant="ghost"
          onClick={() => onSubmit('forget')}
          aria-label="Forget"
          className={[styles.ratingButton, styles.forgetButton].join(' ')}
        >
          <Icon name="x" />
        </Button>
        <Button
          shape="circle"
          size="lg"
          variant="primary"
          onClick={() => onSubmit('remember')}
          aria-label="Remember"
          className={[styles.ratingButton, styles.rememberButton].join(' ')}
        >
          <Icon name="check" />
        </Button>
      </Box>

      <Box className={styles.actions}>
        <Button variant="ghost" onClick={() => markStudyAgain(componentType)}>Study again</Button>
        <Button
          variant="ghost"
          onClick={() => {
            if (window.confirm(`Reset progress for ${componentType}?`)) {
              void resetCurrentComponent();
            }
          }}
        >
          Reset component
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            if (window.confirm('Reset all components for this card?')) {
              void resetCurrentCard();
            }
          }}
        >
          Reset card
        </Button>
      </Box>
    </Box>
  );
}
