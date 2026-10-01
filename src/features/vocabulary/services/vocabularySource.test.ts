const sendMessage = jest.fn() as jest.MockedFunction<(message: unknown) => Promise<unknown>>;

jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  sendMessage: (message: unknown) => sendMessage(message),
}));

import { createVocabularySource } from './vocabularySource';
import {
  emitWordStatusChanged,
  emitWordStatusRemoved,
} from '@/features/dictionary';
import { MESSAGE_TYPES } from '@/shared/config/messages';

function listResponse(entries: unknown[]): unknown {
  return { success: true, data: { entries } };
}

function mockBackend(responses: Record<string, unknown>): void {
  sendMessage.mockImplementation((message) => {
    const type = (message as { type: string }).type;
    if (type in responses) return Promise.resolve(responses[type]);
    return Promise.resolve({ success: true });
  });
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const callsOfType = (type: string): unknown[] =>
  sendMessage.mock.calls
    .map(([m]) => m as { type: string; payload: unknown })
    .filter((m) => m.type === type);

describe('createVocabularySource', () => {
  beforeEach(() => {
    sendMessage.mockReset();
  });

  it('loads entries + trash for the normalized lang', async () => {
    mockBackend({
      [MESSAGE_TYPES.WORD_STATUS_LIST]: listResponse([{ term: 'a', status: 'known', updatedAt: 1 }]),
      [MESSAGE_TYPES.WORD_STATUS_TRASH_LIST]: listResponse([{ term: 'b', previousStatus: 'tracking', trashedAt: 2 }]),
    });

    const source = createVocabularySource('zh-Hans');
    await flush();

    expect(callsOfType(MESSAGE_TYPES.WORD_STATUS_LIST)[0]).toMatchObject({
      payload: { tabId: -1, langCode: 'zh' },
    });
    expect(source.getState().entries).toEqual([{ term: 'a', status: 'known', updatedAt: 1 }]);
    expect(source.getState().trash).toEqual([{ term: 'b', previousStatus: 'tracking', trashedAt: 2 }]);
    expect(source.getState().loaded).toBe(true);
    source.destroy();
  });

  it('buffers events arriving during the load await and replays them (A11)', async () => {
    let resolveList!: (v: unknown) => void;
    sendMessage.mockImplementation((message) => {
      const type = (message as { type: string }).type;
      if (type === MESSAGE_TYPES.WORD_STATUS_LIST) {
        return new Promise((resolve) => { resolveList = resolve; });
      }
      return Promise.resolve(listResponse([]));
    });

    const source = createVocabularySource('en');
    emitWordStatusChanged({ langCode: 'en', term: 'new', status: 'tracking' });
    emitWordStatusRemoved({ langCode: 'en', term: 'a' });
    resolveList(listResponse([{ term: 'a', status: 'known', updatedAt: 1 }]));
    await flush();

    const terms = source.getState().entries.map((e) => e.term);
    expect(terms).toEqual(['new']);
    expect(source.getState().entries[0]!.status).toBe('tracking');
    source.destroy();
  });

  it('applies live events after load (A8)', async () => {
    mockBackend({ [MESSAGE_TYPES.WORD_STATUS_LIST]: listResponse([]) });

    const source = createVocabularySource('en');
    await flush();
    emitWordStatusChanged({ langCode: 'en', term: 'x', status: 'ignore' });

    expect(source.getState().entries[0]!.term).toBe('x');
    expect(source.getState().entries[0]!.status).toBe('ignore');
    source.destroy();
  });

  it('treats an incoming changed{status:unknown} event as a removal (REQ-8)', async () => {
    mockBackend({
      [MESSAGE_TYPES.WORD_STATUS_LIST]: listResponse([{ term: 'a', status: 'known', updatedAt: 1 }]),
    });

    const source = createVocabularySource('en');
    await flush();
    emitWordStatusChanged({ langCode: 'en', term: 'a', status: 'unknown' });

    expect(source.getState().entries).toHaveLength(0);
    source.destroy();
  });

  it('drops the trash record when a term is re-marked (re-mark cancels deletion)', async () => {
    mockBackend({
      [MESSAGE_TYPES.WORD_STATUS_LIST]: listResponse([]),
      [MESSAGE_TYPES.WORD_STATUS_TRASH_LIST]: listResponse([
        { term: 'a', previousStatus: 'known', trashedAt: 5 },
      ]),
    });

    const source = createVocabularySource('en');
    await flush();
    expect(source.getState().trash).toHaveLength(1);
    emitWordStatusChanged({ langCode: 'en', term: 'a', status: 'tracking' });

    expect(source.getState().trash).toHaveLength(0);
    expect(source.getState().entries[0]!.status).toBe('tracking');
    source.destroy();
  });

  it('normalizes event langCode before matching (A19)', async () => {
    mockBackend({ [MESSAGE_TYPES.WORD_STATUS_LIST]: listResponse([]) });

    const source = createVocabularySource('zh-hans');
    await flush();
    emitWordStatusChanged({ langCode: 'zh', term: '好', status: 'known' });

    expect(source.getState().entries).toHaveLength(1);
    source.destroy();
  });

  it('ignores events for other languages', async () => {
    mockBackend({ [MESSAGE_TYPES.WORD_STATUS_LIST]: listResponse([]) });

    const source = createVocabularySource('en');
    await flush();
    emitWordStatusChanged({ langCode: 'ja', term: 'x', status: 'known' });

    expect(source.getState().entries).toHaveLength(0);
    source.destroy();
  });

  it('cycle writes the next marked status via WORD_STATUS_SET and emits locally (A5)', async () => {
    mockBackend({
      [MESSAGE_TYPES.WORD_STATUS_LIST]: listResponse([{ term: 'a', status: 'tracking', updatedAt: 1 }]),
    });

    const source = createVocabularySource('en');
    await flush();
    await source.cycle('a');

    expect(callsOfType(MESSAGE_TYPES.WORD_STATUS_SET)[0]).toMatchObject({
      payload: { tabId: -1, langCode: 'en', term: 'a', status: 'learning' },
    });
    expect(source.getState().entries[0]!.status).toBe('learning');
    source.destroy();
  });

  it('cycle wraps ignore back to tracking — never unknown (user refinement)', async () => {
    mockBackend({
      [MESSAGE_TYPES.WORD_STATUS_LIST]: listResponse([{ term: 'a', status: 'ignore', updatedAt: 1 }]),
    });

    const source = createVocabularySource('en');
    await flush();
    await source.cycle('a');

    expect(callsOfType(MESSAGE_TYPES.WORD_STATUS_SET)[0]).toMatchObject({
      payload: { status: 'tracking' },
    });
    expect(source.getState().entries[0]!.status).toBe('tracking');
    source.destroy();
  });

  it('trash soft-deletes, emits removed, and refreshes the trash list', async () => {
    mockBackend({
      [MESSAGE_TYPES.WORD_STATUS_LIST]: listResponse([{ term: 'a', status: 'known', updatedAt: 1 }]),
      [MESSAGE_TYPES.WORD_STATUS_TRASH_LIST]: listResponse([
        { term: 'a', previousStatus: 'known', trashedAt: 9 },
      ]),
    });

    const source = createVocabularySource('en');
    await flush();
    await source.trash('a');

    expect(callsOfType(MESSAGE_TYPES.WORD_STATUS_TRASH)[0]).toMatchObject({
      payload: { tabId: -1, langCode: 'en', term: 'a' },
    });
    expect(source.getState().entries).toHaveLength(0);
    expect(source.getState().trash).toEqual([{ term: 'a', previousStatus: 'known', trashedAt: 9 }]);
    source.destroy();
  });

  it('restore emits changed with the server-restored status and refreshes trash', async () => {
    let trashReads = 0;
    sendMessage.mockImplementation((message) => {
      const type = (message as { type: string }).type;
      if (type === MESSAGE_TYPES.WORD_STATUS_LIST) return Promise.resolve(listResponse([]));
      if (type === MESSAGE_TYPES.WORD_STATUS_TRASH_LIST) {
        trashReads += 1;
        return Promise.resolve(
          listResponse(trashReads === 1 ? [{ term: 'a', previousStatus: 'ignore', trashedAt: 3 }] : []),
        );
      }
      if (type === MESSAGE_TYPES.WORD_STATUS_RESTORE) {
        return Promise.resolve({ success: true, data: { status: 'ignore' } });
      }
      return Promise.resolve({ success: true });
    });

    const source = createVocabularySource('en');
    await flush();
    await source.restore('a');

    expect(callsOfType(MESSAGE_TYPES.WORD_STATUS_RESTORE)[0]).toMatchObject({
      payload: { tabId: -1, langCode: 'en', term: 'a' },
    });
    expect(source.getState().entries).toEqual([
      expect.objectContaining({ term: 'a', status: 'ignore' }),
    ]);
    expect(source.getState().trash).toHaveLength(0);
    source.destroy();
  });

  it('deleteTrash removes the record locally without touching status entries', async () => {
    let trashReads = 0;
    sendMessage.mockImplementation((message) => {
      const type = (message as { type: string }).type;
      if (type === MESSAGE_TYPES.WORD_STATUS_LIST) return Promise.resolve(listResponse([]));
      if (type === MESSAGE_TYPES.WORD_STATUS_TRASH_LIST) {
        trashReads += 1;
        return Promise.resolve(
          listResponse(trashReads === 1 ? [{ term: 'a', previousStatus: 'known', trashedAt: 3 }] : []),
        );
      }
      return Promise.resolve({ success: true });
    });

    const source = createVocabularySource('en');
    await flush();
    expect(source.getState().trash).toHaveLength(1);
    await source.deleteTrash('a');

    expect(callsOfType(MESSAGE_TYPES.WORD_STATUS_TRASH_DELETE)[0]).toMatchObject({
      payload: { tabId: -1, langCode: 'en', term: 'a' },
    });
    expect(source.getState().trash).toHaveLength(0);
    source.destroy();
  });

  it('stops applying events after destroy', async () => {
    mockBackend({ [MESSAGE_TYPES.WORD_STATUS_LIST]: listResponse([]) });

    const source = createVocabularySource('en');
    await flush();
    source.destroy();
    emitWordStatusChanged({ langCode: 'en', term: 'x', status: 'known' });

    expect(source.getState().entries).toHaveLength(0);
  });
});
