// DeleteConfirmModal — confirm dialog before delete (spec F11).

import { type ReactElement } from 'react';
import type { ResourceInfo } from '@/entities/dictionary';
import styles from './DeleteConfirmModal.module.css';

interface DeleteConfirmModalProps {
  readonly resource: ResourceInfo;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function DeleteConfirmModal({ resource, onConfirm, onCancel }: DeleteConfirmModalProps): ReactElement {
  return (
    <div className={styles.overlay} onClick={onCancel} data-testid="delete-confirm-modal">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3 className={styles.title}>Xác nhận xóa</h3>
        <p className={styles.message}>
          Xóa &ldquo;{resource.name}&rdquo; ({resource.wordCount} mục)? Hành động này không thể hoàn tác.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.cancelButton} onClick={onCancel}>
            Hủy bỏ
          </button>
          <button type="button" className={styles.confirmButton} onClick={onConfirm} data-testid="confirm-delete">
            Xóa
          </button>
        </div>
      </div>
    </div>
  );
}
