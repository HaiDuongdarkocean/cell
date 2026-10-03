import { toSessionEvent } from '@/features/sessionRecap/services/sessionEventsTap';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { MessageRequest } from '@/entities/message';

const req = (type: string, payload: unknown): MessageRequest =>
  ({ type, payload }) as unknown as MessageRequest;

const sender = (over: Partial<chrome.runtime.MessageSender> = {}): chrome.runtime.MessageSender =>
  ({ tab: { id: 7 } as chrome.tabs.Tab, ...over }) as chrome.runtime.MessageSender;

describe('toSessionEvent', () => {
  it('captures immersion lookups on success', () => {
    const e = toSessionEvent(
      req(MESSAGE_TYPES.LOOKUP_REQUEST, {
        origin: 'immersion',
        request: { term: '猫', langCode: 'ja' },
      }),
      sender(),
      { success: true },
    );
    expect(e).toMatchObject({ kind: 'lookup', term: '猫', langCode: 'ja', tabId: 7, surface: 'stream' });
  });

  it('rejects lookups without immersion origin', () => {
    const e = toSessionEvent(
      req(MESSAGE_TYPES.LOOKUP_REQUEST, { request: { term: '猫' } }),
      sender(),
      { success: true },
    );
    expect(e).toBeNull();
  });

  it('rejects failed responses', () => {
    const e = toSessionEvent(
      req(MESSAGE_TYPES.LOOKUP_REQUEST, { origin: 'immersion', request: { term: '猫' } }),
      sender(),
      { success: false, error: 'nope' },
    );
    expect(e).toBeNull();
  });

  it('captures WORD_STATUS_SET with status', () => {
    const e = toSessionEvent(
      req(MESSAGE_TYPES.WORD_STATUS_SET, { term: '猫', pos: 'n', status: 'known', langCode: 'ja' }),
      sender(),
      { success: true },
    );
    expect(e).toMatchObject({ kind: 'status', term: '猫', status: 'known', pos: 'n' });
  });

  it('captures WORD_STATUS_CYCLE using response status', () => {
    const e = toSessionEvent(
      req(MESSAGE_TYPES.WORD_STATUS_CYCLE, { term: '犬' }),
      sender(),
      { success: true, data: { status: 'learning' } },
    );
    expect(e).toMatchObject({ kind: 'status', term: '犬', status: 'learning' });
  });

  it('classifies local-player senders by url', () => {
    const e = toSessionEvent(
      req(MESSAGE_TYPES.WORD_STATUS_SET, { term: '水', status: 'known' }),
      sender({ url: 'chrome-extension://abc/local-player.html', tab: { id: 3 } as chrome.tabs.Tab }),
      { success: true },
    );
    expect(e?.surface).toBe('local-player');
  });

  it('classifies sender without tab or local-player url as other', () => {
    const e = toSessionEvent(
      req(MESSAGE_TYPES.WORD_STATUS_SET, { term: '水', status: 'known' }),
      { id: 'x' } as chrome.runtime.MessageSender,
      { success: true },
    );
    expect(e?.surface).toBe('other');
    expect(e?.tabId).toBe(-1);
  });
});
