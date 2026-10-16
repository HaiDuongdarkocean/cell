import { useRef, useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Tooltip } from '@/shared/ui/Tooltip';
import { Menu, MenuItem, MenuSeparator } from '@/shared/ui/Menu';
import { getLocale, t } from '@/shared/i18n';
import styles from './AiAnswerPanel.module.css';
import type { AiProviderId, AiAskState } from '../logic/useAiAsk';

const SKELETON_WIDTHS = ['92%', '78%', '60%'] as const;

function AnswerSkeleton(): React.JSX.Element {
  return (
    <div aria-hidden>
      {SKELETON_WIDTHS.map((w) => (
        <Skeleton key={w} width={w} height={12} style={{ margin: '8px 0' }} />
      ))}
    </div>
  );
}

export const AI_PROVIDER_IDS: readonly AiProviderId[] = ['chatgpt', 'gemini', 'deepseek', 'claude'];

export interface AiAnswerPanelProps {
  readonly state: AiAskState;
  readonly providerOrder: readonly AiProviderId[];
  /** Session pick / effective provider shown as the active source before an ask. */
  readonly selectedProvider: AiProviderId;
  /** [ANSWER_LANG] choice: interface ('native') or the learned language. */
  readonly answerLanguage: 'native' | 'target';
  /** Display name of the target language (e.g. "English"). */
  readonly targetLang: string;
  readonly busy: boolean;
  readonly onPickProvider: (provider: AiProviderId) => void;
  readonly onPickLanguage: (lang: 'native' | 'target') => void;
  readonly onRetry: () => void;
}

function providerLabel(id: AiProviderId): string {
  return t(`dict.ai.provider.${id}`);
}

export function AiAnswerPanel({
  state,
  providerOrder,
  selectedProvider,
  answerLanguage,
  targetLang,
  busy,
  onPickProvider,
  onPickLanguage,
  onRetry,
}: AiAnswerPanelProps): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const ordered = AI_PROVIDER_IDS.filter((p) => providerOrder.includes(p)).concat(
    AI_PROVIDER_IDS.filter((p) => !providerOrder.includes(p)),
  );
  const activeProvider = state.provider ?? selectedProvider;
  const nativeLang = getLocale() === 'vi' ? 'Vietnamese' : 'English';
  const loginNames = state.loginProviders.map(providerLabel).join(', ');
  const errorDescription = loginNames
    ? t('dict.ai.loginRequired', [loginNames])
    : state.error === 'all_failed'
      ? undefined
      : (state.error ?? undefined);

  return (
    <div className={styles.TihokaAi} data-tihoka-id="dictionary-ai-panel">
      <div className={styles.TihokaAiHead}>
        <button
          ref={triggerRef}
          type="button"
          className={styles.TihokaAiSource}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          disabled={busy}
          onClick={() => setMenuOpen((v) => !v)}
          data-tihoka-id="ai-provider-menu"
        >
          {state.phase === 'loading'
            ? t('dict.ai.asking', [providerLabel(activeProvider)])
            : t('dict.ai.sourcedFrom', [providerLabel(activeProvider)])}
          <Icon name="chevronDown" aria-hidden />
        </button>
        <Menu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          triggerRef={triggerRef}
          ariaLabel={t('dict.ai.provider.aria')}
        >
          {ordered.map((p) => (
            <MenuItem
              key={p}
              radio
              selected={activeProvider === p && state.phase !== 'error'}
              onSelect={() => onPickProvider(p)}
              data-tihoka-id={`ai-provider-${p}`}
            >
              {providerLabel(p)}
            </MenuItem>
          ))}
          <MenuSeparator />
          {(['native', 'target'] as const).map((lang) => (
            <MenuItem
              key={lang}
              radio
              selected={answerLanguage === lang}
              onSelect={() => onPickLanguage(lang)}
              data-tihoka-id={`ai-lang-${lang}`}
            >
              {t('dict.ai.answerIn', [lang === 'native' ? nativeLang : targetLang])}
            </MenuItem>
          ))}
        </Menu>
        <Tooltip content={t('dict.ai.retry')}>
          <Button
            variant="ghost"
            size="sm"
            shape="circle"
            aria-label={t('dict.ai.retry')}
            disabled={busy}
            onClick={onRetry}
            data-tihoka-id="ai-retry"
          >
            <Icon name="rotateCcw" />
          </Button>
        </Tooltip>
      </div>

      <div className={styles.TihokaAiAnswer} data-tihoka-id="dictionary-ai-answer">
        {state.phase === 'loading' && (
          <>
            {state.failoverFrom && (
              <p className={styles.TihokaAiNotice}>
                {t('dict.ai.failoverNotice', [providerLabel(state.failoverFrom), providerLabel(state.provider ?? state.failoverFrom)])}
              </p>
            )}
            <AnswerSkeleton />
          </>
        )}

        {state.phase === 'answered' && state.answer && (
          <p className={styles.TihokaAiText}>{state.answer.text}</p>
        )}

        {state.phase === 'error' && (
          <EmptyState
            size="md"
            icon={<Icon name="alertCircle" />}
            title={t('dict.ai.allFailed')}
            description={errorDescription}
            action={
              <Button variant="outline" size="sm" onClick={onRetry} data-tihoka-id="ai-retry">
                {t('dict.ai.retry')}
              </Button>
            }
            data-tihoka-id="dictionary-ai-error"
          />
        )}

        {state.phase === 'idle' && <AnswerSkeleton />}
      </div>
    </div>
  );
}
