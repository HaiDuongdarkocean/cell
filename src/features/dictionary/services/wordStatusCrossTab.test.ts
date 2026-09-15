import { startWordStatusCrossTabRelay } from './wordStatusCrossTab';
import { MESSAGE_TYPES } from '@/shared/config/messages';

jest.mock('@/shared/lib/chrome-apis/runtime', () => ({
  onMessage: jest.fn(),
  removeOnMessageListener: jest.fn(),
}));

jest.mock('./wordStatusEvents', () => ({
  emitWordStatusChanged: jest.fn(),
}));

import { onMessage, removeOnMessageListener } from '@/shared/lib/chrome-apis/runtime';
import { emitWordStatusChanged } from './wordStatusEvents';

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

  it('returns a cleanup function', () => {
    const cleanup = startWordStatusCrossTabRelay();
    cleanup();

    expect(removeOnMessageListener).toHaveBeenCalledWith(registeredListener);
  });
});
