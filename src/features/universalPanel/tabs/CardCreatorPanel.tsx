import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/icons/Icon';
import type { PopupCardCreatorPrefill } from '@/features/dictionaryPopup/ui/popupDictionaryController';
import styles from './CardCreatorPanel.module.css';

export interface CardCreatorPanelProps {
  /** Prefill data produced by the left dictionary panel. */
  readonly prefill?: PopupCardCreatorPrefill | null;
  /** Called when the user confirms creating/updating a card. */
  readonly onSendToCard?: (prefill: PopupCardCreatorPrefill) => void;
}

export function CardCreatorPanel({ prefill, onSendToCard }: CardCreatorPanelProps): React.JSX.Element {
  return (
    <div className={styles.cardCreatorPanel} data-testid="card-creator-panel">
      <h3 className={styles.title}>Card Creator</h3>
      {!prefill ? (
        <EmptyState
          icon={<Icon name="pencil" size={32} />}
          title="No card selected"
          description="Look up a word and click Send to Card to prefill the card creator."
          data-testid="card-creator-empty"
        />
      ) : (
        <div className={styles.prefillCard} data-testid="card-creator-prefill">
          <div className={styles.prefillWord}>{prefill.term}</div>
          {prefill.reading && <div className={styles.prefillReading}>{prefill.reading}</div>}
          <pre className={styles.prefillDefinitions}>
            {prefill.definitions.map((d) => `• ${d.pos ? `${d.pos} ` : ''}${d.text}`.trim()).join('\n')}
          </pre>
          <Button
            variant="primary"
            size="md"
            onClick={() => onSendToCard?.(prefill)}
            leadingIcon={<Icon name="pencil" size={16} />}
            data-testid="card-creator-confirm"
          >
            Open Card Creator
          </Button>
        </div>
      )}
    </div>
  );
}
