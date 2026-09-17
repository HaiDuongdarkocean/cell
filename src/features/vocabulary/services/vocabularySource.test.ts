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

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('createVocabularySource', () => {
  beforeEach(() => {
    sendMessage.mockReset();
  });

  it('loads entries for the normalized lang', async () => {
    sendMessage.mockResolvedValue(listResponse([{ term: 'a', status: 'known', updatedAt: 1 }]));

    const source = createVocabularySource('zh-Hans');
    await flush();

    expect(sendMessage).toHaveBeenCalledWith({
      type: MESSAGE_TYPES.WORD_STATUS_LIST,
      payload: { tabId: -1, langCode: 'zh' },
    });
    expect(source.getState().entries).toEqual([{ term: 'a', status: 'known', updatedAt: 1 }]);
    expect(source.getState().loaded).toBe(true);
    source.destroy();
  });

  it('buffers events arriving during the load await and replays them (A11)', async () => {
    let resolveList!: (v: unknown) => void;
    sendMessage.mockImplementation(
      () => new Promise((resolve) => { resolveList = resolve; }),
    );

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
    sendMessage.mockResolvedValue(listResponse([]));

    const source = createVocabularySource('en');
    await flush();
    emitWordStatusChanged({ langCode: 'en', term: 'x', status: 'ignore' });

    expect(source.getState().entries[0]!.term).toBe('x');
    expect(source.getState().entries[0]!.status).toBe('ignore');
    source.destroy();
  });

  it('normalizes event langCode before matching (A19)', async () => {
    sendMessage.mockResolvedValue(listResponse([]));

    const source = createVocabularySource('zh-hans');
    await flush();
    emitWordStatusChanged({ langCode: 'zh', term: '好', status: 'known' });

    expect(source.getState().entries).toHaveLength(1);
    source.destroy();
  });

  it('ignores events for other languages', async () => {
    sendMessage.mockResolvedValue(listResponse([]));

    const source = createVocabularySource('en');
    await flush();
    emitWordStatusChanged({ langCode: 'ja', term: 'x', status: 'known' });

    expect(source.getState().entries).toHaveLength(0);
    source.destroy();
  });

  it('cycle persists then emits onto the local bus so the row updates (A5)', async () => {
    sendMessage
      .mockResolvedValueOnce(listResponse([{ term: 'a', status: 'tracking', updatedAt: 1 }]))
      .mockResolvedValueOnce({ success: true, data: { status: 'known' } });

    const source = createVocabularySource('en');
    await flush();
    await source.cycle('a');

    expect(sendMessage).toHaveBeenLastCalledWith({
      type: MESSAGE_TYPES.WORD_STATUS_CYCLE,
      payload: { tabId: -1, langCode: 'en', term: 'a' },
    });
    expect(source.getState().entries[0]!.status).toBe('known');
    source.destroy();
  });

  it('remove deletes then emits removed so the row disappears (A7/A10)', async () => {
    sendMessage
      .mockResolvedValueOnce(listResponse([{ term: 'a', status: 'known', updatedAt: 1 }]))
      .mockResolvedValueOnce({ success: true });

    const source = createVocabularySource('en');
    await flush();
    await source.remove('a');

    expect(sendMessage).toHaveBeenLastCalledWith({
      type: MESSAGE_TYPES.WORD_STATUS_DELETE,
      payload: { tabId: -1, langCode: 'en', term: 'a' },
    });
    expect(source.getState().entries).toHaveLength(0);
    source.destroy();
  });

  it('stops applying events after destroy', async () => {
    sendMessage.mockResolvedValue(listResponse([]));

    const source = createVocabularySource('en');
    await flush();
    source.destroy();
    emitWordStatusChanged({ langCode: 'en', term: 'x', status: 'known' });

    expect(source.getState().entries).toHaveLength(0);
  });
});
