// DeleteConfirmModal — confirm dialog before delete (spec F11).
//
// Two modes:
//  - resource given → wording derived from resource.type
//    ("Xóa từ điển" / "Xóa danh sách") + subject box (name + word count).
//  - title + description given → generic bulk-destructive confirm
//    (e.g. "Xóa tất cả 3 từ điển").

import { type ReactElement } from 'react';
import { t } from '@/shared/i18n';
import { Button, Dialog, Separator } from '@/shared/ui';
import type { ResourceInfo } from '@/entities/dictionary';
import styles from './DeleteConfirmModal.module.css';

interface DeleteConfirmModalProps {
  /** Single-resource mode — derives title/subject from type + wordCount. */
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
  const resolvedDescription = description ?? t('resources.deleteModal.descGeneric');

  const footer = (
    <>
      <Button variant="outline" className={styles.actionBtn} onClick={onCancel}>{t('resources.deleteModal.keep')}</Button>
      <Button variant="destructive" className={styles.actionBtn} onClick={onConfirm} data-tihoka-id="confirm-delete">{t('resources.deleteModal.delete')}</Button>
    </>
  );

  return (
    <Dialog
      open
      onOpenChange={() => onCancel()}
      title={resolvedTitle}
      showCloseButton
      footer={footer}
      aria-describedby="delete-confirm-description"
      data-tihoka-id="delete-confirm-modal"
    >
      <Separator className={styles.divider} />
      <p id="delete-confirm-description" className={styles.description}>{resolvedDescription}</p>
      {resource && (
        <div className={styles.subject}>
          <span className={styles.subjectName}>{resource.name}</span>
          <span className={styles.subjectMeta}>
            {t('resources.deleteModal.words', [resource.wordCount.toLocaleString()])}
          </span>
        </div>
      )}
    </Dialog>
  );
}
