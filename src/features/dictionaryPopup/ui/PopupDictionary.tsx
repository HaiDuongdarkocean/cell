import { Icon } from '@/shared/icons/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { DictionaryPanelView } from './DictionaryPanelView';
import styles from './PopupDictionary.module.css';
import type { PopupCardCreatorPrefill } from './popupDictionaryController';

export interface PopupDictionaryProps {
  readonly langCode: string;
  readonly sourceLang: string;
  readonly targetLang: string;
  readonly initialTerm?: string;
  readonly onClose: () => void;
  readonly onSendToCard?: (prefill: PopupCardCreatorPrefill) => void;
  readonly onQuickAdd?: (prefill: PopupCardCreatorPrefill) => void;
  readonly style?: React.CSSProperties;
}

export function PopupDictionary({
  langCode,
  sourceLang,
  targetLang,
  initialTerm,
  onClose,
  onSendToCard,
  onQuickAdd,
  style,
}: PopupDictionaryProps): React.JSX.Element {
  return (
    <div
      className={styles.popup}
      role="dialog"
      aria-modal="true"
      aria-label="Dictionary popup"
      style={style}
      data-testid="popup-dictionary"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className={styles.header} data-testid="popup-dictionary-header" aria-label="Drag to move">
        <span className={styles.grip} aria-hidden="true" data-testid="popup-dictionary-grip">
          <Icon name="ellipsisVertical" size={16} />
        </span>
        <span className={styles.title}>Dictionary</span>
        <IconButton
          size="sm"
          variant="ghost"
          aria-label="Close"
          data-testid="popup-dictionary-close"
          onClick={onClose}
        >
          <Icon name="x" size={18} />
        </IconButton>
      </div>

      <div className={styles.content} data-testid="popup-dictionary-content">
        <DictionaryPanelView
          langCode={langCode}
          sourceLang={sourceLang}
          targetLang={targetLang}
          initialTerm={initialTerm}
          onSendToCard={onSendToCard}
          onQuickAdd={onQuickAdd}
          isOpen
        />
      </div>

      <div className={styles.resize} aria-hidden="true" data-testid="popup-dictionary-resize">
        <Icon name="resize" size={14} />
      </div>
    </div>
  );
}
