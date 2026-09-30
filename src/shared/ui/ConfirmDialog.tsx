import { Dialog } from './Dialog';
import { Button } from './Button';
import { Text } from './Text';

interface ConfirmDialogProps {
  /** Whether the dialog is visible. */
  open: boolean;
  /** Called when the dialog should close (overlay click, Esc, cancel). */
  onOpenChange?: (open: boolean) => void;
  /** Dialog title, e.g. `Delete "name"?`. */
  title: string;
  /** Warning/description body. */
  description: string;
  /** Cancel button label. */
  cancelLabel: string;
  /** Confirm button label. */
  confirmLabel: string;
  /** Called when the user confirms. */
  onConfirm: () => void;
  /** Confirm button variant — destructive for delete flows (default), primary otherwise. */
  variant?: 'destructive' | 'primary';
}

/**
 * ConfirmDialog — shared confirmation prompt for destructive/irreversible
 * actions: title + warning body + Cancel / Confirm footer.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  cancelLabel,
  confirmLabel,
  onConfirm,
  variant = 'destructive',
}: ConfirmDialogProps): React.JSX.Element | null {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={(
        <>
          <Button variant="ghost" onClick={() => onOpenChange?.(false)}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      )}
    >
      <Text>{description}</Text>
    </Dialog>
  );
}
