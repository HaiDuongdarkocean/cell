import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const sendMessage = jest.fn() as jest.MockedFunction<(message: unknown) => Promise<unknown>>;

jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  sendMessage: (message: unknown) => sendMessage(message),
}));

import { getWordStatuses, setWordStatus } from './wordStatusClient';
import { MESSAGE_TYPES } from '@/shared/config/messages';

beforeEach(() => {
  sendMessage.mockReset();
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
  });
});
