import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  EmptyState,
  Heading,
  Icon,
  IconButton,
  Select,
  SegmentedControl,
  Spinner,
  Text,
  Toggle,
} from '@/shared/ui';
import { t } from '@/shared/i18n';
import { usePumpPlayer } from '../services/usePumpPlayer';
import { listPumpDecks } from '../services/pumpSources';
import styles from './PumpView.module.css';

type RepeatValue = '1' | '2' | '3';
type GapValue = '0' | '1' | '2' | '4';

const REPEAT_OPTIONS: readonly { value: RepeatValue; label: string }[] = [
  { value: '1', label: '1×' },
  { value: '2', label: '2×' },
  { value: '3', label: '3×' },
];

const GAP_OPTIONS: readonly { value: GapValue; label: string }[] = [
  { value: '0', label: 'off' },
  { value: '1', label: '1s' },
  { value: '2', label: '2s' },
  { value: '4', label: '4s' },
];

export interface PumpViewProps {
  readonly onBack: () => void;
  readonly initialDeckId?: string;
}

export function PumpView({ onBack, initialDeckId }: PumpViewProps): React.JSX.Element {
  const pump = usePumpPlayer();
  const { state } = pump;
  const [deckId, setDeckId] = useState<string | null>(initialDeckId ?? null);
  const [includeQueue, setIncludeQueue] = useState(true);
  const [includeSubdecks] = useState(true);
  const [repeat, setRepeat] = useState<RepeatValue>('1');
  const [gap, setGap] = useState<GapValue>('1');
  const [shuffleOn, setShuffleOn] = useState(false);
  const [revealed, setRevealed] = useState(true);
  const [decks, setDecks] = useState<readonly { id: string; label: string }[]>([]);

  useEffect(() => {
    void listPumpDecks().then(setDecks);
  }, []);

  const rebuild = useCallback(async () => {
    return pump.build(deckId, includeSubdecks, includeQueue);
  }, [pump, deckId, includeSubdecks, includeQueue]);

  const deckOptions = useMemo(
    () => [{ value: 'all', label: t('pump.setup.allDecks') }, ...decks.map((d) => ({ value: d.id, label: d.label }))],
    [decks],
  );

  const startConfig = {
    repeat: Number(repeat) as 1 | 2 | 3,
    gapSeconds: Number(gap) as 0 | 1 | 2 | 4,
    shuffle: shuffleOn,
  };
  const startSession = (): void => {
    void rebuild().then((items) => {
      if (items.length > 0) pump.start(items, startConfig);
    });
  };

  const item = state.items[state.index];
  const playing = state.phase === 'playing';
  const paused = state.phase === 'paused';
  const ttsItem = item !== undefined && !item.audioUrl;

  return (
    <Box className={styles.view}>
      <Box className={styles.header}>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <Icon name="chevronLeft" /> {t('ui.back')}
        </Button>
        <Heading level={1} className={styles.title}>{t('pump.title')}</Heading>
      </Box>

      {state.phase === 'empty' ? (
        <EmptyState
          size="compact"
          icon={<Icon name="audioWave" />}
          title={t('pump.empty.title')}
          description={t('pump.empty.desc')}
        />
      ) : (
        <>
          <Box className={styles.card}>
            <Box className={styles.row}>
              <Text className={styles.label}>{t('pump.setup.deck')}</Text>
              <Select
                value={deckId ?? 'all'}
                options={deckOptions}
                onChange={(v) => setDeckId(v === 'all' ? null : v)}
                size="md"
                className={styles.deckSelect}
                aria-label={t('pump.setup.deck')}
              />
            </Box>
            <Box className={styles.row}>
              <Text className={styles.label}>{t('pump.setup.includeQueue')}</Text>
              <Toggle checked={includeQueue} onChange={setIncludeQueue} ariaLabel={t('pump.setup.includeQueue')} size="sm" />
            </Box>
            <Box className={styles.row}>
              <Text className={styles.label}>{t('pump.setup.repeat')}</Text>
              <SegmentedControl<RepeatValue>
                options={REPEAT_OPTIONS}
                value={repeat}
                onChange={(v) => { setRepeat(v); pump.setRepeat(Number(v)); }}
                ariaLabel={t('pump.setup.repeat')}
                variant="raised"
              />
            </Box>
            <Box className={styles.row}>
              <Text className={styles.label}>{t('pump.setup.gap')}</Text>
              <SegmentedControl<GapValue>
                options={GAP_OPTIONS}
                value={gap}
                onChange={(v) => { setGap(v); pump.setGap(Number(v)); }}
                ariaLabel={t('pump.setup.gap')}
                variant="raised"
              />
            </Box>
            <Box className={styles.row}>
              <Text className={styles.label}>{t('pump.setup.shuffle')}</Text>
              <Toggle checked={shuffleOn} onChange={setShuffleOn} ariaLabel={t('pump.setup.shuffle')} size="sm" />
            </Box>
            {state.phase === 'error' && (
              <Text className={styles.error}>{state.error ?? t('pump.error.load')}</Text>
            )}
            <Button
              variant="primary"
              size="lg"
              className={styles.startBtn}
              disabled={state.phase === 'building'}
              onClick={startSession}
            >
              {state.phase === 'building' ? <Spinner size="sm" /> : <Icon name="navPlay" />}
              {' '}
              {state.phase === 'building' ? t('pump.setup.building') : t('pump.setup.start')}
            </Button>
          </Box>

          {state.phase === 'done' ? (
            <Box className={`${styles.card} ${styles.summary}`}>
              <Heading level={2} className={styles.summaryTitle}>{t('pump.done.title')}</Heading>
              <Text className={styles.meta}>
                {t('pump.done.stats', [String(state.played), String(state.skipped)])}
              </Text>
              <Box className={styles.summaryActions}>
                <Button variant="primary" onClick={startSession}>
                  <Icon name="repeat" /> {t('pump.done.again')}
                </Button>
                <Button variant="secondary" onClick={() => pump.stop()}>
                  {t('pump.done.changeSources')}
                </Button>
              </Box>
            </Box>
          ) : item && (playing || paused) ? (
            <Box className={`${styles.card} ${styles.stage}`}>
              <Box className={styles.metaRow}>
                <Chip status={item.source === 'srs' ? 'learning' : 'tracking'}>
                  {item.source === 'srs' ? t('pump.stage.due') : t('pump.stage.queue')}
                </Chip>
                <Text className={styles.meta}>
                  {t('pump.stage.position', [String(state.index + 1), String(state.items.length)])}
                </Text>
                {state.skipped > 0 && (
                  <Text className={styles.meta}>{t('pump.stage.skipped', [String(state.skipped)])}</Text>
                )}
                <IconButton
                  variant="ghost"
                  size="sm"
                  aria-label={revealed ? t('pump.stage.hideText') : t('pump.stage.showText')}
                  onClick={() => setRevealed((v) => !v)}
                >
                  <Icon name={revealed ? 'eye' : 'eyeOff'} />
                </IconButton>
              </Box>
              <Box className={styles.sentenceWrap}>
                {revealed ? (
                  <Text className={styles.sentence}>{item.sentence}</Text>
                ) : (
                  <Text className={styles.sentenceMuted}>・・・・・・・</Text>
                )}
                {item.term && <Chip color="muted">{item.term}</Chip>}
              </Box>
              <Box className={styles.transport}>
                <IconButton variant="ghost" size="lg" aria-label={t('pump.stage.prev')} onClick={pump.prev}>
                  <Icon name="navPrev" />
                </IconButton>
                <IconButton
                  variant="solid"
                  size="lg"
                  aria-label={paused ? t('pump.stage.resume') : t('pump.stage.pause')}
                  onClick={paused ? pump.resume : pump.pause}
                >
                  <Icon name={paused ? 'navPlay' : 'navPause'} />
                </IconButton>
                <IconButton variant="ghost" size="lg" aria-label={t('pump.stage.next')} onClick={pump.next}>
                  <Icon name="navNext" />
                </IconButton>
                <IconButton variant="ghost" size="lg" aria-label={t('pump.stage.stop')} onClick={pump.stop}>
                  <Icon name="recStop" />
                </IconButton>
              </Box>
              {paused && ttsItem && (
                <Text className={styles.hint}>{t('pump.stage.ttsPauseHint')}</Text>
              )}
            </Box>
          ) : null}
        </>
      )}
    </Box>
  );
}

