import { useEffect, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { Icon } from '@/shared/ui/Icon';
import { Text } from '@/shared/ui/Text';
import { t } from '@/shared/i18n';
import styles from './CondensedAudioPill.module.css';

export type CondensedAudioPillPhase = 'live' | 'done' | 'ready';

export interface CondensedAudioPillProps {
  readonly paused: boolean;
  readonly phase: CondensedAudioPillPhase;
  readonly getElapsedMs: () => number;
  readonly onStop: () => void;
  readonly onTogglePause: () => void;
  readonly onDiscard: () => void;
  readonly onOpenLibrary: () => void;
  readonly onDismissDone: () => void;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function CondensedAudioPill({
  paused,
  phase,
  getElapsedMs,
  onStop,
  onTogglePause,
  onDiscard,
  onOpenLibrary,
  onDismissDone,
}: CondensedAudioPillProps): React.JSX.Element {
  const [elapsedMs, setElapsedMs] = useState(() => getElapsedMs());
  const [confirmOpen, setConfirmOpen] = useState(false);
  useEffect(() => {
    if (phase !== 'live') return;
    const id = setInterval(() => setElapsedMs(getElapsedMs()), 500);
    return () => clearInterval(id);
  }, [getElapsedMs, phase]);
  if (phase === 'done') {
    return (
      <div className={`${styles.pill} ${styles.pillDone}`} role="status" data-cell-id="condensed-audio-pill-done">
        <Icon name="circleCheck" size="sm" className={styles.doneIcon} />
        <span className={styles.status}>
          <span className={styles.statusLabelDone}>
            {t('condensedAudio.pill.done')}
          </span>
          <Text variant="body" className={styles.elapsed}>
            {formatElapsed(elapsedMs)}
          </Text>
        </span>
      </div>
    );
  }
  if (phase === 'ready') {
    return (
      <div className={`${styles.pill} ${styles.pillReady}`} role="status" data-cell-id="condensed-audio-pill-ready">
        <button
          type="button"
          className={styles.listenCta}
          onClick={onOpenLibrary}
          data-cell-id="condensed-audio-open-playlist"
          aria-label={t('condensedAudio.pill.openPlaylist')}
        >
          <Icon name="audioWave" size="sm" />
          <span className={styles.statusLabelDone}>
            {t('condensedAudio.pill.listen')}
          </span>
          <Text variant="body" className={styles.elapsed}>
            {formatElapsed(elapsedMs)}
          </Text>
        </button>
        <Button
          variant="overlay"
          shape="circle"
          size="sm"
          className={styles.action}
          onClick={onDismissDone}
          aria-label={t('condensedAudio.pill.dismissDone')}
          data-cell-id="condensed-audio-dismiss-done"
        >
          <Icon name="x" size="sm" />
        </Button>
      </div>
    );
  }
  return (
    <>
      <div className={styles.pill} role="status" data-cell-id="condensed-audio-pill">
        <span className={paused ? styles.dotPaused : styles.dot} aria-hidden="true" />
        <span className={styles.status}>
          <span className={paused ? styles.statusLabelPaused : styles.statusLabel}>
            {paused ? t('condensedAudio.pill.paused') : t('condensedAudio.pill.recording')}
          </span>
          <Text variant="body" className={styles.elapsed}>
            {formatElapsed(elapsedMs)}
          </Text>
        </span>
        <Button
          variant="overlay"
          shape="circle"
          size="sm"
          className={styles.action}
          onClick={onTogglePause}
          aria-label={t(paused ? 'condensedAudio.pill.resume' : 'condensedAudio.pill.pause')}
          data-cell-id="condensed-audio-pause"
        >
          <Icon name={paused ? 'recPlay' : 'recPause'} size="sm" />
        </Button>
        <Button
          variant="overlay"
          shape="circle"
          size="sm"
          className={styles.action}
          onClick={onStop}
          aria-label={t('condensedAudio.pill.stop')}
          data-cell-id="condensed-audio-stop"
        >
          <Icon name="recStop" size="sm" />
        </Button>
        <span className={styles.divider} aria-hidden="true" />
        <Button
          variant="overlay"
          shape="circle"
          size="sm"
          className={`${styles.action} ${styles.actionDestructive}`}
          onClick={() => setConfirmOpen(true)}
          aria-label={t('condensedAudio.pill.discard')}
          data-cell-id="condensed-audio-discard"
        >
          <Icon name="recDiscard" size="sm" />
        </Button>
      </div>
      <div className={styles.dialogLayer} data-cell-id="condensed-audio-discard-dialog">
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={t('condensedAudio.pill.discardTitle')}
          description={t('condensedAudio.pill.discardBody')}
          cancelLabel={t('condensedAudio.pill.keepRecording')}
          confirmLabel={t('condensedAudio.pill.discardConfirm')}
          onConfirm={onDiscard}
        />
      </div>
    </>
  );
}
