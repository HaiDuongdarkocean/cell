import { describe, expect, it, jest } from '@jest/globals';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { EspeakAudioProvider } from './pronunciationAudioOrchestrator';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';

jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  sendMessage: jest.fn(),
}));

const mockedSendMessage = jest.mocked(sendMessage);

describe('EspeakAudioProvider', () => {
  it('returns an AudioItem from offscreen WAV bytes', async () => {
    const audioBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
    mockedSendMessage.mockResolvedValue({
      success: true,
      data: { audioBytes },
    });

    const provider = new EspeakAudioProvider();
    const items = await provider.resolve('hello', 'en');

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'espeak-word-hello-en',
      kind: 'word',
      source: 'espeak',
      state: 'idle',
      audioBytes,
      defaultSelected: false,
    });
    expect(mockedSendMessage).toHaveBeenCalledWith({
      type: MESSAGE_TYPES.PRONUNCIATION_ESPEAK_TTS,
      payload: { text: 'hello', langCode: 'en' },
    });
  });

  it('returns empty array when offscreen returns failure', async () => {
    mockedSendMessage.mockResolvedValue({
      success: false,
      error: 'eSpeak offscreen failed',
    });

    const provider = new EspeakAudioProvider();
    const items = await provider.resolve('hello', 'en');

    expect(items).toEqual([]);
  });

  it('returns empty array when offscreen returns no audioBytes', async () => {
    mockedSendMessage.mockResolvedValue({
      success: true,
      data: {},
    });

    const provider = new EspeakAudioProvider();
    const items = await provider.resolve('hello', 'en');

    expect(items).toEqual([]);
  });
});
