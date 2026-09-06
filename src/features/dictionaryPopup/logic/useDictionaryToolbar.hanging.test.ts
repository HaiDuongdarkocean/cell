import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { LookupResult } from '../types';
import { useDictionaryToolbar } from './useDictionaryToolbar';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { loadSettings } from '@/shared/lib/storage/settingsStore';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { DEFAULT_PRONUNCIATION_SETTINGS } from '@/shared/config/config';

jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  sendMessage: jest.fn(),
}));

jest.mock('@/shared/lib/storage/settingsStore', () => ({
  loadSettings: jest.fn(),
}));

const mockSendMessage = jest.mocked(sendMessage);
const mockLoadSettings = jest.mocked(loadSettings);

function makeResult(term: string, overrides: Partial<LookupResult> = {}): LookupResult {
  return {
    term,
    langCode: 'en',
    reading: '',
    readingKind: 'none',
    frequency: null,
    status: 'unknown',
    partsOfSpeech: [],
    definitions: [],
    rawDefinitions: [],
    detectedPhrase: null,
    matchSource: 'dictionary',
    ...overrides,
  };
}

function setupMocks(): void {
  jest.clearAllMocks();
  mockSendMessage.mockReset();
  mockLoadSettings.mockReset();
  mockLoadSettings.mockResolvedValue({ pronunciation: DEFAULT_PRONUNCIATION_SETTINGS } as never);
  mockSendMessage.mockImplementation(async <T = unknown>(msg: unknown): Promise<T> => {
    const message = msg as { type: string };
    if (message.type === MESSAGE_TYPES.TTS_FETCH_AUDIO) {
      // Keep the sentence TTS path fast so the test isolates the orchestrator timeout.
      return { success: true, data: {} } as T;
    }
    // Hang all word-audio provider messages to simulate a stuck background worker.
    if (
      message.type === MESSAGE_TYPES.FETCH_LOCAL_AUDIO ||
      message.type === MESSAGE_TYPES.FETCH_COMMUNITY_AUDIO ||
      message.type === MESSAGE_TYPES.PRONUNCIATION_ESPEAK_TTS
    ) {
      // This Promise never resolves, so the internal 8s provider timeout must cut it.
      return new Promise<T>(() => {});
    }
    return { success: true } as T;
  });
}

describe('useDictionaryToolbar — hanging orchestrator', () => {
  beforeEach(() => {
    setupMocks();
  });

  it('fires the 15s outer timeout and does not keep re-fetching', async () => {
    const { result } = renderHook(() =>
      useDictionaryToolbar({
        result: makeResult('hello'),
        contextSentence: '',
        sourceLang: 'en',
        targetLang: 'vi',
      }),
    );

    act(() => {
      result.current.setActiveTab('audio');
    });

    // The outer 15s timeout on orchestrator.resolve should fire and produce an error.
    await waitFor(
      () => expect(result.current.audioError).toBe("Couldn't load audio. Try again."),
      { timeout: 20_000 },
    );

    // After the timeout the hook should settle, not start a new fetch.
    await new Promise<void>((resolve) => setTimeout(resolve, 2_000));
    expect(result.current.audioLoading).toBe(false);
  }, 45_000);
});
