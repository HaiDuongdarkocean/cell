import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const sendMessage = jest.fn() as jest.MockedFunction<(message: unknown) => Promise<unknown>>;

jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  sendMessage: (message: unknown) => sendMessage(message),
}));

import { getReadings } from './readingsClient';
import { MESSAGE_TYPES } from '@/shared/config/messages';

beforeEach(() => {
  sendMessage.mockReset();
});

describe('readingsClient', () => {
  it('returns an empty map for empty terms', async () => {
    const result = await getReadings('zh', []);
    expect(result.size).toBe(0);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('sends READINGS_GET and converts the response to a Map', async () => {
    sendMessage.mockResolvedValue({
      success: true,
      data: { readings: { '你好': 'nǐ hǎo' } },
    });

    const result = await getReadings('zh', ['你好', '再见']);

    expect(sendMessage).toHaveBeenCalledWith({
      type: MESSAGE_TYPES.READINGS_GET,
      payload: { tabId: -1, langCode: 'zh', terms: ['你好', '再见'] },
    });
    expect(result.get('你好')).toBe('nǐ hǎo');
    expect(result.has('再见')).toBe(false);
  });

  it('returns an empty map when the background reports an error', async () => {
    sendMessage.mockResolvedValue({ success: false, error: 'idb failed' });

    const result = await getReadings('zh', ['你好']);

    expect(result.size).toBe(0);
  });

  it('chunks terms into 500-term requests', async () => {
    sendMessage.mockResolvedValue({ success: true, data: { readings: {} } });
    const terms = Array.from({ length: 501 }, (_, i) => `t${i}`);

    await getReadings('zh', terms);

    expect(sendMessage).toHaveBeenCalledTimes(2);
  });
});
