import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Input } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
import { audioAssetId, imageAssetId, mediaFieldValues } from '@/features/srs/lib/helpers';
import { getImageAssetsByNote } from '@/features/srs/repositories/imageAssetRepository';
import { getAudioAssetsByNote } from '@/features/srs/repositories/audioAssetRepository';
import type { SrsAudioAsset, SrsImageAsset, SrsNote, SrsStimulus } from '@/entities/srs/types';
import { stimulusLabel } from './srsLabels';
import {
  formatFieldValue,
  playAudio,
  playAudioUrl,
  playableUrl,
  ReviewImageGallery,
  SentenceText,
  sequentialAudio,
  TargetWordHeading,
} from './srsCardShared';
import styles from './SrsReviewCard.module.css';

const FRONT_SKIP_FIELDS: ReadonlySet<string> = new Set(['sentence']);

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
          {value.kind === 'image'
            ? (
              <ReviewImageGallery
                items={mediaFieldValues(value).map((v, i) => ({
                  key: `${fieldId}:${i}`,
                  src: v,
                  asset: imageCache.get(imageAssetId(noteId, fieldId, i)) ?? repoImages.get(`${fieldId}:${i}`),
                }))}
                alt={stimulusLabel(stimulus.type)}
                dataTihokaId={`srs-front-images-${fieldId}`}
              />
            )
            : value.kind === 'audio'
              ? mediaFieldValues(value).map((v, i) => (
                  <StimulusAudioButton
                    key={i}
                    fieldId={fieldId}
                    src={v}
                    asset={audioCache.get(audioAssetId(noteId, fieldId, value.source, i)) ?? repoAudio.get(`${fieldId}:${i}`)}
                  />
                ))
              : <SentenceText sentence={formatFieldValue(value)} />}
        </Box>
      ))}
    </Box>
  );
}

const StimulusAudioButton = memo(function StimulusAudioButton({
  fieldId,
  src,
  asset,
}: { fieldId: string; src: string; asset: SrsAudioAsset | undefined }): React.JSX.Element | null {
  const url = playableUrl(src);
  if (!asset && !url) return null;
  return (
    <button
      type="button"
      className={styles.stimulusAudioButton}
      onPointerDown={(e) => e.preventDefault()}
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
});

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
  const hasUnplayableAudio = Object.values(stimulus.payload).some(
    (v) => v.kind === 'audio' && mediaFieldValues(v).some((item) => !playableUrl(item)),
  );

  useEffect(() => {
    if (!hasImageField) return;
    void getImageAssetsByNote(note.id)
      .then((assets) => { setRepoImages(new Map(assets.map((a) => [`${a.fieldId}:${a.index ?? 0}`, a]))); })
      .catch(() => {});
  }, [note.id, hasImageField]);

  useEffect(() => {
    if (!hasUnplayableAudio) return;
    void getAudioAssetsByNote(note.id)
      .then((assets) => { setRepoAudio(new Map(assets.map((a) => [`${a.fieldId}:${a.index ?? 0}`, a]))); })
      .catch(() => {});
  }, [note.id, hasUnplayableAudio]);

  const sentAudioValue = stimulus.payload['sentAudio'];
  const wordAudioValue = stimulus.payload['wordAudio'];
  const frontAudio = useMemo(() => {
    const sources: (SrsAudioAsset | string)[] = [];
    for (const [fieldId, value] of [['sentAudio', sentAudioValue], ['wordAudio', wordAudioValue]] as const) {
      if (value?.kind !== 'audio') continue;
      mediaFieldValues(value).forEach((v, i) => {
        const url = playableUrl(v);
        const asset = audioCache.get(audioAssetId(note.id, fieldId, value.source, i)) ?? repoAudio.get(`${fieldId}:${i}`);
        const src = url ?? asset;
        if (src) sources.push(src);
      });
    }
    return sources;
  }, [note.id, sentAudioValue, wordAudioValue, audioCache, repoAudio]);

  const playback = useRef<(() => void) | null>(null);
  const replayAudio = (): void => {
    playback.current?.();
    playback.current = sequentialAudio(frontAudio);
  };
  useEffect(() => {
    playback.current = sequentialAudio(frontAudio);
    return () => {
      playback.current?.();
      playback.current = null;
    };
  }, [frontAudio]);

  return (
    <div
      className={styles.front}
      role="button"
      tabIndex={0}
      data-tihoka-no-ripple
      onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('input,button,audio')) return;
        e.preventDefault();
      }}
      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('input,button,audio')) return;
        if (!isSpelling) onFlip();
      }}
      onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('button,input,audio,a,textarea,select')) return;
        if (isSpelling) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onFlip();
        }
      }}
    >
      <TargetWordHeading text={note.targetWord} />
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
        <Input
          id={inputId}
          placeholder={t('srs.review.typeWord')}
          aria-label={t('srs.review.typeWord')}
          value={typedInput}
          onChange={(e) => onTypedInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.stopPropagation();
              onFlip();
            } else if (e.key === 'Control') {
              replayAudio();
            }
          }}
          autoFocus
        />
      )}
    </div>
  );
}
