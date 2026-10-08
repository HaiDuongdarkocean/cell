// capture — one-action save entry points for the mining queue.
// Cue rows funnel through these: queueSave → success/dedupe/error notify.
// Persistence failures always surface via notify — never silent
// (spec mining-queue.md).

import { queueSave } from './miningQueueClient';
import { queueItemFromCue } from '../logic/queueLogic';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { getActiveProfileSettings } from '@/entities/settings';
import { t } from '@/shared/i18n';
import type { BilingualCue } from '@/entities/media';

export type QueueNotify = (message: string, variant: 'success' | 'error' | 'info') => void;

function notifyError(notify: QueueNotify | undefined, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  notify?.(t('queue.error.action', [msg]), 'error');
}

export function saveCueToQueue(
  cue: BilingualCue,
  opts: {
    langCode?: string;
    videoId?: string;
    sourceLabel?: string;
    notify?: QueueNotify;
  } = {},
): void {
  void (async () => {
    // Sentence rows carry no langCode of their own — when the caller (tokenize
    // off) can't supply one, fall back to the active profile's resource lang.
    const langCode =
      opts.langCode ??
      (await loadSettings()
        .then((s) => getActiveProfileSettings(s)?.resourceLangCode)
        .catch(() => undefined)) ??
      'en';
    return queueSave(
      queueItemFromCue(cue, langCode, {
        sourceLabel: opts.sourceLabel,
        videoId: opts.videoId,
      }),
    );
  })()
    .then(({ deduped }) =>
      opts.notify?.(t(deduped ? 'queue.savedAgain' : 'queue.saved'), 'success'),
    )
    .catch((err: unknown) => notifyError(opts.notify, err));
}
