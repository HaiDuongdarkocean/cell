import { Icon } from '@/shared/icons/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { DictionaryPanelView } from './DictionaryPanelView';
import { usePopupPosition } from './usePopupPosition';
import styles from './PopupDictionary.module.css';
import type { ComponentProps } from 'react';
import type { PopupAnchor, PopupLineRect, PopupPointerHint, PopupSize } from './usePopupPosition';

export type DictionaryPanelProps = ComponentProps<typeof DictionaryPanelView>;

export interface DictionaryPopupProps extends Omit<DictionaryPanelProps, 'isOpen'> {
  readonly variant: 'popup';
  readonly anchor: PopupAnchor;
  readonly pointer?: PopupPointerHint;
  readonly lineRect?: PopupLineRect | null;
  readonly initialSize?: Partial<PopupSize>;
  readonly initialSheetHeight?: number;
  readonly onClose: () => void;
  readonly onSizeChange?: (size: PopupSize, sheetHeight: number) => void;
  readonly style?: React.CSSProperties;
}

export interface DictionaryIntegratedProps extends DictionaryPanelProps {
  readonly variant: 'integrated';
}

export type DictionaryProps = DictionaryPopupProps | DictionaryIntegratedProps;

export function Dictionary(props: DictionaryProps): React.JSX.Element {
  if (props.variant === 'popup') {
    const {
      variant,
      anchor,
      pointer,
      lineRect,
      initialSize,
      initialSheetHeight,
      onClose,
      onSizeChange,
      style: incomingStyle,
      ...panelProps
    } = props;

    const {
      style,
      isSheet,
      popupRef,
      onPointerDownHeader,
      onPointerDownResize,
      onPointerDownSheet,
      onPointerDownContent,
    } = usePopupPosition({
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
        data-cell-id="popup-dictionary"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div
          className={styles.header}
          data-cell-id="popup-dictionary-header"
          aria-label="Drag to move"
          onPointerDown={onPointerDownHeader}
        >
          <span className={styles.grip} aria-hidden="true" data-cell-id="popup-dictionary-grip">
            <Icon name="ellipsisVertical" size={16} />
          </span>
          <span className={styles.title}>Dictionary</span>
          <IconButton
            size="sm"
            variant="ghost"
            aria-label="Close"
            data-cell-id="popup-dictionary-close"
            onClick={onClose}
          >
            <Icon name="x" size={18} />
          </IconButton>
        </div>

        <div
          className={styles.sheetHandle}
          aria-hidden="true"
          data-cell-id="popup-dictionary-sheet-handle"
          onPointerDown={onPointerDownSheet}
        />

        <div
          className={styles.content}
          data-cell-id="popup-dictionary-content"
          onPointerDown={onPointerDownContent}
        >
          <DictionaryPanelView {...panelProps} isOpen />
        </div>

        <div
          className={styles.resize}
          aria-hidden="true"
          data-cell-id="popup-dictionary-resize"
          onPointerDown={onPointerDownResize}
        >
          <Icon name="resize" size={14} />
        </div>
      </div>
    );
  }

  const { variant, ...panelProps } = props;
  return <DictionaryPanelView {...panelProps} />;
}
