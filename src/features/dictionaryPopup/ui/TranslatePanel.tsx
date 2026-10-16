import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Skeleton } from '@/shared/ui/Skeleton';
import { Tooltip } from '@/shared/ui/Tooltip';
import { Menu, MenuItem, MenuSeparator } from '@/shared/ui/Menu';
import { Panel, PanelHead, PanelItem } from './PopupPanel';
import panelStyles from './DictionaryPanelView.module.css';
import styles from './TranslatePanel.module.css';
import { AiStreamStatus } from './AiStreamStatus';
import { getLocale, t } from '@/shared/i18n';
import { isoCodeToLabel } from '@/shared/config/languageRegistry';
import type { AiProviderId } from '@/entities/settings';

/** Session source + answer-language controls shared with the AI/breakdown
 *  tabs — Google joined as the machine source. */
export interface TranslateSourceMenu {
  readonly providerOrder: readonly AiProviderId[];
  readonly activeSource: 'google' | AiProviderId;
  readonly answerLanguage: 'native' | 'target';
  readonly targetLang: string;
  readonly busy: boolean;
  readonly onPickSource: (source: 'google' | AiProviderId) => void;
  readonly onPickLanguage: (lang: 'native' | 'target') => void;
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
  const nativeLang = getLocale() === 'vi' ? 'Vietnamese' : 'English';
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
              disabled={sourceMenu.busy}
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
              <MenuSeparator />
              {(['native', 'target'] as const).map((lang) => (
                <MenuItem
                  key={lang}
                  radio
                  selected={sourceMenu.answerLanguage === lang}
                  onSelect={() => sourceMenu.onPickLanguage(lang)}
                  data-tihoka-id={`translate-lang-${lang}`}
                >
                  {t('dict.ai.answerIn', [
                    lang === 'native'
                      ? nativeLang
                      : (isoCodeToLabel(sourceMenu.targetLang) ?? sourceMenu.targetLang).replace(/^./, (c) => c.toUpperCase()),
                  ])}
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
            disabled={loading}
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

  if (loading && !translation) {
    return (
      <Panel id="dictionary-translate-panel">
        {sourceHead}
        {engine === 'ai' && aiStreamText !== undefined ? (
          <AiStreamStatus text={aiStreamText || undefined} />
        ) : (
          <TranslateSkeleton />
        )}
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel id="dictionary-translate-panel">
        {sourceHead}
        <div className={panelStyles.TihokaTranslateError}>{error}</div>
        <EmptyState
          size="md"
          icon={<Icon name="languages"  />}
          title={t('dict.translate.empty')}
          action={
            <Button variant="outline" size="md" onClick={onTranslate}>
              {t('dict.translate.action', [targetLang])}
            </Button>
          }
          data-tihoka-id="dictionary-translate-empty"
        />
      </Panel>
    );
  }

  if (translation) {
    return (
      <Panel id="dictionary-translate-panel">
        {sourceHead}
        <PanelItem
          checkMode="block"
          checked={selected}
          loading={loading}
          onToggle={onToggle}
        >
          <div className={styles.TihokaTranslateText}>
            <div className={styles.TihokaTranslateTarget}>{translation}</div>
            <div className={styles.TihokaTranslateNative}>{sentence || term}</div>
          </div>
        </PanelItem>
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
