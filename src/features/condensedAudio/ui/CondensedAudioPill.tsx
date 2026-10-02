import { useEffect, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { Icon } from '@/shared/ui/Icon';
import { Text } from '@/shared/ui/Text';
import { t } from '@/shared/i18n';
import styles from './CondensedAudioPill.module.css';

export interface CondensedAudioPillProps {
  readonly paused: boolean;
  readonly getElapsedMs: () => number;
  readonly onStop: () => void;
  readonly onTogglePause: () => void;
  readonly onDiscard: () => void;
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
  getElapsedMs,
  onStop,
  onTogglePause,
  onDiscard,
}: CondensedAudioPillProps): React.JSX.Element {
  const [elapsedMs, setElapsedMs] = useState(() => getElapsedMs());
  const [confirmOpen, setConfirmOpen] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setElapsedMs(getElapsedMs()), 500);
    return () => clearInterval(id);
  }, [getElapsedMs]);
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
