import { Icon } from '@/shared/ui/Icon';
import { t } from '@/shared/i18n';
import styles from './AiStreamStatus.module.css';

/** Thinking → streaming view shared by the AI / breakdown / translate tabs so
 *  all three show the same state while a provider generates. */
export function AiStreamStatus({
  text,
  textClassName,
}: {
  readonly text?: string;
  /** Host surface's answer-text class so streaming/thinking render inside
   *  the same styled paragraph as the final answer. */
  readonly textClassName?: string;
}): React.JSX.Element {
  const pClass = textClassName ?? styles.TihokaAiText;
  return text ? (
    <p className={pClass} data-tihoka-id="ai-streaming">
      {text}
      <span className={styles.TihokaAiCaret} aria-hidden />
    </p>
  ) : (
    <p className={`${pClass} ${styles.TihokaAiThinking}`} data-tihoka-id="ai-thinking">
      <Icon name="atom" aria-hidden />
      {t('dict.ai.thinking')}
    </p>
  );
}
