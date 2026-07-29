import { Icon } from '@/shared/icons/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { DictionaryPanelView } from './DictionaryPanelView';
import styles from './PopupDictionary.module.css';
import { usePopupPosition } from './usePopupPosition';
import type { PopupCardCreatorPrefill } from './popupDictionaryController';
import type { PopupAnchor, PopupPointerHint, PopupLineRect, PopupSize } from './usePopupPosition';

export interface PopupDictionaryProps {
  readonly langCode: string;
  readonly sourceLang: string;
  readonly targetLang: string;
  readonly anchor: PopupAnchor;
  readonly pointer?: PopupPointerHint;
  readonly lineRect?: PopupLineRect | null;
  readonly initialTerm?: string;
  readonly initialSize?: Partial<PopupSize>;
  readonly initialSheetHeight?: number;
  readonly onClose: () => void;
  readonly onSizeChange?: (size: PopupSize, sheetHeight: number) => void;
  readonly onSendToCard?: (prefill: PopupCardCreatorPrefill) => void;
  readonly onQuickAdd?: (prefill: PopupCardCreatorPrefill) => void;
  readonly style?: React.CSSProperties;
}

export function PopupDictionary({
  langCode,
  sourceLang,
  targetLang,
  anchor,
  pointer,
  lineRect,
  initialTerm,
  initialSize,
  initialSheetHeight,
  onClose,
  onSizeChange,
  onSendToCard,
  onQuickAdd,
  style: incomingStyle,
}: PopupDictionaryProps): React.JSX.Element {
  const { style, isSheet, popupRef, onPointerDownHeader, onPointerDownResize, onPointerDownSheet, onPointerDownContent } = usePopupPosition({
    anchor,
    pointer,
    lineRect,
    initialSize,
    initialSheetHeight,
    onSizeChange,
    onClose,
  });

  return (
    <div
      ref={popupRef}
      className={`${styles.popup} ${isSheet ? styles.isSheet : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Dictionary popup"
      style={{ ...style, ...incomingStyle }}
      data-testid="popup-dictionary"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        className={styles.header}
        data-testid="popup-dictionary-header"
        aria-label="Drag to move"
        onPointerDown={onPointerDownHeader}
      >
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

      <div
        className={styles.sheetHandle}
        aria-hidden="true"
        data-testid="popup-dictionary-sheet-handle"
        onPointerDown={onPointerDownSheet}
      />

      <div
        className={styles.content}
        data-testid="popup-dictionary-content"
        onPointerDown={onPointerDownContent}
      >
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

      <div
        className={styles.resize}
        aria-hidden="true"
        data-testid="popup-dictionary-resize"
        onPointerDown={onPointerDownResize}
      >
        <Icon name="resize" size={14} />
      </div>
    </div>
  );
}
