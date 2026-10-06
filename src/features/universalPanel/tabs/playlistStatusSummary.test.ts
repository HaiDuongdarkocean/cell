import { summarizeStatusTransitions } from './playlistStatusSummary';
import type { CondensedAudioRecord, CondensedAudioStatus } from '@/entities/condensedAudio';

function rec(id: string, status: CondensedAudioStatus): CondensedAudioRecord {
  return {
    id,
    title: id,
    source: { kind: 'library', videoId: 'v' },
    leg: 'file',
    durationMs: 1000,
    sizeBytes: 10,
    mimeType: 'audio/mpeg',
    opfsPath: `/x/${id}`,
    exportFilename: null,
    exportState: 'none',
    driveFileId: null,
    driveSyncedAt: null,
    status,
    error: null,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('summarizeStatusTransitions', () => {
  it('announces nothing on the first refresh (prev null)', () => {
    expect(summarizeStatusTransitions(null, [rec('a', 'ready')])).toBe('');
  });

  it('announces nothing when no status changed', () => {
    const prev = new Map([['a', 'ready' as const]]);
    expect(summarizeStatusTransitions(prev, [rec('a', 'ready')])).toBe('');
  });

  it('announces one ready transition with singular wording', () => {
    const prev = new Map([['a', 'processing' as const]]);
    expect(summarizeStatusTransitions(prev, [rec('a', 'ready')])).toBe('1 recording ready');
  });

  it('announces plural counts for ready and failed together', () => {
    const prev = new Map<string, CondensedAudioStatus>([
      ['a', 'processing'],
      ['b', 'recording'],
      ['c', 'finalizing'],
    ]);
    const summary = summarizeStatusTransitions(prev, [
      rec('a', 'ready'),
      rec('b', 'ready'),
      rec('c', 'failed'),
    ]);
    expect(summary).toBe('2 recordings ready 1 recording failed');
  });

  it('ignores transitions that do not land on ready or failed', () => {
    const prev = new Map([['a', 'processing' as const]]);
    expect(summarizeStatusTransitions(prev, [rec('a', 'recording')])).toBe('');
  });

  it('ignores records that were not present before', () => {
    const prev = new Map([['a', 'ready' as const]]);
    expect(summarizeStatusTransitions(prev, [rec('a', 'ready'), rec('b', 'ready')])).toBe('');
  });
});
