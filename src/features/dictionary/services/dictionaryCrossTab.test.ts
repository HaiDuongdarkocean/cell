import { startDictionaryCrossTabRelay } from './dictionaryCrossTab';
import { MESSAGE_TYPES } from '@/shared/config/messages';

jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  onMessage: jest.fn(),
  removeOnMessageListener: jest.fn(),
}));

jest.mock('./dictionaryEvents', () => ({
  emitDictionaryChanged: jest.fn(),
}));

import { onMessage, removeOnMessageListener } from '@/shared/lib/chrome-apis/runtime';
import { emitDictionaryChanged } from './dictionaryEvents';

describe('startDictionaryCrossTabRelay', () => {
  let registeredListener: (message: unknown) => boolean;

  beforeEach(() => {
    jest.clearAllMocks();
    (onMessage as jest.Mock).mockImplementation((listener) => {
      registeredListener = listener;
    });
  });

  it('emits a local event when DICTIONARY_CHANGED arrives', () => {
    startDictionaryCrossTabRelay();
    registeredListener({
      type: MESSAGE_TYPES.DICTIONARY_CHANGED,
      payload: { reason: 'resource-enabled', langCode: 'zh' },
    });

    expect(emitDictionaryChanged).toHaveBeenCalledWith({
      langCode: 'zh',
      reason: 'resource-enabled',
    });
  });

  it('defaults langCode to empty (all languages) when absent', () => {
    startDictionaryCrossTabRelay();
    registeredListener({
      type: MESSAGE_TYPES.DICTIONARY_CHANGED,
      payload: { reason: 'resource-mutation' },
    });

    expect(emitDictionaryChanged).toHaveBeenCalledWith({
      langCode: '',
      reason: 'resource-mutation',
    });
  });

  it('ignores other message types', () => {
    startDictionaryCrossTabRelay();
    registeredListener({
      type: MESSAGE_TYPES.WORD_STATUS_CHANGED,
      payload: { tabId: 1, langCode: 'en', term: 'walk', status: 'known' },
    });

    expect(emitDictionaryChanged).not.toHaveBeenCalled();
  });

  it('emits per-profile events when SYNC_DATA_APPLIED carries dictResource', () => {
    startDictionaryCrossTabRelay();
    registeredListener({
      type: MESSAGE_TYPES.SYNC_DATA_APPLIED,
      payload: {
        dataClasses: ['dictResource', 'settings'],
        scopes: ['profile:zh', 'profile:en', 'global'],
      },
    });

    expect(emitDictionaryChanged).toHaveBeenCalledTimes(2);
    expect(emitDictionaryChanged).toHaveBeenCalledWith({ langCode: 'zh', reason: 'sync' });
    expect(emitDictionaryChanged).toHaveBeenCalledWith({ langCode: 'en', reason: 'sync' });
  });

  it('emits an all-languages event for global-scope dictResource sync', () => {
    startDictionaryCrossTabRelay();
    registeredListener({
      type: MESSAGE_TYPES.SYNC_DATA_APPLIED,
      payload: { dataClasses: ['dictResource'], scopes: ['global'] },
    });

    expect(emitDictionaryChanged).toHaveBeenCalledWith({ langCode: '', reason: 'sync' });
  });

  it('ignores SYNC_DATA_APPLIED without dictResource', () => {
    startDictionaryCrossTabRelay();
    registeredListener({
      type: MESSAGE_TYPES.SYNC_DATA_APPLIED,
      payload: { dataClasses: ['settings'], scopes: ['profile:en'] },
    });

    expect(emitDictionaryChanged).not.toHaveBeenCalled();
  });

  it('returns a cleanup function', () => {
    const cleanup = startDictionaryCrossTabRelay();
    cleanup();

    expect(removeOnMessageListener).toHaveBeenCalledWith(registeredListener);
  });
});
