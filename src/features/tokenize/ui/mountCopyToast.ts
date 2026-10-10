import { createToastHost } from '@/shared/ui/mountToast';
import { ShadowThemeProvider } from '@/features/theme';
import { t } from '@/shared/i18n';
import type { ToastKind } from '@/shared/ui/Toast';

const toastHost = createToastHost({ provider: ShadowThemeProvider });

export function showCopyToast(kind: ToastKind): void {
  toastHost.showToast(kind === 'success' ? t('tokenize.copy.success') : t('tokenize.copy.failed'), kind);
}
