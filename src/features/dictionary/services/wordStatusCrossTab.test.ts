import { startWordStatusCrossTabRelay } from './wordStatusCrossTab';
import { MESSAGE_TYPES } from '@/shared/config/messages';

jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  onMessage: jest.fn(),
  removeOnMessageListener: jest.fn(),
}));

jest.mock('./wordStatusEvents', () => ({
  emitWordStatusChanged: jest.fn(),
  emitWordStatusRemoved: jest.fn(),
  emitWordStatusesReload: jest.fn(),
}));

import { onMessage, removeOnMessageListener } from '@/shared/lib/chrome-apis/runtime';
import {
  emitWordStatusChanged,
  emitWordStatusRemoved,
  emitWordStatusesReload,
} from './wordStatusEvents';

describe('startWordStatusCrossTabRelay', () => {
  let registeredListener: (message: unknown) => boolean;

  beforeEach(() => {
    jest.clearAllMocks();
    (onMessage as jest.Mock).mockImplementation((listener) => {
      registeredListener = listener;
    });
  });

  it('emits local event when WORD_STATUS_CHANGED arrives', () => {
    startWordStatusCrossTabRelay();
    registeredListener({
      type: MESSAGE_TYPES.WORD_STATUS_CHANGED,
      payload: { tabId: 2, langCode: 'en', term: 'call', status: 'known' },
    });

    expect(emitWordStatusChanged).toHaveBeenCalledWith({
      langCode: 'en',
      term: 'call',
      status: 'known',
    });
  });

  it('ignores other message types', () => {
    startWordStatusCrossTabRelay();
    registeredListener({
      type: MESSAGE_TYPES.WORD_STATUS_SET,
      payload: { tabId: 2, langCode: 'en', term: 'call', status: 'known' },
    });

    expect(emitWordStatusChanged).not.toHaveBeenCalled();
  });

  it('ignores invalid payloads', () => {
    startWordStatusCrossTabRelay();
    registeredListener({
      type: MESSAGE_TYPES.WORD_STATUS_CHANGED,
      payload: { tabId: 'two', langCode: 'en', term: 'call', status: 'known' },
    });

    expect(emitWordStatusChanged).not.toHaveBeenCalled();
  });

  it('emits local removed event when WORD_STATUS_DELETED arrives', () => {
    startWordStatusCrossTabRelay();
    registeredListener({
      type: MESSAGE_TYPES.WORD_STATUS_DELETED,
      payload: { tabId: 2, langCode: 'en', term: 'call' },
    });

    expect(emitWordStatusRemoved).toHaveBeenCalledWith({
      langCode: 'en',
      term: 'call',
    });
    expect(emitWordStatusChanged).not.toHaveBeenCalled();
  });

  it('emits per-language reloads when SYNC_DATA_APPLIED carries wordStatus', () => {
    startWordStatusCrossTabRelay();
    registeredListener({
      type: MESSAGE_TYPES.SYNC_DATA_APPLIED,
      payload: {
        dataClasses: ['wordStatus', 'settings'],
        scopes: ['profile:en', 'global'],
      },
    });

    expect(emitWordStatusesReload).toHaveBeenCalledTimes(1);
    expect(emitWordStatusesReload).toHaveBeenCalledWith('en');
  });

  it('ignores SYNC_DATA_APPLIED without wordStatus data', () => {
    startWordStatusCrossTabRelay();
    registeredListener({
      type: MESSAGE_TYPES.SYNC_DATA_APPLIED,
      payload: { dataClasses: ['settings'], scopes: ['profile:en'] },
    });

    expect(emitWordStatusesReload).not.toHaveBeenCalled();
  });

  it('returns a cleanup function', () => {
    const cleanup = startWordStatusCrossTabRelay();
    cleanup();

    expect(removeOnMessageListener).toHaveBeenCalledWith(registeredListener);
  });
});
