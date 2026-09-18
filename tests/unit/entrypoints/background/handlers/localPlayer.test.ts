import 'fake-indexeddb/auto';
import { registerLocalPlayerHandlers } from '@/entrypoints/background/handlers/localPlayer';
import type { BackgroundContext } from '@/entrypoints/background/context';
import type { MessageHandler, MessageRequest } from '@/entities/message';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import {
  closeDB,
  deleteDB,
  getVideo,
  saveVideo,
  type VideoComprehension,
  type VideoRecord,
} from '@/features/local-player/services/mediaLibraryRepository';

const handlers = new Map<string, MessageHandler>();

const ctx = {
  on: (type: string, handler: MessageHandler) => {
    handlers.set(type, handler);
  },
} as unknown as BackgroundContext;

registerLocalPlayerHandlers(ctx);

beforeEach(async () => {
  closeDB();
  await deleteDB();
});

afterEach(() => {
  closeDB();
});

const comp: VideoComprehension = {
  coverage: 94.8,
  band: 'stretch',
  newTerms: 12,
  subtitleFilename: 'show.en.srt',
  computedAt: '2026-10-03T00:00:00.000Z',
};

const baseRecord = (id: string): VideoRecord => ({
  id,
  filename: 'show.mkv',
  title: 'show',
  durationMs: 120000,
  addedAt: '2026-01-01T00:00:00.000Z',
  lastWatchedAt: '2026-09-01T00:00:00.000Z',
  resumePositionMs: 5000,
  comprehension: comp,
});

const openRequest = (videoId: string): MessageRequest => ({
  type: MESSAGE_TYPES.LOCAL_PLAYER_VIDEO_OPENED,
  payload: {
    videoId,
    filename: 'show.mkv',
    title: 'show',
    durationMs: 120000,
  },
});

describe('LOCAL_PLAYER_VIDEO_OPENED', () => {
  it('preserves the existing comprehension on the upserted record', async () => {
    await saveVideo(baseRecord('vid-1'));

    const handler = handlers.get(MESSAGE_TYPES.LOCAL_PLAYER_VIDEO_OPENED);
    expect(handler).toBeDefined();
    const res = await handler!(openRequest('vid-1'));

    expect(res.success).toBe(true);
    const got = await getVideo('vid-1');
    expect(got!.comprehension).toEqual(comp);
    expect(got!.resumePositionMs).toBe(0);
  });

  it('creates a record without comprehension for new videos', async () => {
    const handler = handlers.get(MESSAGE_TYPES.LOCAL_PLAYER_VIDEO_OPENED);
    const res = await handler!(openRequest('vid-new'));

    expect(res.success).toBe(true);
    const got = await getVideo('vid-new');
    expect(got).toBeDefined();
    expect(got!.comprehension).toBeUndefined();
  });
});
