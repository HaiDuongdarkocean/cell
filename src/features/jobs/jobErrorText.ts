import { t } from '@/shared/i18n';
import type { MessageKey } from '@/shared/i18n';

const ERROR_KEYS: Record<string, MessageKey> = {
  'interrupted-restart': 'jobs.error.interrupted-restart',
  'interrupted-upload-stall': 'jobs.error.interrupted-upload-stall',
  'interrupted-upload-ttl': 'jobs.error.interrupted-upload-ttl',
};

export function jobErrorText(error: string): string {
  const key = ERROR_KEYS[error];
  return key === undefined ? error : t(key);
}
