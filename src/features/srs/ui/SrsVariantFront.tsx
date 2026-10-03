import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Box, InputField } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
import { audioAssetId, imageAssetId, mediaFieldValues } from '@/features/srs/lib/helpers';
import { getImageAssetsByNote } from '@/features/srs/repositories/imageAssetRepository';
import { getAudioAssetsByNote } from '@/features/srs/repositories/audioAssetRepository';
import type {
  ResolvedVariantToggles,
  SrsAudioAsset,
  SrsFieldValue,
  SrsImageAsset,
  SrsNote,
  SrsStimulus,
  SrsVariant,
  VariantAudioToggle,
  VariantScopeToggle,
} from '@/entities/srs/types';
import { SRS_INPUT_FIELD_ID } from '@/entities/srs/types';
import { expectedInputField } from '@/features/srs/lib/variantFront';
import { variantLabel } from './srsLabels';
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

/** Ordered field ids to render — payload presence + toggle filtering (mirrors visibleVariantFields on resolved payload). */
function frontFieldIds(
  variant: SrsVariant,
  stimulus: SrsStimulus,
  toggles: ResolvedVariantToggles,
): readonly string[] {
  return variant.fieldIds.filter((fid) => {
    if (fid === SRS_INPUT_FIELD_ID) return true;
    if (stimulus.payload[fid] === undefined) return false;
    if (fid === 'target') return toggles.scope !== 'sentence';
    if (fid === 'sentence') return toggles.scope !== 'word';
    if (fid === 'wordAudio') return !toggles.audioToggle || toggles.audio === 'word';
    if (fid === 'sentAudio') return !toggles.audioToggle || toggles.audio === 'sentence';
    return true;
  });
}

const SCOPE_ORDER: readonly VariantScopeToggle[] = ['both', 'word', 'sentence'];
const SCOPE_LABEL_KEYS = {
  both: 'srs.variant.scope.both',
  word: 'srs.variant.scope.word',
  sentence: 'srs.variant.scope.sentence',
} as const;
const AUDIO_LABEL_KEYS = {
  word: 'srs.variant.audio.word',
  sentence: 'srs.variant.audio.sentence',
} as const;

export function nextScopeToggle(current: VariantScopeToggle): VariantScopeToggle {
  return SCOPE_ORDER[(SCOPE_ORDER.indexOf(current) + 1) % SCOPE_ORDER.length];
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

export interface SrsVariantFrontProps {
  readonly variant: SrsVariant;
  readonly note: SrsNote;
  readonly stimulus: SrsStimulus;
  readonly toggles: ResolvedVariantToggles;
  readonly onScopeChange?: (scope: VariantScopeToggle) => void;
  readonly onAudioChange?: (audio: VariantAudioToggle) => void;
  readonly typedInput?: string;
  readonly onTypedInputChange?: (value: string) => void;
  readonly inputId?: string;
  readonly onFlip?: () => void;
  readonly audioCache: ReadonlyMap<string, SrsAudioAsset>;
  readonly imageCache: ReadonlyMap<string, SrsImageAsset>;
  /** Preview mode: no autoplay, input is inert, card doesn't flip on click. */
  readonly preview?: boolean;
}

export function SrsVariantFront({
  variant,
  note,
  stimulus,
  toggles,
  onScopeChange,
  onAudioChange,
  typedInput,
  onTypedInputChange,
  inputId,
  onFlip,
  audioCache,
  imageCache,
  preview = false,
}: SrsVariantFrontProps): React.JSX.Element {
  const [repoImages, setRepoImages] = useState<ReadonlyMap<string, SrsImageAsset>>(new Map());
  const [repoAudio, setRepoAudio] = useState<ReadonlyMap<string, SrsAudioAsset>>(new Map());

  const hasInput = variant.fieldIds.includes(SRS_INPUT_FIELD_ID);
  const expectedField = useMemo(
    () => expectedInputField(variant, note, toggles),
    [variant, note, toggles],
  );

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

  const fields = useMemo(
    () => frontFieldIds(variant, stimulus, toggles),
    [variant, stimulus, toggles],
  );

  // Dictation fronts autoplay the selected audio once — listening is the task.
  const autoplayFieldId = toggles.audio === 'sentence' ? 'sentAudio' : 'wordAudio';
  const autoplayValue = stimulus.payload[autoplayFieldId];
  const audioSources = useMemo(() => {
    if (!hasInput) return [];
    const value = autoplayValue;
    if (value?.kind !== 'audio') return [];
    const sources: (SrsAudioAsset | string)[] = [];
    mediaFieldValues(value).forEach((v, i) => {
      const url = playableUrl(v);
      const asset = audioCache.get(audioAssetId(note.id, autoplayFieldId, value.source, i)) ?? repoAudio.get(`${autoplayFieldId}:${i}`);
      const src = url ?? asset;
      if (src) sources.push(src);
    });
    return sources;
  }, [hasInput, autoplayFieldId, autoplayValue, audioCache, repoAudio, note.id]);

  const autoplayed = useRef<string | null>(null);
  useEffect(() => {
    if (preview || !hasInput || audioSources.length === 0) return;
    const key = `${note.id}:${variant.id}:${toggles.audio}`;
    if (autoplayed.current === key) return;
    autoplayed.current = key;
    return sequentialAudio(audioSources);
  }, [preview, hasInput, audioSources, note.id, variant.id, toggles.audio]);

  const flippable = !hasInput && !preview;

  return (
    <div
      className={styles.front}
      role={flippable ? 'button' : undefined}
      tabIndex={flippable ? 0 : undefined}
      data-cell-no-ripple
      onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('input,button,audio')) return;
        e.preventDefault();
      }}
      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('input,button,audio')) return;
        if (flippable) onFlip?.();
      }}
      onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('button,input,audio,a,textarea,select')) return;
        if (!flippable) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onFlip?.();
        }
      }}
    >
      {(toggles.scopeToggle || toggles.audioToggle) && (
        <Box className={styles.frontToggles}>
          {toggles.scopeToggle && (
            <button
              type="button"
              className={styles.frontToggle}
              onClick={(e) => {
                e.stopPropagation();
                onScopeChange?.(nextScopeToggle(toggles.scope));
              }}
              aria-label={t('srs.variant.toggleScope')}
            >
              {t(SCOPE_LABEL_KEYS[toggles.scope])}
            </button>
          )}
          {toggles.audioToggle && (
            <button
              type="button"
              className={styles.frontToggle}
              onClick={(e) => {
                e.stopPropagation();
                onAudioChange?.(toggles.audio === 'word' ? 'sentence' : 'word');
              }}
              aria-label={t('srs.variant.toggleAudio')}
            >
              <Icon name={toggles.audio === 'word' ? 'volumeHigh' : 'audioWave'} size="xs" />
              {t(AUDIO_LABEL_KEYS[toggles.audio])}
            </button>
          )}
        </Box>
      )}

      {fields.map((fieldId) => {
        if (fieldId === SRS_INPUT_FIELD_ID) {
          if (!onTypedInputChange) return null;
          return (
            <InputField
              key={fieldId}
              id={inputId}
              label={expectedField === 'sentence' ? t('srs.review.typeSentence') : t('srs.review.typeWord')}
              value={typedInput ?? ''}
              onChange={(e) => onTypedInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation();
                  onFlip?.();
                }
              }}
              className={styles.spellingInput}
              autoFocus={!preview}
              readOnly={preview}
            />
          );
        }
        const value = stimulus.payload[fieldId];
        if (!value) return null;
        if (fieldId === 'target' && value.kind === 'text') {
          return <TargetWordHeading key={fieldId} text={value.value} />;
        }
        return (
          <Box key={fieldId} className={styles.stimulusField}>
            {value.kind === 'image' ? (
              <ReviewImageGallery
                items={mediaFieldValues(value).map((v, i) => ({
                  key: `${fieldId}:${i}`,
                  src: v,
                  asset: imageCache.get(imageAssetId(note.id, fieldId, i)) ?? repoImages.get(`${fieldId}:${i}`),
                }))}
                alt={variantLabel(variant)}
                dataCellId={`srs-front-images-${fieldId}`}
              />
            ) : value.kind === 'audio' ? (
              mediaFieldValues(value).map((v, i) => (
                <StimulusAudioButton
                  key={i}
                  fieldId={fieldId}
                  src={v}
                  asset={audioCache.get(audioAssetId(note.id, fieldId, value.source, i)) ?? repoAudio.get(`${fieldId}:${i}`)}
                />
              ))
            ) : (
              <SentenceText sentence={formatFieldValue(value as SrsFieldValue)} />
            )}
          </Box>
        );
      })}
    </div>
  );
}
