import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import type { FrequencyEntry } from '@/entities/dictionary';

const sendMessage = jest.fn() as jest.MockedFunction<(message: unknown) => Promise<unknown>>;

jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  sendMessage: (message: unknown) => sendMessage(message),
}));

import { getFrequencyEntries } from './frequencyClient';
import { MESSAGE_TYPES } from '@/shared/config/messages';

beforeEach(() => {
  sendMessage.mockReset();
});

describe('frequencyClient', () => {
  it('returns an empty map for empty terms', async () => {
    const result = await getFrequencyEntries('en', []);
    expect(result.size).toBe(0);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('sends FREQUENCY_GET and converts the response to a Map', async () => {
    const helloEntry: FrequencyEntry = { id: 1, resourceId: 10, term: 'hello', reading: '', frequency: 100 };
    sendMessage.mockResolvedValue({
      success: true,
      data: { entries: { hello: [helloEntry], world: [] } },
    });

    const result = await getFrequencyEntries('en', ['hello', 'world']);

    expect(sendMessage).toHaveBeenCalledWith({
      type: MESSAGE_TYPES.FREQUENCY_GET,
      payload: { tabId: -1, langCode: 'en', terms: ['hello', 'world'] },
    });
    expect(result.get('hello')).toEqual([helloEntry]);
    expect(result.get('world')).toEqual([]);
  });

  it('returns an empty map when the background reports an error', async () => {
    sendMessage.mockResolvedValue({ success: false, error: 'idb failed' });

    const result = await getFrequencyEntries('en', ['hello']);

    expect(result.size).toBe(0);
  });
});
