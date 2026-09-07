// DeleteConfirmModal — confirm dialog before delete (spec F11).
//
// Two modes:
//  - resource given → wording derived from resource.type
//    ("Xóa từ điển?" / "Xóa danh sách?").
//  - title + description given → generic bulk-destructive confirm
//    (e.g. "Xóa tất cả 3 từ điển?").

import { type ReactElement } from 'react';
import { Button, Dialog } from '@/shared/ui';
import type { ResourceInfo } from '@/entities/dictionary';

interface DeleteConfirmModalProps {
  /** Single-resource mode — derives title/body from type + wordCount. */
  readonly resource?: ResourceInfo;
  /** Generic mode — explicit title/description override the derived wording. */
  readonly title?: string;
  readonly description?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function DeleteConfirmModal({ resource, title, description, onConfirm, onCancel }: DeleteConfirmModalProps): ReactElement {
  const resolvedTitle =
    title ?? (resource?.type === 'DICTIONARY' ? 'Xóa từ điển?' : 'Xóa danh sách?');
  const resolvedDescription =
    description ??
    (resource
      ? `Xóa vĩnh viễn "${resource.name}" và ${resource.wordCount} từ của nó.`
      : 'Hành động này không thể hoàn tác.');

  const footer = (
    <>
      <Button variant="outline" onClick={onCancel}>Giữ lại</Button>
      <Button variant="destructive" onClick={onConfirm} data-cell-id="confirm-delete">Xóa</Button>
    </>
  );

  return (
    <Dialog
      open
      onOpenChange={() => onCancel()}
      title={resolvedTitle}
      description={resolvedDescription}
      footer={footer}
      data-cell-id="delete-confirm-modal"
    />
  );
}
