import { useEffect, useMemo, useState } from 'react';
import { Box, Heading, InputField } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
import { audioAssetId, imageAssetId } from '@/features/srs/lib/helpers';
import { getImageAssetsByNote } from '@/features/srs/repositories/imageAssetRepository';
import { getAudioAssetsByNote } from '@/features/srs/repositories/audioAssetRepository';
import type { SrsAudioAsset, SrsFieldValue, SrsImageAsset, SrsNote, SrsStimulus } from '@/entities/srs/types';
import { stimulusLabel } from './srsLabels';
import {
  formatFieldValue,
  playAudio,
  playAudioUrl,
  playableUrl,
  SentenceText,
  sequentialAudio,
  useImageBlobUrl,
} from './srsCardShared';
import styles from './SrsReviewCard.module.css';

const FRONT_SKIP_FIELDS: ReadonlySet<string> = new Set(['sentence', 'ipa']);

function StimulusImage({
  value,
  asset,
  alt,
}: { value: SrsFieldValue; asset: SrsImageAsset | undefined; alt: string }): React.JSX.Element | null {
  const blobUrl = useImageBlobUrl(asset);
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);
  const src = (value.kind === 'image' ? playableUrl(value.value) : undefined) ?? blobUrl;
  if (!src) return null;
  return <img src={src} alt={alt} className={styles.stimulusImage} />;
}

interface StimulusViewProps {
  readonly noteId: string;
  readonly stimulus: SrsStimulus;
  readonly audioCache: ReadonlyMap<string, SrsAudioAsset>;
  readonly imageCache: ReadonlyMap<string, SrsImageAsset>;
  readonly repoAudio: ReadonlyMap<string, SrsAudioAsset>;
  readonly repoImages: ReadonlyMap<string, SrsImageAsset>;
  readonly skipFieldIds?: ReadonlySet<string>;
}

function StimulusView({
  noteId,
  stimulus,
  audioCache,
  imageCache,
  repoAudio,
  repoImages,
  skipFieldIds,
}: StimulusViewProps): React.JSX.Element {
  const entries = Object.entries(stimulus.payload).filter(([fieldId]) => !skipFieldIds?.has(fieldId));

  return (
    <Box className={styles.stimulus}>
      {entries.map(([fieldId, value]) => (
        <Box key={fieldId} className={styles.stimulusField}>
          {value.kind === 'image' ? (
            <StimulusImage
              value={value}
              asset={imageCache.get(imageAssetId(noteId, fieldId)) ?? repoImages.get(fieldId)}
              alt={stimulusLabel(stimulus.type)}
            />
          ) : value.kind === 'audio' ? (
            <StimulusAudioButton
              fieldId={fieldId}
              value={value}
              asset={audioCache.get(audioAssetId(noteId, fieldId, value.source)) ?? repoAudio.get(fieldId)}
            />
          ) : (
            <SentenceText sentence={formatFieldValue(value)} />
          )}
        </Box>
      ))}
    </Box>
  );
}

function StimulusAudioButton({
  fieldId,
  value,
  asset,
}: { fieldId: string; value: Extract<SrsFieldValue, { kind: 'audio' }>; asset: SrsAudioAsset | undefined }): React.JSX.Element | null {
  const url = playableUrl(value.value);
  if (!asset && !url) return null;
  return (
    <button
      type="button"
      className={styles.stimulusAudioButton}
      onClick={(e) => {
        e.stopPropagation();
        if (asset) playAudio(asset);
        else playAudioUrl(url!);
      }}
      aria-label={fieldId === 'sentAudio' ? t('srs.review.playSentence') : t('srs.review.playWord')}
    >
      <Icon name={fieldId === 'sentAudio' ? 'audioWave' : 'volumeHigh'} />
    </button>
  );
}

interface SrsReviewCardFrontProps {
  readonly note: SrsNote;
  readonly stimulus: SrsStimulus;
  readonly isSpelling: boolean;
  readonly typedInput: string;
  readonly onTypedInputChange: (value: string) => void;
  readonly inputId: string;
  readonly onFlip: () => void;
  readonly audioCache: ReadonlyMap<string, SrsAudioAsset>;
  readonly imageCache: ReadonlyMap<string, SrsImageAsset>;
}

export function SrsReviewCardFront({
  note,
  stimulus,
  isSpelling,
  typedInput,
  onTypedInputChange,
  inputId,
  onFlip,
  audioCache,
  imageCache,
}: SrsReviewCardFrontProps): React.JSX.Element {
  const [repoImages, setRepoImages] = useState<ReadonlyMap<string, SrsImageAsset>>(new Map());
  const [repoAudio, setRepoAudio] = useState<ReadonlyMap<string, SrsAudioAsset>>(new Map());

  const hasImageField = Object.values(stimulus.payload).some((v) => v.kind === 'image');
  const hasUnplayableAudio = Object.values(stimulus.payload).some((v) => v.kind === 'audio' && !playableUrl(v.value));

  useEffect(() => {
    if (!hasImageField) return;
    void getImageAssetsByNote(note.id)
      .then((assets) => { setRepoImages(new Map(assets.map((a) => [a.fieldId, a]))); })
      .catch(() => {});
  }, [note.id, hasImageField]);

  useEffect(() => {
    if (!hasUnplayableAudio) return;
    void getAudioAssetsByNote(note.id)
      .then((assets) => { setRepoAudio(new Map(assets.map((a) => [a.fieldId, a]))); })
      .catch(() => {});
  }, [note.id, hasUnplayableAudio]);

  const frontAudio = useMemo(() => {
    const sources: (SrsAudioAsset | string)[] = [];
    for (const fieldId of ['sentAudio', 'wordAudio'] as const) {
      const value = stimulus.payload[fieldId];
      if (value?.kind !== 'audio') continue;
      const url = playableUrl(value.value);
      const asset = audioCache.get(audioAssetId(note.id, fieldId, value.source)) ?? repoAudio.get(fieldId);
      const src = url ?? asset;
      if (src) sources.push(src);
    }
    return sources;
  }, [note.id, stimulus, audioCache, repoAudio]);

  useEffect(() => sequentialAudio(frontAudio), [frontAudio]);

  return (
    <div
      className={styles.front}
      role="button"
      tabIndex={0}
      data-cell-no-ripple
      onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('input,button,audio')) return;
        e.preventDefault();
      }}
      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('input,button,audio')) return;
        if (!isSpelling) onFlip();
      }}
      onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
        if (isSpelling) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onFlip();
        }
      }}
    >
      <Heading level={1} className={styles.targetWord}>{note.targetWord}</Heading>
      {note.fields.sentence?.kind === 'text' && note.fields.sentence.value && (
        <SentenceText sentence={note.fields.sentence.value} />
      )}
      <StimulusView
        noteId={note.id}
        stimulus={stimulus}
        audioCache={audioCache}
        imageCache={imageCache}
        repoAudio={repoAudio}
        repoImages={repoImages}
        skipFieldIds={FRONT_SKIP_FIELDS}
      />

      {isSpelling && (
        <InputField
          id={inputId}
          label={t('srs.review.typeWord')}
          value={typedInput}
          onChange={(e) => onTypedInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.stopPropagation();
              onFlip();
            }
          }}
          className={styles.spellingInput}
          autoFocus
        />
      )}
    </div>
  );
}
