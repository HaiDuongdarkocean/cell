import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const sendMessage = jest.fn() as jest.MockedFunction<(message: unknown) => Promise<unknown>>;

jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  sendMessage: (message: unknown) => sendMessage(message),
}));

import {
  getWordStatuses,
  setWordStatus,
  listWordStatuses,
  cycleWordStatus,
  deleteWordStatus,
  normalizeLangCode,
} from './wordStatusClient';
import { MESSAGE_TYPES } from '@/shared/config/messages';

beforeEach(() => {
  sendMessage.mockReset();
});

describe('normalizeLangCode', () => {
  it('strips region variants and lowercases', () => {
    expect(normalizeLangCode('zh-hans')).toBe('zh');
    expect(normalizeLangCode('zh-Hant')).toBe('zh');
    expect(normalizeLangCode('EN')).toBe('en');
  });

  it('falls back to en for empty or invalid input', () => {
    expect(normalizeLangCode('')).toBe('en');
    expect(normalizeLangCode('x')).toBe('en');
  });
});

describe('wordStatusClient', () => {
  describe('getWordStatuses', () => {
    it('returns an empty map for empty terms', async () => {
      const result = await getWordStatuses('en', []);
      expect(result.size).toBe(0);
      expect(sendMessage).not.toHaveBeenCalled();
    });

    it('sends WORD_STATUSES_GET and converts the response to a Map', async () => {
      sendMessage.mockResolvedValue({
        success: true,
        data: { statuses: { hello: 'known', world: 'tracking' } },
      });

      const result = await getWordStatuses('en', ['hello', 'world']);

      expect(sendMessage).toHaveBeenCalledWith({
        type: MESSAGE_TYPES.WORD_STATUSES_GET,
        payload: { tabId: -1, langCode: 'en', terms: ['hello', 'world'] },
      });
      expect(result.get('hello')).toBe('known');
      expect(result.get('world')).toBe('tracking');
    });

    it('chunks large term lists to stay under the 1000-term schema cap', async () => {
      sendMessage.mockImplementation((message) => {
        const terms = (message as { payload: { terms: string[] } }).payload.terms;
        expect(terms.length).toBeLessThanOrEqual(1000);
        const statuses = Object.fromEntries(terms.map((t) => [t, 'known' as const]));
        return Promise.resolve({ success: true, data: { statuses } });
      });

      const terms = Array.from({ length: 1100 }, (_, i) => `term${i}`);
      const result = await getWordStatuses('en', terms);

      expect(sendMessage).toHaveBeenCalledTimes(3);
      expect(result.size).toBe(1100);
      expect(result.get('term1099')).toBe('known');
    });

    it('returns an empty map when the background reports an error', async () => {
      sendMessage.mockResolvedValue({ success: false, error: 'idb failed' });

      const result = await getWordStatuses('en', ['hello']);

      expect(result.size).toBe(0);
    });
  });

  describe('setWordStatus', () => {
    it('sends WORD_STATUS_SET', async () => {
      sendMessage.mockResolvedValue({ success: true });

      await setWordStatus('en', 'hello', 'known');

      expect(sendMessage).toHaveBeenCalledWith({
        type: MESSAGE_TYPES.WORD_STATUS_SET,
        payload: { tabId: -1, langCode: 'en', term: 'hello', status: 'known' },
      });
    });

    it('throws when the background reports an error', async () => {
      sendMessage.mockResolvedValue({ success: false, error: 'quota exceeded' });

      await expect(setWordStatus('en', 'hello', 'known')).rejects.toThrow('quota exceeded');
    });

    it('normalizes region-variant lang codes before sending', async () => {
      sendMessage.mockResolvedValue({ success: true });

      await setWordStatus('zh-hans', '你好', 'known');

      expect(sendMessage).toHaveBeenCalledWith({
        type: MESSAGE_TYPES.WORD_STATUS_SET,
        payload: { tabId: -1, langCode: 'zh', term: '你好', status: 'known' },
      });
    });
  });

  describe('listWordStatuses', () => {
    it('sends WORD_STATUS_LIST and returns entries', async () => {
      sendMessage.mockResolvedValue({
        success: true,
        data: { entries: [{ term: 'call', status: 'known', updatedAt: 100 }] },
      });

      const result = await listWordStatuses('en');

      expect(sendMessage).toHaveBeenCalledWith({
        type: MESSAGE_TYPES.WORD_STATUS_LIST,
        payload: { tabId: -1, langCode: 'en' },
      });
      expect(result).toEqual([{ term: 'call', status: 'known', updatedAt: 100 }]);
    });

    it('returns empty list on failure', async () => {
      sendMessage.mockResolvedValue({ success: false });

      expect(await listWordStatuses('en')).toEqual([]);
    });
  });

  describe('cycleWordStatus', () => {
    it('sends WORD_STATUS_CYCLE and returns the new status', async () => {
      sendMessage.mockResolvedValue({ success: true, data: { status: 'tracking' } });

      const result = await cycleWordStatus('en', 'call');

      expect(sendMessage).toHaveBeenCalledWith({
        type: MESSAGE_TYPES.WORD_STATUS_CYCLE,
        payload: { tabId: -1, langCode: 'en', term: 'call' },
      });
      expect(result).toBe('tracking');
    });

    it('throws on failure', async () => {
      sendMessage.mockResolvedValue({ success: false, error: 'quota exceeded' });

      await expect(cycleWordStatus('en', 'call')).rejects.toThrow('quota exceeded');
    });
  });

  describe('deleteWordStatus', () => {
    it('sends WORD_STATUS_DELETE', async () => {
      sendMessage.mockResolvedValue({ success: true });

      await deleteWordStatus('en', 'call');

      expect(sendMessage).toHaveBeenCalledWith({
        type: MESSAGE_TYPES.WORD_STATUS_DELETE,
        payload: { tabId: -1, langCode: 'en', term: 'call' },
      });
    });

    it('throws on failure', async () => {
      sendMessage.mockResolvedValue({ success: false, error: 'idb failed' });

      await expect(deleteWordStatus('en', 'call')).rejects.toThrow('idb failed');
    });
  });
});
