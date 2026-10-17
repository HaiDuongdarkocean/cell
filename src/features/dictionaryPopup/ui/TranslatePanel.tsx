import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Tooltip } from '@/shared/ui/Tooltip';
import { Menu, MenuItem, MenuSeparator } from '@/shared/ui/Menu';
import { Panel, PanelCard, PanelHead, PanelItem } from './PopupPanel';
import panelStyles from './DictionaryPanelView.module.css';
import styles from './TranslatePanel.module.css';
import { AiStreamStatus } from './AiStreamStatus';
import { t } from '@/shared/i18n';
import type { AiProviderId } from '@/entities/settings';

/** Session source controls — Google joined as the machine source. The
 *  translate tab always renders into the native language, so unlike the
 *  AI/breakdown tabs it carries no answer-language section. */
export interface TranslateSourceMenu {
  readonly providerOrder: readonly AiProviderId[];
  readonly activeSource: 'google' | AiProviderId;
  readonly onPickSource: (source: 'google' | AiProviderId) => void;
}

export interface TranslatePanelProps {
  readonly term: string;
  readonly sentence: string;
  readonly targetLang: string;
  readonly translation: string;
  readonly error: string | null;
  readonly loading: boolean;
  readonly selected: boolean;
  readonly onToggle: () => void;
  readonly onTranslate: () => void;
  /** Regenerate — bypasses the AI answer cache (retry icon). */
  readonly onRetry?: () => void;
  /** Live AI partial while the provider streams — renders the shared
   *  thinking/streaming view instead of the skeleton. */
  readonly aiStreamText?: string;
  /** Google vs AI engine from settings (spec ai-bridge-dictionary REQ-4).
   *  Omit for read-only use — the source header is hidden then. */
  readonly engine?: 'google' | 'ai';
  /** Provider that produced the AI translation — shown as attribution. */
  readonly aiProviderLabel?: string;
  /** When present the source header becomes the shared source/lang menu. */
  readonly sourceMenu?: TranslateSourceMenu;
}

export function TranslatePanel({
  term,
  sentence,
  targetLang,
  translation,
  error,
  loading,
  selected,
  onToggle,
  onTranslate,
  onRetry,
  aiStreamText,
  engine,
  aiProviderLabel,
  sourceMenu,
}: TranslatePanelProps): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const activeLabel = sourceMenu
    ? sourceMenu.activeSource === 'google'
      ? 'Google'
      : t(`dict.ai.provider.${sourceMenu.activeSource}`)
    : undefined;
  const sourceHead = engine ? (
    <PanelHead
      source={(
        <>
          {sourceMenu ? (
            <button
              ref={triggerRef}
              type="button"
              className={styles.TihokaTranslateSource}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              data-tihoka-id="translate-source-menu"
            >
              {loading
                ? t('dict.ai.asking', [activeLabel ?? ''])
                : t('dict.ai.sourcedFrom', [activeLabel ?? ''])}
              <Icon name="chevronDown" aria-hidden />
            </button>
          ) : (
            <span className={styles.TihokaTranslateSource}>
              {t('dict.ai.sourcedFrom', [engine === 'google' ? 'Google' : (aiProviderLabel ?? t('dict.translate.engine.ai'))])}
            </span>
          )}
          {sourceMenu && (
            <Menu
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              triggerRef={triggerRef}
              ariaLabel={t('dict.ai.provider.aria')}
            >
              <MenuItem
                radio
                selected={sourceMenu.activeSource === 'google'}
                onSelect={() => sourceMenu.onPickSource('google')}
                data-tihoka-id="translate-source-google"
              >
                Google
              </MenuItem>
              <MenuSeparator />
              {sourceMenu.providerOrder.map((p) => (
                <MenuItem
                  key={p}
                  radio
                  selected={sourceMenu.activeSource === p}
                  onSelect={() => sourceMenu.onPickSource(p)}
                  data-tihoka-id={`translate-source-${p}`}
                >
                  {t(`dict.ai.provider.${p}`)}
                </MenuItem>
              ))}
            </Menu>
          )}
        </>
      )}
      actions={(
        <Tooltip content={t('dict.ai.retry')}>
          <Button
            variant="ghost"
            size="sm"
            shape="circle"
            aria-label={t('dict.ai.retry')}
            onClick={onRetry ?? onTranslate}
            data-tihoka-id="translate-retry"
          >
            <Icon name="rotateCcw" />
          </Button>
        </Tooltip>
      )}
    />
  ) : null;
  // Auto-translate once when panel opens with no translation and no error yet
  const autoTranslateFiredRef = useRef(false);
  useEffect(() => {
    if (autoTranslateFiredRef.current) return;
    if (!translation && !error && !loading) {
      autoTranslateFiredRef.current = true;
      onTranslate();
    }
  }, [translation, error, loading, onTranslate]);

  const streamText = engine === 'ai' && aiStreamText ? aiStreamText : undefined;
  const displayText = translation || streamText;

  if (error) {
    return (
      <Panel id="dictionary-translate-panel">
        {sourceHead}
        <div className={panelStyles.TihokaTranslateError} data-tihoka-id="dictionary-translate-error">{error}</div>
      </Panel>
    );
  }

  if (displayText || (loading && engine === 'ai')) {
    return (
      <Panel id="dictionary-translate-panel">
        {sourceHead}
        <PanelCard id="dictionary-translate-answer">
          <PanelItem
            checkMode="dot"
            checked={selected}
            onToggle={onToggle}
          >
            <div className={styles.TihokaTranslateText}>
              <div className={styles.TihokaTranslateTarget} data-tihoka-id="translate-target">
                {displayText ?? <AiStreamStatus />}
              </div>
              <div className={styles.TihokaTranslateNative}>{sentence || term}</div>
            </div>
          </PanelItem>
        </PanelCard>
      </Panel>
    );
  }

  if (loading) {
    return (
      <Panel id="dictionary-translate-panel">
        {sourceHead}
        <TranslateSkeleton />
      </Panel>
    );
  }

  return (
    <Panel id="dictionary-translate-panel">
      {sourceHead}
      <EmptyState
        size="md"
        icon={<Icon name="languages"  />}
        title={t('dict.translate.empty')}
        action={
          <Button variant="outline" size="md" loading={loading} onClick={onTranslate}>
            {t('dict.translate.action', [targetLang])}
          </Button>
        }
        data-tihoka-id="dictionary-translate-empty"
      />
    </Panel>
  );
}

function TranslateSkeleton(): React.JSX.Element {
  return (
    <div className={styles.TihokaTranslateSkeletonBlock} aria-hidden="true">
      <div className={styles.TihokaTranslateSkeletonText}>
        <Skeleton height="calc(var(--font-size-base) * var(--leading-normal))" className={styles.TihokaTranslateSkeletonLine} />
        <Skeleton width="75%" height="calc(var(--font-size-xs) * var(--leading-normal))" className={styles.TihokaTranslateSkeletonLine} />
      </div>
      <Skeleton width="var(--space-4)" height="var(--space-4)" className={styles.TihokaTranslateSkeletonCheck} />
    </div>
  );
}
