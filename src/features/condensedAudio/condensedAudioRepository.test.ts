import 'fake-indexeddb/auto';
import {
  saveRecord,
  getRecord,
  getAllRecords,
  deleteRecord,
  updateRecord,
} from './condensedAudioRepository';
import { closeDB, deleteDB } from '@/features/local-player';
import type { CondensedAudioRecord } from '@/entities/condensedAudio';

function record(id: string, overrides: Partial<CondensedAudioRecord> = {}): CondensedAudioRecord {
  return {
    id,
    title: `Clip ${id}`,
    source: { kind: 'library', videoId: `v-${id}` },
    leg: 'file',
    durationMs: 60000,
    sizeBytes: 1024,
    mimeType: 'audio/mpeg',
    opfsPath: `condensed/${id}.mp3`,
    exportFilename: null,
    exportState: 'none',
    driveFileId: null,
    driveSyncedAt: null,
    status: 'processing',
    error: null,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

beforeEach(async () => {
  closeDB();
  await deleteDB();
});

afterEach(() => {
  closeDB();
});

describe('condensedAudioRepository', () => {
  it('saves and reads a record', async () => {
    await saveRecord(record('a'));
    const got = await getRecord('a');
    expect(got?.title).toBe('Clip a');
    expect(got?.status).toBe('processing');
  });

  it('lists newest first by createdAt', async () => {
    await saveRecord(record('old', { createdAt: 1000 }));
    await saveRecord(record('new', { createdAt: 2000 }));
    const all = await getAllRecords();
    expect(all.map((r) => r.id)).toEqual(['new', 'old']);
  });

  it('updates fields and bumps updatedAt without touching id/createdAt', async () => {
    await saveRecord(record('a', { createdAt: 5, updatedAt: 5 }));
    const next = await updateRecord('a', { status: 'ready', sizeBytes: 2048 });
    expect(next?.status).toBe('ready');
    expect(next?.sizeBytes).toBe(2048);
    expect(next?.createdAt).toBe(5);
    expect(next?.updatedAt).toBeGreaterThan(5);
  });

  it('updateRecord returns undefined for missing id', async () => {
    expect(await updateRecord('ghost', { status: 'ready' })).toBeUndefined();
  });

  it('deletes a record', async () => {
    await saveRecord(record('a'));
    await deleteRecord('a');
    expect(await getRecord('a')).toBeUndefined();
  });
});
