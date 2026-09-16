import { useState, useCallback, useEffect } from 'react';
import { Dictionary } from '@/features/dictionaryPopup/ui/Dictionary';
import type { PopupCardCreatorPrefill } from '@/entities/dictionary';
import type { DictionaryPanelPrefill } from '@/features/universalPanel/types';
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
  /** Called after a successful Add/Update in the integrated Card Creator. */
  readonly onAfterSubmit?: () => void;
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
    } as DictionaryPanelPrefill));
  }, []);

  const handlePanelQuickAdd = useCallback((next: PopupCardCreatorPrefill): void => {
    setCardCreatorContext((prev) => ({
      ...(prev ?? {}),
      ...next,
      term: next.term,
      initialAction: 'quick-add',
    } as DictionaryPanelPrefill));
  }, []);

  const handleQueueTermSelect = useCallback((term: string): void => {
    setSearchTerm(term);
  }, []);

  return (
    <div className={styles.dictionaryTab} data-cell-id="dictionary-tab">
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
      <div
        className={`${styles.rightPane} ${styles.dictionaryTab__sheet}`}
        data-cell-id="dictionary-tab-sheet"
      >
        <CardCreatorPanel
          sourceLang={sourceLang}
          targetLang={targetLang}
          context={cardCreatorContext}
          onAfterSubmit={onAfterSubmit}
          onQueueTermSelect={handleQueueTermSelect}
        />
      </div>
    </div>
  );
}
