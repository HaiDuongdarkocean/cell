import { useState, useCallback, useEffect } from 'react';
import { DictionaryPanelView } from '@/features/dictionaryPopup/ui/DictionaryPanelView';
import type { PopupCardCreatorPrefill } from '@/features/dictionaryPopup/ui/popupDictionaryController';
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
  /** Optional prefill pushed from an external popup dictionary. */
  readonly prefill?: PopupCardCreatorPrefill | null;
}

export function DictionaryTab({
  langCode,
  sourceLang,
  targetLang,
  initialTerm,
  isOpen,
  prefill: externalPrefill,
}: DictionaryTabProps): React.JSX.Element {
  const [prefill, setPrefill] = useState<PopupCardCreatorPrefill | null>(externalPrefill ?? null);

  useEffect(() => {
    setPrefill(externalPrefill ?? null);
  }, [externalPrefill]);

  const handlePanelSendToCard = useCallback((next: PopupCardCreatorPrefill): void => {
    setPrefill(next);
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
        />
      </div>
      <div className={styles.rightPane}>
        <CardCreatorPanel sourceLang={sourceLang} targetLang={targetLang} prefill={prefill} />
      </div>
    </div>
  );
}
