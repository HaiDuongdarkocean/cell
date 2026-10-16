import { useRef, useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Tooltip } from '@/shared/ui/Tooltip';
import { Menu, MenuItem, MenuSeparator } from '@/shared/ui/Menu';
import { getLocale, t } from '@/shared/i18n';
import { isoCodeToLabel } from '@/shared/config/languageRegistry';
import { AiStreamStatus } from './AiStreamStatus';
import { Panel, PanelCard, PanelHead, PanelItem, PanelItemHead, PanelItemMeta, PanelNotice } from './PopupPanel';
import type { BreakdownChunk } from '@/features/aiBridge';
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
  readonly onPickProvider: (provider: AiProviderId) => void;
  readonly onPickLanguage: (lang: 'native' | 'target') => void;
  readonly onRetry: () => void;
  /** Parsed breakdown chunks — renders the checkable chunk list instead of
   *  the flat answer paragraph (breakdown tab only). */
  readonly chunks?: readonly BreakdownChunk[];
  readonly checkedChunks?: ReadonlySet<number>;
  readonly onToggleChunk?: (index: number) => void;
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
  onPickProvider,
  onPickLanguage,
  onRetry,
  chunks,
  checkedChunks,
  onToggleChunk,
}: AiAnswerPanelProps): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const ordered = AI_PROVIDER_IDS.filter((p) => providerOrder.includes(p)).concat(
    AI_PROVIDER_IDS.filter((p) => !providerOrder.includes(p)),
  );
  const activeProvider = state.provider ?? selectedProvider;
  const nativeLang = getLocale() === 'vi' ? 'Vietnamese' : 'English';
  const targetLangName = (isoCodeToLabel(targetLang) ?? targetLang).replace(/^./, (c) => c.toUpperCase());
  const loginNames = state.loginProviders.map(providerLabel).join(', ');
  const errorDescription = loginNames
    ? t('dict.ai.loginRequired', [loginNames])
    : state.error === 'all_failed'
      ? undefined
      : (state.error ?? undefined);

  return (
    <Panel id="dictionary-ai-panel">
      <PanelHead
        source={(
          <>
            <button
              ref={triggerRef}
              type="button"
              className={styles.TihokaAiSource}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
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
                  {t('dict.ai.answerIn', [lang === 'native' ? nativeLang : targetLangName])}
                </MenuItem>
              ))}
            </Menu>
          </>
        )}
        actions={(
          <Tooltip content={t('dict.ai.retry')}>
            <Button
              variant="ghost"
              size="sm"
              shape="circle"
              aria-label={t('dict.ai.retry')}
              onClick={onRetry}
              data-tihoka-id="ai-retry"
            >
              <Icon name="rotateCcw" />
            </Button>
          </Tooltip>
        )}
      />

      <PanelCard id="dictionary-ai-answer">
        {state.phase === 'loading' && (
          <PanelItem padded>
            {state.failoverFrom && (
              <PanelNotice>
                {t('dict.ai.failoverNotice', [providerLabel(state.failoverFrom), providerLabel(state.provider ?? state.failoverFrom)])}
              </PanelNotice>
            )}
            <AiStreamStatus text={state.answer?.text} />
          </PanelItem>
        )}

        {state.phase === 'answered' && state.answer && (
          chunks && chunks.length > 0 ? (
            chunks.map((c, i) => (
              <PanelItem
                key={i}
                padded
                checked={checkedChunks?.has(i) ?? false}
                onToggle={() => onToggleChunk?.(i)}
              >
                <PanelItemHead>{c.text}</PanelItemHead>
                {c.meaning && (
                  <PanelItemMeta label={t('dict.ai.chunkMeaning')}>{c.meaning}</PanelItemMeta>
                )}
                {c.explanation && (
                  <PanelItemMeta label={t('dict.ai.chunkExplanation')}>{c.explanation}</PanelItemMeta>
                )}
              </PanelItem>
            ))
          ) : (
            <PanelItem padded>
              <p className={styles.TihokaAiText}>{state.answer.text}</p>
            </PanelItem>
          )
        )}

        {state.phase === 'error' && (
          <PanelItem padded>
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
          </PanelItem>
        )}

        {state.phase === 'idle' && (
          <PanelItem padded>
            <AnswerSkeleton />
          </PanelItem>
        )}
      </PanelCard>
    </Panel>
  );
}
