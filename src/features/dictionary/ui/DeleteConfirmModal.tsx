// DeleteConfirmModal — confirm dialog before delete (spec F11).

import { type ReactElement } from 'react';
import { Button, Dialog } from '@/shared/ui';
import type { ResourceInfo } from '@/entities/dictionary';

interface DeleteConfirmModalProps {
  readonly resource: ResourceInfo;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function DeleteConfirmModal({ resource, onConfirm, onCancel }: DeleteConfirmModalProps): ReactElement {
  const footer = (
    <>
      <Button material="solid" variant="outline" onClick={onCancel}>Hủy bỏ</Button>
      <Button material="solid" variant="destructive" onClick={onConfirm} data-cell-id="confirm-delete">Xóa</Button>
    </>
  );

  return (
    <Dialog
      open
      onOpenChange={() => onCancel()}
      title="Xác nhận xóa"
      description={`Xóa "${resource.name}" (${resource.wordCount} mục)? Hành động này không thể hoàn tác.`}
      footer={footer}
      data-cell-id="delete-confirm-modal"
    />
  );
}
