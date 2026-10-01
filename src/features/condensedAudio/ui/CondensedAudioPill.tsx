import { useEffect, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Text } from '@/shared/ui/Text';
import { t } from '@/shared/i18n';
import styles from './CondensedAudioPill.module.css';

export interface CondensedAudioPillProps {
  readonly startedAt: number;
  readonly onStop: () => void;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(h > 0 ? m : m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function CondensedAudioPill({
  startedAt,
  onStop,
}: CondensedAudioPillProps): React.JSX.Element {
  const [elapsedMs, setElapsedMs] = useState(() => Math.max(0, Date.now() - startedAt));
  useEffect(() => {
    const id = setInterval(() => setElapsedMs(Math.max(0, Date.now() - startedAt)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return (
    <div className={styles.pill} role="status" data-cell-id="condensed-audio-pill">
      <span className={styles.dot} aria-hidden="true" />
      <Text variant="body" className={styles.elapsed}>
        {t('condensedAudio.pill.recording')} {formatElapsed(elapsedMs)}
      </Text>
      <Button
        variant="overlay"
        shape="circle"
        size="md"
        onClick={onStop}
        aria-label={t('condensedAudio.pill.stop')}
      >
        <Icon name="x" size="sm" />
      </Button>
    </div>
  );
}
