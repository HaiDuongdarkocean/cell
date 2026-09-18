import 'fake-indexeddb/auto';
import {
  buildSubtitleRecord,
  buildVideoRecord,
  persistVideoRecord,
} from './mediaPersistence';
import {
  closeDB,
  deleteDB,
  getVideo,
  saveVideo,
  type VideoComprehension,
  type VideoRecord,
} from '@/features/local-player/services/mediaLibraryRepository';

beforeEach(async () => {
  closeDB();
  await deleteDB();
});

afterEach(() => {
  closeDB();
});

const comp = (coverage: number): VideoComprehension => ({
  coverage,
  band: 'comfortable',
  newTerms: 3,
  subtitleFilename: 'show.en.srt',
  computedAt: '2026-10-03T00:00:00.000Z',
});

const file = (name: string): File =>
  new File(['x'], name, { lastModified: 1000 });

describe('persistVideoRecord — comprehension preservation', () => {
  it('keeps the existing comprehension when the incoming record lacks it', async () => {
    const existing: VideoRecord = {
      ...buildVideoRecord(file('show.mkv')),
      comprehension: comp(96.2),
    };
    await saveVideo(existing);

    const fresh = buildVideoRecord(file('show.mkv'));
    await persistVideoRecord(fresh);

    const got = await getVideo(existing.id);
    expect(got!.comprehension).toEqual(comp(96.2));
    expect(got!.lastWatchedAt).toBe(fresh.lastWatchedAt);
  });

  it('does not overwrite an explicitly provided comprehension', async () => {
    const existing: VideoRecord = {
      ...buildVideoRecord(file('show.mkv')),
      comprehension: comp(80),
    };
    await saveVideo(existing);

    const fresh: VideoRecord = {
      ...buildVideoRecord(file('show.mkv')),
      comprehension: comp(97.7),
    };
    await persistVideoRecord(fresh);

    const got = await getVideo(existing.id);
    expect(got!.comprehension!.coverage).toBe(97.7);
  });

  it('writes a clean record when no prior record exists', async () => {
    const fresh = buildVideoRecord(file('new.mkv'));
    await persistVideoRecord(fresh);

    const got = await getVideo(fresh.id);
    expect(got).toBeDefined();
    expect(got!.comprehension).toBeUndefined();
  });
});

describe('buildSubtitleRecord', () => {
  it('threads the provided file handle', () => {
    const handle = { kind: 'file', name: 'show.en.srt' } as FileSystemFileHandle;
    const record = buildSubtitleRecord(file('show.en.srt'), handle);
    expect(record.fileHandle).toBe(handle);
  });

  it('leaves fileHandle undefined when none is given', () => {
    const record = buildSubtitleRecord(file('show.en.srt'));
    expect(record.fileHandle).toBeUndefined();
  });
});
