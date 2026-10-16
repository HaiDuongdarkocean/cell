import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Skeleton } from '@/shared/ui/Skeleton';
import { IconButton } from '@/shared/ui/IconButton';
import { Tooltip } from '@/shared/ui/Tooltip';
import { t } from '@/shared/i18n';
import styles from './AiAnswerPanel.module.css';
import type { AiProviderId, AiAskState } from '../logic/useAiAsk';

export const AI_PROVIDER_IDS: readonly AiProviderId[] = ['chatgpt', 'gemini', 'deepseek', 'claude'];

export interface AiAnswerPanelProps {
  readonly state: AiAskState;
  readonly providerOrder: readonly AiProviderId[];
  readonly busy: boolean;
  readonly onPickProvider: (provider: AiProviderId) => void;
  readonly onRetry: () => void;
}

function providerLabel(id: AiProviderId): string {
  return t(`dict.ai.provider.${id}`);
}

export function AiAnswerPanel({
  state,
  providerOrder,
  busy,
  onPickProvider,
  onRetry,
}: AiAnswerPanelProps): React.JSX.Element {
  const ordered = AI_PROVIDER_IDS.filter((p) => providerOrder.includes(p)).concat(
    AI_PROVIDER_IDS.filter((p) => !providerOrder.includes(p)),
  );
  const failedProviders = new Set(
    state.phase === 'error' ? ordered : state.failoverFrom ? [state.failoverFrom] : [],
  );

  return (
    <div className={styles.TihokaAi} data-tihoka-id="dictionary-ai-panel">
      <div className={styles.TihokaAiProviders} role="radiogroup" aria-label={t('dict.ai.provider.aria')}>
        {ordered.map((p) => {
          const active = state.provider === p && state.phase !== 'error';
          const failed = failedProviders.has(p);
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={busy}
              className={`${styles.TihokaAiProvider} ${active ? styles['TihokaAiProvider--active'] : ''} ${failed ? styles['TihokaAiProvider--error'] : ''}`}
              onClick={() => onPickProvider(p)}
              data-tihoka-id={`ai-provider-${p}`}
            >
              <span
                className={`${styles.TihokaAiDot} ${failed ? styles['TihokaAiDot--error'] : ''}`}
                aria-hidden
              />
              {providerLabel(p)}
            </button>
          );
        })}
      </div>

      <div className={styles.TihokaAiAnswer} data-tihoka-id="dictionary-ai-answer">
        {state.phase === 'loading' && (
          <>
            {state.failoverFrom && (
              <p className={styles.TihokaAiNotice}>
                {t('dict.ai.failoverNotice', [providerLabel(state.failoverFrom), providerLabel(state.provider ?? state.failoverFrom)])}
              </p>
            )}
            <Skeleton lines={3} />
          </>
        )}

        {state.phase === 'answered' && state.answer && (
          <>
            <p className={styles.TihokaAiText}>{state.answer.text}</p>
            <div className={styles.TihokaAiFoot}>
              <span>{t('dict.ai.sourcedFrom', [providerLabel(state.answer.provider)])}</span>
              <Tooltip content={t('dict.ai.retry')}>
                <IconButton
                  icon="rotateCcw"
                  size="sm"
                  aria-label={t('dict.ai.retry')}
                  onClick={onRetry}
                  data-tihoka-id="ai-retry"
                />
              </Tooltip>
            </div>
          </>
        )}

        {state.phase === 'error' && (
          <EmptyState
            size="md"
            icon={<Icon name="alertCircle" />}
            title={t('dict.ai.allFailed')}
            description={state.error ?? undefined}
            action={
              <Button variant="outline" size="sm" onClick={onRetry} data-tihoka-id="ai-retry">
                {t('dict.ai.retry')}
              </Button>
            }
            data-tihoka-id="dictionary-ai-error"
          />
        )}

        {state.phase === 'idle' && <Skeleton lines={3} />}
      </div>
    </div>
  );
}
