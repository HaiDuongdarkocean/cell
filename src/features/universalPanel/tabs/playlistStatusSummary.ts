import type { CondensedAudioRecord, CondensedAudioStatus } from '@/entities/condensedAudio';
import { t } from '@/shared/i18n';

/**
 * summarizeStatusTransitions — diff a refresh() result against the previous
 * record statuses and produce the single role="status" announcement.
 *
 * Only transitions into 'ready' or 'failed' count — intermediate churn
 * (processing → recording → finalizing) stays silent. First refresh (prev
 * null) announces nothing: entry state is not a transition.
 */
export function summarizeStatusTransitions(
  prev: ReadonlyMap<string, CondensedAudioStatus> | null,
  next: readonly CondensedAudioRecord[],
): string {
  if (!prev) return '';
  let ready = 0;
  let failed = 0;
  for (const record of next) {
    const before = prev.get(record.id);
    if (before === undefined || before === record.status) continue;
    if (record.status === 'ready') ready += 1;
    else if (record.status === 'failed') failed += 1;
  }
  const parts: string[] = [];
  if (ready > 0) {
    parts.push(t(ready === 1 ? 'playlist.status.readyOne' : 'playlist.status.readyMany', [ready]));
  }
  if (failed > 0) {
    parts.push(t(failed === 1 ? 'playlist.status.failedOne' : 'playlist.status.failedMany', [failed]));
  }
  return parts.join(' ');
}
