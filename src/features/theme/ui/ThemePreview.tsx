// ThemePreview — live preview của theme tokens (spec F4).
//
// Render buttons (primary/secondary/disabled), typography (5 levels), card,
// form+input, dropzone, toast (success/error). Tất cả dùng var(--color-*) nên
// auto-update khi themeManager.applyTheme đổi CSS vars.

import { Button, Card, Input } from '@/shared/ui';
import styles from './ThemePreview.module.css';

export function ThemePreview(): React.JSX.Element {
  return (
    <div className={styles.preview} data-cell-id="theme-preview">
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Buttons</div>
        <div className={styles.row}>
          <Button material="solid" variant="primary" size="sm">Primary</Button>
          <Button material="solid" variant="secondary" size="sm">Secondary</Button>
          <Button material="solid" variant="primary" size="sm" disabled>Disabled</Button>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Typography</div>
        <div className={styles.typography}>
          <span className={styles.textPrimary}>Primary text — body content</span>
          <span className={styles.textSecondary}>Secondary text — labels, hints</span>
          <span className={styles.textSuccess}>Success — operation completed</span>
          <span className={styles.textWarning}>Warning — check your input</span>
          <span className={styles.textError}>Error — something went wrong</span>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Card</div>
        <Card className={styles.card}>Card content — surface with border</Card>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Form</div>
        <div className={styles.row}>
          <Input className={styles.input} placeholder="Text input" />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Dropzone</div>
        <div className={styles.dropzone}>Drag file here or click to browse</div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Toast</div>
        <div className={styles.row}>
          <span className={`${styles.toast} ${styles.toastSuccess}`}>Success toast</span>
          <span className={`${styles.toast} ${styles.toastError}`}>Error toast</span>
        </div>
      </div>
    </div>
  );
}
