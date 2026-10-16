import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
import styles from './AiStreamStatus.module.css';

/** Thinking → streaming view shared by the AI / breakdown / translate tabs so
 *  all three show the same state while a provider generates. */
export function AiStreamStatus({
  text,
}: {
  readonly text?: string;
}): React.JSX.Element {
  return text ? (
    <p className={styles.TihokaAiText} data-tihoka-id="ai-streaming">
      {text}
      <span className={styles.TihokaAiCaret} aria-hidden />
    </p>
  ) : (
    <p className={styles.TihokaAiThinking} data-tihoka-id="ai-thinking">
      <Icon name="atom" aria-hidden />
      {t('dict.ai.thinking')}
    </p>
  );
}
