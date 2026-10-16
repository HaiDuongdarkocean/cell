import { useState, useCallback, useEffect, useRef } from 'react';
import { Dictionary } from '@/features/dictionaryPopup/ui/Dictionary';
import type { PopupCardCreatorPrefill } from '@/entities/dictionary';
import type { DictionaryPanelPrefill } from '@/features/universalPanel/types';
import { ResizeHandle } from '@/shared/ui/ResizeHandle';
import { usePaneResize } from '@/shared/ui/usePaneResize';
import { STORAGE_KEYS } from '@/shared/config/config';
import { CardCreatorPanel } from './CardCreatorPanel';
import styles from './DictionaryTab.module.css';

export interface DictionaryTabProps {
  /** Dictionary language code (e.g. 'en'). */
  readonly langCode: string;
  /** Content/source language for the term. Usually equals langCode. */
  readonly sourceLang: string;
  /** User's native language for translation + card creator. */
  readonly targetLang: string;
  /** Optional term to search on first mount. */
  readonly initialTerm?: string;
  /** Whether the containing panel is currently open — controls search-input auto-focus. */
  readonly isOpen?: boolean;
  /** Optional prefill/context pushed from an external popup or subtitle cluster. */
  readonly prefill?: DictionaryPanelPrefill | null;
  /** Called when the user presses "Quick Add" in the dictionary header. */
  readonly onQuickAdd?: (prefill: PopupCardCreatorPrefill) => void;
  /** Called after a successful Add/Update — carries the submitted context's
   *  queueItemId so the caller removes exactly the replayed mining-queue row. */
  readonly onAfterSubmit?: (queueItemId?: string) => void;
  /** Called from the empty-definitions state to open Settings → Resources. */
  readonly onOpenSettings?: () => void;
}

export function DictionaryTab({
  langCode,
  sourceLang,
  targetLang,
  initialTerm,
  isOpen,
  prefill: externalPrefill,
  onQuickAdd,
  onAfterSubmit,
  onOpenSettings,
}: DictionaryTabProps): React.JSX.Element {
  const [prefill, setPrefill] = useState<DictionaryPanelPrefill | null>(externalPrefill ?? null);
  const [cardCreatorContext, setCardCreatorContext] = useState<DictionaryPanelPrefill | null>(externalPrefill ?? null);
  const [searchTerm, setSearchTerm] = useState<string | undefined>(externalPrefill?.term ?? initialTerm);

  useEffect(() => {
    const next = externalPrefill ?? null;
    setPrefill(next);
    setCardCreatorContext(next);
    setSearchTerm(next?.term ?? initialTerm);
  }, [externalPrefill, initialTerm]);

  const handlePanelSendToCard = useCallback((next: PopupCardCreatorPrefill): void => {
    setCardCreatorContext((prev) => ({
      ...(prev ?? {}),
      ...next,
      term: next.term,
      queueItemId: undefined,
    } as DictionaryPanelPrefill));
  }, []);

  const handlePanelQuickAdd = useCallback((next: PopupCardCreatorPrefill): void => {
    setCardCreatorContext((prev) => ({
      ...(prev ?? {}),
      ...next,
      term: next.term,
      initialAction: 'quick-add',
      queueItemId: undefined,
    } as DictionaryPanelPrefill));
  }, []);

  const handleQueueTermSelect = useCallback((term: string): void => {
    setSearchTerm(term);
  }, []);

  const splitRef = useRef<HTMLDivElement>(null);
  const { pct, handleProps } = usePaneResize({
    containerRef: splitRef,
    storageKey: STORAGE_KEYS.DICT_TAB_PANE_PCT,
    defaultPct: 50,
    minPct: 25,
    maxPct: 75,
  });

  return (
    <div className={styles.dictionaryTab} data-tihoka-id="dictionary-tab" ref={splitRef}>
      <div className={styles.leftPane}>
        <Dictionary
          variant="integrated"
          langCode={langCode}
          sourceLang={sourceLang}
          targetLang={targetLang}
          initialTerm={searchTerm}
          contextSentence={prefill?.contextSentence}
          initialResult={prefill?.lookupResult ?? undefined}
          selectionSnapshot={prefill ?? undefined}
          isOpen={isOpen}
          onSendToCard={handlePanelSendToCard}
          onQuickAdd={onQuickAdd ?? handlePanelQuickAdd}
          onOpenSettings={onOpenSettings}
        />
      </div>
      <ResizeHandle
        className={styles.paneDivider}
        data-tihoka-id="dictionary-tab-resize"
        {...handleProps}
      />
      <div
        className={`${styles.rightPane} ${styles.dictionaryTab__sheet}`}
        data-tihoka-id="dictionary-tab-sheet"
        style={{ '--dict-pane-pct': `${pct}%` } as React.CSSProperties}
      >
        <CardCreatorPanel
          sourceLang={sourceLang}
          targetLang={targetLang}
          context={cardCreatorContext}
          onAfterSubmit={() => onAfterSubmit?.(cardCreatorContext?.queueItemId)}
          onQueueTermSelect={handleQueueTermSelect}
        />
      </div>
    </div>
  );
}
