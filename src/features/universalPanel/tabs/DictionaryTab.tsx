import { useState, useCallback, useEffect } from 'react';
import { DictionaryPanelView } from '@/features/dictionaryPopup/ui/DictionaryPanelView';
import type { PopupCardCreatorPrefill } from '@/features/dictionaryPopup/ui/popupDictionaryController';
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
}

export function DictionaryTab({
  langCode,
  sourceLang,
  targetLang,
  initialTerm,
  isOpen,
  prefill: externalPrefill,
  onQuickAdd,
}: DictionaryTabProps): React.JSX.Element {
  const [prefill, setPrefill] = useState<DictionaryPanelPrefill | null>(externalPrefill ?? null);

  useEffect(() => {
    setPrefill(externalPrefill ?? null);
  }, [externalPrefill]);

  const handlePanelSendToCard = useCallback((next: PopupCardCreatorPrefill): void => {
    setPrefill(next as DictionaryPanelPrefill);
  }, []);

  const handlePanelQuickAdd = useCallback((next: PopupCardCreatorPrefill): void => {
    setPrefill({ ...next, initialAction: 'quick-add' } as DictionaryPanelPrefill);
  }, []);

  return (
    <div className={styles.dictionaryTab} data-testid="dictionary-tab">
      <div className={styles.leftPane}>
        <DictionaryPanelView
          langCode={langCode}
          sourceLang={sourceLang}
          targetLang={targetLang}
          initialTerm={initialTerm}
          isOpen={isOpen}
          onSendToCard={handlePanelSendToCard}
          onQuickAdd={onQuickAdd ?? handlePanelQuickAdd}
        />
      </div>
      <div className={styles.rightPane}>
        <CardCreatorPanel sourceLang={sourceLang} targetLang={targetLang} context={prefill} />
      </div>
    </div>
  );
}
