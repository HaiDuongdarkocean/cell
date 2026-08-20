import 'fake-indexeddb/auto';
import {
  saveVideo,
  getVideo,
  getAllVideos,
  deleteVideo,
  updateResumePosition,
  addHistoryEntry,
  getHistory,
  clearHistory,
  saveSubtitle,
  getAllSubtitles,
  getSubtitle,
  closeDB,
  deleteDB,
  DB_NAME,
  DB_VERSION,
  INDEXES,
  type VideoRecord,
  type HistoryRecord,
  type SubtitleRecord,
} from './mediaLibraryRepository';

import videoEntries from '../../../../tests/data-test/local-player/samples/library-metadata/video-entries.json';
import historyEntries from '../../../../tests/data-test/local-player/samples/library-metadata/history-entries.json';

// ─── Fixtures ────────────────────────────────────────────────────────────────
const videos = videoEntries as unknown as VideoRecord[];
const histories = historyEntries as unknown as HistoryRecord[];

// ─── Setup / teardown ────────────────────────────────────────────────────────
beforeEach(async () => {
  closeDB();
  await deleteDB();
});

afterEach(() => {
  closeDB();
});

// ─── DB structure ────────────────────────────────────────────────────────────
describe('mediaLibraryRepository — DB structure', () => {
  it('opens DB with name orca-local-player and version 2', async () => {
    // Trigger DB open by calling getAllVideos.
    await getAllVideos();
    // Re-open via internal getDB is cached; verify constants.
    expect(DB_NAME).toBe('orca-local-player');
    expect(DB_VERSION).toBe(2);
  });

  it('creates videos store with keyPath id', async () => {
    await getAllVideos();
    // If the store didn't exist, getAllVideos would throw.
    // Verify by saving + getting a video.
    const v = videos[0];
    await saveVideo(v);
    const got = await getVideo(v.id);
    expect(got).toBeDefined();
  });

  it('creates history store with by_videoId and by_watchedAt indexes', async () => {
    // Trigger DB creation.
    await getHistory();
    // Verify indexes exist by adding + retrieving by videoId.
    const h = histories[0];
    await addHistoryEntry(h);
    const result = await getHistory();
    expect(result).toHaveLength(1);
    expect(INDEXES.by_videoId).toBe('by_videoId');
    expect(INDEXES.by_watchedAt).toBe('by_watchedAt');
  });

  it('creates subtitles store with keyPath id', async () => {
    // Trigger DB creation.
    await getAllSubtitles();
    // Verify by saving + getting a subtitle.
    const sub: SubtitleRecord = {
      id: 'test.srt',
      filename: 'test.srt',
      languageCode: 'en',
      addedAt: '2024-01-01',
    };
    await saveSubtitle(sub);
    const got = await getSubtitle('test.srt');
    expect(got).toBeDefined();
    expect(got?.filename).toBe('test.srt');
  });
});

// ─── Video CRUD ──────────────────────────────────────────────────────────────
describe('mediaLibraryRepository — video CRUD', () => {
  describe('saveVideo + getVideo roundtrip (ALL 26 entries)', () => {
    // Test every single entry — verify all fields preserved.
    videos.forEach((entry) => {
      it(`roundtrips ${entry.id} (${entry.title})`, async () => {
        await saveVideo(entry);
        const got = await getVideo(entry.id);
        expect(got).toBeDefined();
        // Deep equality — all fields preserved.
        expect(got).toEqual(entry);
      });
    });
  });

  it('getVideo returns undefined for non-existent id', async () => {
    const got = await getVideo('non-existent-id');
    expect(got).toBeUndefined();
  });

  it('getAllVideos returns all 26 entries', async () => {
    for (const v of videos) {
      await saveVideo(v);
    }
    const all = await getAllVideos();
    expect(all).toHaveLength(26);
    // Verify every entry id is present.
    const ids = new Set(all.map((v) => v.id));
    videos.forEach((v) => expect(ids.has(v.id)).toBe(true));
  });

  it('deleteVideo removes entry → getAllVideos returns 25', async () => {
    for (const v of videos) {
      await saveVideo(v);
    }
    await deleteVideo(videos[0].id);
    const all = await getAllVideos();
    expect(all).toHaveLength(25);
    expect(all.find((v) => v.id === videos[0].id)).toBeUndefined();
  });

  it('deleteVideo on non-existent id does not throw', async () => {
    await expect(deleteVideo('non-existent')).resolves.not.toThrow();
  });

  it('saveVideo upserts (overwrites existing entry)', async () => {
    const v = { ...videos[0], title: 'Updated Title' };
    await saveVideo(videos[0]);
    await saveVideo(v);
    const got = await getVideo(v.id);
    expect(got?.title).toBe('Updated Title');
  });
});

// ─── updateResumePosition ────────────────────────────────────────────────────
describe('mediaLibraryRepository — updateResumePosition', () => {
  it('updates only resumePositionMs + lastWatchedAt, preserves other fields', async () => {
    const original = videos[1]; // vid-002: resumePositionMs=3600000
    await saveVideo(original);

    const newLastWatched = '2026-08-01T12:00:00.000Z';
    await updateResumePosition(original.id, 5000000, newLastWatched);

    const got = await getVideo(original.id);
    expect(got).toBeDefined();
    expect(got!.resumePositionMs).toBe(5000000);
    expect(got!.lastWatchedAt).toBe(newLastWatched);
    // Other fields unchanged.
    expect(got!.filename).toBe(original.filename);
    expect(got!.title).toBe(original.title);
    expect(got!.durationMs).toBe(original.durationMs);
    expect(got!.addedAt).toBe(original.addedAt);
    expect(got!.fileSizeBytes).toBe(original.fileSizeBytes);
    expect(got!.width).toBe(original.width);
    expect(got!.height).toBe(original.height);
    expect(got!.codec).toBe(original.codec);
  });

  it('throws if video not found', async () => {
    await expect(
      updateResumePosition('non-existent', 1000, '2026-01-01T00:00:00.000Z'),
    ).rejects.toThrow();
  });

  it('updates entry with null lastWatchedAt → sets new value', async () => {
    // vid-003 has lastWatchedAt=null
    const unwatched = videos.find((v) => v.lastWatchedAt === null)!;
    await saveVideo(unwatched);
    const newLastWatched = '2026-08-01T12:00:00.000Z';
    await updateResumePosition(unwatched.id, 1000, newLastWatched);
    const got = await getVideo(unwatched.id);
    expect(got!.lastWatchedAt).toBe(newLastWatched);
    expect(got!.resumePositionMs).toBe(1000);
  });

  it('updates entry with 0 resumePositionMs', async () => {
    const v = videos.find((entry) => entry.resumePositionMs === 0)!;
    await saveVideo(v);
    await updateResumePosition(v.id, 0, '2026-08-01T12:00:00.000Z');
    const got = await getVideo(v.id);
    expect(got!.resumePositionMs).toBe(0);
  });
});

// ─── Special characters / CJK / long names ───────────────────────────────────
describe('mediaLibraryRepository — special characters', () => {
  it('preserves special chars (Amélie)', async () => {
    const amelie = videos.find((v) => v.title.includes('Amélie'))!;
    await saveVideo(amelie);
    const got = await getVideo(amelie.id);
    expect(got!.title).toBe('Amélie');
    expect(got!.filename).toContain('Amélie');
  });

  it('preserves CJK characters (君の名は / 流浪地球 / 사랑의 불시착)', async () => {
    const cjkEntries = videos.filter(
      (v) =>
        v.title.includes('君の名は') ||
        v.title.includes('流浪地球') ||
        v.title.includes('사랑의 불시착'),
    );
    expect(cjkEntries.length).toBeGreaterThanOrEqual(3);
    for (const entry of cjkEntries) {
      await saveVideo(entry);
      const got = await getVideo(entry.id);
      expect(got!.title).toBe(entry.title);
    }
  });

  it('preserves long filenames (LOTR)', async () => {
    const lotr = videos.find((v) => v.filename.includes('Lord.of.the.Rings'))!;
    await saveVideo(lotr);
    const got = await getVideo(lotr.id);
    expect(got!.filename).toBe(lotr.filename);
    expect(got!.filename.length).toBeGreaterThan(50);
  });

  it('preserves bracket-style filenames ([HorribleSubs] ...)', async () => {
    const bracket = videos.find((v) => v.filename.startsWith('['))!;
    await saveVideo(bracket);
    const got = await getVideo(bracket.id);
    expect(got!.filename).toBe(bracket.filename);
  });
});

// ─── History ─────────────────────────────────────────────────────────────────
describe('mediaLibraryRepository — history', () => {
  it('addHistoryEntry + getHistory returns sorted by watchedAt desc', async () => {
    for (const h of histories) {
      await addHistoryEntry(h);
    }
    const result = await getHistory();
    expect(result).toHaveLength(22);
    // Verify descending order.
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].watchedAt >= result[i].watchedAt).toBe(true);
    }
  });

  it('multi-session chain (hist-003a/b/c same videoId) — all 3 returned in order', async () => {
    const chain = histories.filter((h) => h.id.startsWith('hist-003'));
    expect(chain).toHaveLength(3);
    for (const h of chain) {
      await addHistoryEntry(h);
    }
    const result = await getHistory();
    const chainResults = result.filter((h) => h.id.startsWith('hist-003'));
    expect(chainResults).toHaveLength(3);
    // Order: 003c (2026-07-11) > 003b (2026-07-10) > 003a (2026-07-09)
    expect(chainResults[0].id).toBe('hist-003c');
    expect(chainResults[1].id).toBe('hist-003b');
    expect(chainResults[2].id).toBe('hist-003a');
  });

  it('clearHistory removes all entries → getHistory returns []', async () => {
    for (const h of histories) {
      await addHistoryEntry(h);
    }
    await clearHistory();
    const result = await getHistory();
    expect(result).toEqual([]);
  });

  it('clearHistory on empty history does not throw', async () => {
    await expect(clearHistory()).resolves.not.toThrow();
  });

  it('addHistoryEntry upserts (same id overwrites)', async () => {
    const h = histories[0];
    await addHistoryEntry(h);
    const updated = { ...h, positionMs: 999999 };
    await addHistoryEntry(updated);
    const result = await getHistory();
    expect(result).toHaveLength(1);
    expect(result[0].positionMs).toBe(999999);
  });

  it('preserves all fields on roundtrip for every history entry', async () => {
    for (const h of histories) {
      await addHistoryEntry(h);
    }
    const result = await getHistory();
    // Verify every entry matches its fixture.
    for (const h of histories) {
      const got = result.find((r) => r.id === h.id);
      expect(got).toBeDefined();
      expect(got).toEqual(h);
    }
  });
});

// ─── FileSystemFileHandle storage ────────────────────────────────────────────
describe('mediaLibraryRepository — FileSystemFileHandle storage', () => {
  // Source: MDN IndexedDB API — "any objects supported by the structured clone
  // algorithm can be stored" (https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API).
  // FileSystemFileHandle is serializable via structured clone (File System Access API).
  // In tests, fake-indexeddb uses a JSON-based structuredClone polyfill (tests/setup.ts),
  // so we mock the handle as a plain object cast to FileSystemFileHandle.

  it('stores and retrieves a FileSystemFileHandle in a video record', async () => {
    const mockHandle = {
      kind: 'file',
      name: 'test-video.mp4',
    } as unknown as FileSystemFileHandle;

    const video: VideoRecord = {
      id: 'vid-handle-test',
      filename: 'test-video.mp4',
      title: 'Handle Test',
      durationMs: 1000,
      addedAt: '2026-01-01T00:00:00.000Z',
      lastWatchedAt: null,
      resumePositionMs: 0,
      fileHandle: mockHandle,
    };

    await saveVideo(video);
    const got = await getVideo(video.id);
    expect(got).toBeDefined();
    expect(got!.fileHandle).toBeDefined();
    // The handle is cloned (JSON roundtrip in test env) — verify properties.
    expect(got!.fileHandle?.kind).toBe('file');
    expect(got!.fileHandle?.name).toBe('test-video.mp4');
  });

  it('retrieves video without fileHandle (optional field)', async () => {
    const video: VideoRecord = {
      id: 'vid-no-handle',
      filename: 'no-handle.mp4',
      title: 'No Handle',
      durationMs: 2000,
      addedAt: '2026-01-01T00:00:00.000Z',
      lastWatchedAt: null,
      resumePositionMs: 0,
    };
    await saveVideo(video);
    const got = await getVideo(video.id);
    expect(got).toBeDefined();
    expect(got!.fileHandle).toBeUndefined();
  });

  it('updateResumePosition preserves fileHandle', async () => {
    const mockHandle = {
      kind: 'file',
      name: 'preserve-handle.mkv',
    } as unknown as FileSystemFileHandle;

    const video: VideoRecord = {
      id: 'vid-preserve-handle',
      filename: 'preserve-handle.mkv',
      title: 'Preserve Handle',
      durationMs: 5000,
      addedAt: '2026-01-01T00:00:00.000Z',
      lastWatchedAt: null,
      resumePositionMs: 0,
      fileHandle: mockHandle,
    };
    await saveVideo(video);
    await updateResumePosition(video.id, 3000, '2026-08-01T10:00:00.000Z');
    const got = await getVideo(video.id);
    expect(got!.fileHandle).toBeDefined();
    expect(got!.fileHandle?.name).toBe('preserve-handle.mkv');
    expect(got!.resumePositionMs).toBe(3000);
  });
});
