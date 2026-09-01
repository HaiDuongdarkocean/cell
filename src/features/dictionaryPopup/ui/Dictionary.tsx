import { useEffect } from 'react';
import { Icon } from '@/shared/icons/Icon';
import { DictionaryPanelView } from './DictionaryPanelView';
import { usePopupPosition } from './usePopupPosition';
import { Sheet } from '@/shared/ui/Sheet';
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

function DictionaryPopup(props: DictionaryPopupProps): React.JSX.Element {
  const {
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
    onPointerDownResize,
  } = usePopupPosition({
    anchor,
    pointer,
    lineRect,
    initialSize,
    initialSheetHeight,
    onSizeChange,
    onClose,
  });

  useEffect(() => {
    popupRef.current?.focus();
  }, [popupRef]);

  // Sheet mode (mobile) — use shared Sheet atom (SSOT).
  if (isSheet) {
    return (
      <Sheet
        open
        onClose={onClose}
        initialHeight={initialSheetHeight}
        onHeightChange={(h) => onSizeChange?.({ width: 0, maxHeight: 0 }, h)}
        data-cell-id="popup-dictionary"
      >
        <DictionaryPanelView {...panelProps} isOpen variant="popup" />
      </Sheet>
    );
  }

  // Popup mode (desktop) — absolute positioned near selection.
  return (
    <div
      ref={popupRef}
      className={styles.popup}
      role="dialog"
      aria-modal="true"
      aria-label="Dictionary popup"
      tabIndex={-1}
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
        className={styles.content}
        data-cell-id="popup-dictionary-content"
      >
        <DictionaryPanelView {...panelProps} isOpen variant="popup" />
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

function DictionaryIntegrated(props: DictionaryIntegratedProps): React.JSX.Element {
  const { variant: _variant, ...panelProps } = props;
  return <DictionaryPanelView {...panelProps} />;
}

export function Dictionary(props: DictionaryProps): React.JSX.Element {
  if (props.variant === 'popup') {
    return <DictionaryPopup {...props} />;
  }
  return <DictionaryIntegrated {...props} />;
}
