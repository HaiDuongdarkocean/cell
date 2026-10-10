import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { MessageRequest, MessageResponse } from '@/entities/message';
import type { MessageTap } from '@/entities/message';
import { normalizeStoredStatus, type StoredWordStatus } from '@/features/dictionary';
import {
  addSessionEvent,
  type SessionEvent,
  type SessionEventSurface,
} from '@/features/local-player';

type LookupPayload = {
  origin?: string;
  tabId?: number;
  request?: { term?: string; langCode?: string };
};

type StatusPayload = {
  term?: string;
  pos?: string;
  status?: string;
  langCode?: string;
  tabId?: number;
};

function classifySurface(
  sender: chrome.runtime.MessageSender,
): SessionEventSurface {
  if (sender.url?.includes('local-player')) return 'local-player';
  if (sender.tab) return 'stream';
  return 'other';
}

function resolveTabId(
  payloadTabId: unknown,
  sender: chrome.runtime.MessageSender,
): number {
  if (typeof payloadTabId === 'number' && payloadTabId >= 0) return payloadTabId;
  return sender.tab?.id ?? -1;
}

/** Pure decision: does this dispatched message yield a session event, and
 *  which one? Exported for tests. */
export function toSessionEvent(
  request: MessageRequest,
  sender: chrome.runtime.MessageSender,
  response: MessageResponse,
): Omit<SessionEvent, 'id' | 'at'> | null {
  if (!response.success) return null;
  const payload = request.payload as LookupPayload & StatusPayload | undefined;
  if (!payload || typeof payload !== 'object') return null;

  if (request.type === MESSAGE_TYPES.LOOKUP_REQUEST) {
    if (payload.origin !== 'immersion') return null;
    const term = payload.request?.term;
    if (!term) return null;
    return {
      tabId: resolveTabId(payload.tabId, sender),
      surface: classifySurface(sender),
      kind: 'lookup',
      term,
      ...(payload.request?.langCode ? { langCode: payload.request.langCode } : {}),
    };
  }

  if (request.type === MESSAGE_TYPES.WORD_STATUS_SET) {
    if (!payload.term || !payload.status) return null;
    return {
      tabId: resolveTabId(payload.tabId, sender),
      surface: classifySurface(sender),
      kind: 'status',
      term: payload.term,
      status: normalizeStoredStatus(payload.status as StoredWordStatus),
      ...(payload.pos ? { pos: payload.pos } : {}),
      ...(payload.langCode ? { langCode: payload.langCode } : {}),
    };
  }

  if (request.type === MESSAGE_TYPES.WORD_STATUS_CYCLE) {
    const data = response.data as { status?: string } | undefined;
    if (!payload.term || !data?.status) return null;
    return {
      tabId: resolveTabId(payload.tabId, sender),
      surface: classifySurface(sender),
      kind: 'status',
      term: payload.term,
      status: data.status,
      ...(payload.pos ? { pos: payload.pos } : {}),
      ...(payload.langCode ? { langCode: payload.langCode } : {}),
    };
  }

  return null;
}

/** Post-dispatch observer: persists an event for immersive lookups and
 *  user status writes. Fire-and-forget — append failure drops the event. */
export function createSessionEventsTap(): MessageTap {
  return (request, sender, response) => {
    const partial = toSessionEvent(request, sender, response);
    if (!partial) return;
    const event: SessionEvent = {
      id: `${Date.now()}-${crypto.randomUUID()}`,
      at: Date.now(),
      ...partial,
    };
    void addSessionEvent(event).catch(() => {
      void addSessionEvent(event).catch(() => undefined);
    });
  };
}
