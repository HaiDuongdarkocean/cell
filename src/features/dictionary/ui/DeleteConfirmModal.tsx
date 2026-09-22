// DeleteConfirmModal — confirm dialog before delete (spec F11).
//
// Two modes:
//  - resource given → wording derived from resource.type
//    ("Xóa từ điển?" / "Xóa danh sách?").
//  - title + description given → generic bulk-destructive confirm
//    (e.g. "Xóa tất cả 3 từ điển?").

import { type ReactElement } from 'react';
import { t } from '@/shared/i18n';
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
    title ?? t(resource?.type === 'DICTIONARY' ? 'resources.deleteModal.dictTitle' : 'resources.deleteModal.freqTitle');
  const resolvedDescription =
    description ??
    (resource
      ? t('resources.deleteModal.desc', [resource.name, resource.wordCount])
      : t('resources.deleteModal.descGeneric'));

  const footer = (
    <>
      <Button variant="outline" onClick={onCancel}>{t('resources.deleteModal.keep')}</Button>
      <Button variant="destructive" onClick={onConfirm} data-cell-id="confirm-delete">{t('resources.deleteModal.delete')}</Button>
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
