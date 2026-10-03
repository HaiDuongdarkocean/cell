import { memo, useEffect, useMemo, useState } from 'react';
import { Box, Button, Text } from '@/shared/ui';
import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
import { audioAssetId, imageAssetId, mediaFieldValues } from '@/features/srs/lib/helpers';
import { parseDefEntries } from '@/features/srs/lib/defEntry';
import { getImageAssetsByNote } from '@/features/srs/repositories/imageAssetRepository';
import { getAudioAssetsByNote } from '@/features/srs/repositories/audioAssetRepository';
import type { SrsAudioAsset, SrsFieldValue, SrsImageAsset, SrsNote } from '@/entities/srs/types';
import { playableUrl, ReviewImageGallery, SentenceText, sequentialAudio, TargetWordHeading } from './srsCardShared';
import { alignDictation } from '@/features/srs/lib/dictationDiff';
import styles from './SrsReviewCard.module.css';

function playSources(sources: readonly (SrsAudioAsset | string)[]): void {
  sequentialAudio(sources);
}

const BUILTIN_FIELDS = new Set(['target', 'ipa', 'sentence', 'def', 'wordAudio', 'sentAudio', 'image', 'translation', 'notes', 'examples']);

const FIELD_LABEL_KEYS: Record<string, Parameters<typeof t>[0]> = {
  examples: 'srs.review.examples',
  notes: 'srs.review.notes',
};

function fieldText(value: SrsFieldValue | undefined): string {
  if (!value) return '';
  if (value.kind === 'list') return value.value.join('\n');
  return typeof value.value === 'string' ? value.value : value.value.join('\n');
}

function fieldLabel(fieldId: string): string {
  const key = FIELD_LABEL_KEYS[fieldId];
  if (key) return t(key);
  return fieldId.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

function MarkedText({ text, marks, markClass }: { text: string; marks: readonly boolean[]; markClass: string }): React.JSX.Element {
  return (
    <span className={styles.dictationText}>
      {[...text].map((ch, i) => (
        <span key={i} className={marks[i] ? undefined : markClass}>{ch === ' ' ? ' ' : ch}</span>
      ))}
    </span>
  );
}

const DictationResult = memo(function DictationResult({ typed, expected }: { typed: string; expected: string }): React.JSX.Element | null {
  const alignment = useMemo(() => alignDictation(expected, typed), [expected, typed]);
  if (!alignment.typed) return null;
  return (
    <Box className={`${styles.dictationResult} ${alignment.correct ? styles.dictationOk : styles.dictationBad}`}>
      <Text className={styles.dictationVerdict}>
        <Icon name={alignment.correct ? 'check' : 'x'} size="xs" />
        {t(alignment.correct ? 'srs.review.dictationCorrect' : 'srs.review.dictationIncorrect')}
      </Text>
      <Text className={styles.dictationRow}>
        <span className={styles.dictationLabel}>{t('srs.review.youTyped')}</span>
        <MarkedText text={alignment.typed} marks={alignment.typedMarks} markClass={styles.dictationMiss} />
      </Text>
      {!alignment.correct && (
        <Text className={styles.dictationRow}>
          <span className={styles.dictationLabel}>{t('srs.review.dictationExpected')}</span>
          <MarkedText text={alignment.expected} marks={alignment.expectedMarks} markClass={styles.dictationMiss} />
        </Text>
      )}
    </Box>
  );
});

const TranslationToggle = memo(function TranslationToggle({ text }: { text: string }): React.JSX.Element {
  const [revealed, setRevealed] = useState(false);
  return (
    <button
      type="button"
      className={`${styles.translationBox} ${revealed ? styles.translationBoxOpen : ''}`}
      aria-expanded={revealed}
      onClick={(e) => { e.stopPropagation(); setRevealed((v) => !v); }}
    >
      {revealed ? text : t('srs.review.sentenceTranslation')}
    </button>
  );
});

function audioSourcesEqual(a: readonly (SrsAudioAsset | string)[], b: readonly (SrsAudioAsset | string)[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

const BackAudioRow = memo(function BackAudioRow({
  sentSources,
  wordSources,
}: {
  sentSources: readonly (SrsAudioAsset | string)[];
  wordSources: readonly (SrsAudioAsset | string)[];
}): React.JSX.Element {
  return (
    <Box className={styles.audioRow}>
      {sentSources.length > 0 && (
        <Button
          size="md"
          variant="primary"
          onClick={() => playSources(sentSources)}
          aria-label={t('srs.review.playSentence')}
        >
          <Icon name="audioWave" />
        </Button>
      )}
      {wordSources.length > 0 && (
        <Button
          shape="circle"
          size="md"
          variant="primary"
          onClick={() => playSources(wordSources)}
          aria-label={t('srs.review.playWord')}
        >
          <Icon name="volumeHigh" />
        </Button>
      )}
    </Box>
  );
}, (prev, next) => audioSourcesEqual(prev.sentSources, next.sentSources) && audioSourcesEqual(prev.wordSources, next.wordSources));

const DefList = memo(function DefList({ text }: { text: string }): React.JSX.Element {
  return (
    <div className={styles.defList}>
      {parseDefEntries(text).map((entry, i) => (
        <DefEntryBlock key={i} entry={entry} />
      ))}
    </div>
  );
});

const FieldBlock = memo(function FieldBlock({ label, value }: { label: string; value: SrsFieldValue }): React.JSX.Element {
  return (
    <FieldBox label={label}>
      <BackFieldValue value={value} />
    </FieldBox>
  );
});

const FieldTextBlock = memo(function FieldTextBlock({ label, text }: { label: string; text: string }): React.JSX.Element {
  return (
    <FieldBox label={label}>
      <Text className={styles.fieldText}>{text}</Text>
    </FieldBox>
  );
});

function FieldBox({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <fieldset className={styles.fieldBox}>
      <legend className={styles.fieldBoxLabel}>{label}</legend>
      {children}
    </fieldset>
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
  const text = 'value' in value ? (typeof value.value === 'string' ? value.value : value.value.join('\n')) : '';
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
  readonly dictation?: { typed: string; expected: string } | null;
}

export function SrsReviewCardBack({
  note,
  audioCache,
  imageCache,
  onFlipBack,
  dictation,
}: SrsReviewCardBackProps): React.JSX.Element {
  const wordAudio = note.fields.wordAudio?.kind === 'audio' ? note.fields.wordAudio : undefined;
  const sentAudio = note.fields.sentAudio?.kind === 'audio' ? note.fields.sentAudio : undefined;
  const imageFields = Object.entries(note.fields).filter(([, v]) => v.kind === 'image');
  const imageCount = imageFields.reduce((n, [, v]) => n + mediaFieldValues(v).length, 0);

  const [repoImages, setRepoImages] = useState<ReadonlyMap<string, SrsImageAsset>>(new Map());
  const [repoAudio, setRepoAudio] = useState<ReadonlyMap<string, SrsAudioAsset>>(new Map());

  const audioSources = (value: typeof wordAudio, fieldId: string): (SrsAudioAsset | string)[] => {
    if (!value) return [];
    const out: (SrsAudioAsset | string)[] = [];
    mediaFieldValues(value).forEach((v, i) => {
      const src = playableUrl(v) ?? audioCache.get(audioAssetId(note.id, fieldId, value.source, i)) ?? repoAudio.get(`${fieldId}:${i}`);
      if (src) out.push(src);
    });
    return out;
  };

  const wordAudioSources = audioSources(wordAudio, 'wordAudio');
  const sentAudioSources = audioSources(sentAudio, 'sentAudio');
  const hasWordAudio = wordAudioSources.length > 0;
  const hasSentAudio = sentAudioSources.length > 0;

  useEffect(() => {
    if (imageCount === 0) return;
    void getImageAssetsByNote(note.id)
      .then((assets) => { setRepoImages(new Map(assets.map((a) => [`${a.fieldId}:${a.index ?? 0}`, a]))); })
      .catch(() => {});
  }, [note.id, imageCount]);

  useEffect(() => {
    if (!(wordAudio && !hasWordAudio) && !(sentAudio && !hasSentAudio)) return;
    void getAudioAssetsByNote(note.id)
      .then((assets) => { setRepoAudio(new Map(assets.map((a) => [`${a.fieldId}:${a.index ?? 0}`, a]))); })
      .catch(() => {});
  }, [note.id, wordAudio, sentAudio, hasWordAudio, hasSentAudio]);

  const backAudio = useMemo(
    () => [...sentAudioSources, ...wordAudioSources],
    [note.id, wordAudio, sentAudio, audioCache, repoAudio],
  );

  useEffect(() => sequentialAudio(backAudio), [backAudio]);

  const imageItems = useMemo(() => {
    const items: { key: string; src: string; asset: SrsImageAsset | undefined }[] = [];
    for (const [id, value] of Object.entries(note.fields)) {
      if (value.kind !== 'image') continue;
      mediaFieldValues(value).forEach((v, i) => {
        items.push({
          key: `${id}:${i}`,
          src: v,
          asset: imageCache.get(imageAssetId(note.id, id, i)) ?? repoImages.get(`${id}:${i}`),
        });
      });
    }
    return items;
  }, [note.id, note.fields, imageCache, repoImages]);

  const hasTranslation = note.fields.translation?.kind === 'translation' && Boolean(note.fields.translation.value);
  const extraFields = Object.entries(note.fields).filter(([id, v]) => !BUILTIN_FIELDS.has(id) && v.kind !== 'image' && v.kind !== 'audio' && fieldText(v).trim());

  return (
    <div
      className={styles.back}
      role="button"
      tabIndex={0}
      data-cell-no-ripple
      onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('button,input,audio,a,textarea,select')) return;
        e.preventDefault();
      }}
      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('button,input,audio,a,textarea,select')) return;
        onFlipBack();
      }}
      onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('button,input,audio,a,textarea,select')) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onFlipBack();
        }
      }}
    >
      <div className={styles.backHead}>
        {dictation && dictation.expected && (
          <DictationResult typed={dictation.typed} expected={dictation.expected} />
        )}

        <TargetWordHeading text={note.targetWord} />

        {note.fields.sentence?.kind === 'text' && (
          <SentenceText sentence={note.fields.sentence.value} />
        )}

        {hasTranslation && (
          <TranslationToggle text={fieldText(note.fields.translation)} />
        )}
      </div>

      {(hasSentAudio || hasWordAudio) && (
        <BackAudioRow sentSources={sentAudioSources} wordSources={wordAudioSources} />
      )}

      {note.fields.def && (
        <DefList text={fieldText(note.fields.def)} />
      )}

      <ReviewImageGallery items={imageItems} alt={note.targetWord} dataCellId="srs-card-images" />

      {note.fields.examples && fieldText(note.fields.examples).trim() && (
        <FieldTextBlock label={fieldLabel('examples')} text={fieldText(note.fields.examples)} />
      )}

      {note.fields.notes && fieldText(note.fields.notes).trim() && (
        <FieldBlock label={fieldLabel('notes')} value={note.fields.notes} />
      )}

      {extraFields.map(([id, value]) => (
        <FieldBlock key={id} label={fieldLabel(id)} value={value} />
      ))}
    </div>
  );
}
