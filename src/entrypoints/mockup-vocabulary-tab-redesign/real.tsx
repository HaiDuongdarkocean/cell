import React, { useEffect } from 'react';
import { VocabularyTab } from '@/features/vocabulary/ui/VocabularyTab';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { MockEntry, MockStatus, MockTrashEntry } from './mockData';
import { MOCK_ENTRIES, MOCK_TRASH } from './mockData';
import styles from './mockup.module.css';

type FakeRequest = { type: string; payload?: Record<string, unknown> };
type FakeResponse = { success: boolean; data?: unknown; error?: string };
type FakeBackend = (request: FakeRequest) => Promise<FakeResponse>;

const createFakeBackend = (): FakeBackend => {
  const statuses = new Map<string, MockEntry>(MOCK_ENTRIES.map((e) => [e.term, e]));
  const trash = new Map<string, MockTrashEntry>(MOCK_TRASH.map((e) => [e.term, e]));
  return async (request) => {
    const p = request.payload ?? {};
    const term = typeof p.term === 'string' ? p.term : '';
    switch (request.type) {
      case MESSAGE_TYPES.WORD_STATUS_LIST:
        return { success: true, data: { entries: [...statuses.values()] } };
      case MESSAGE_TYPES.WORD_STATUS_TRASH_LIST:
        return { success: true, data: { entries: [...trash.values()] } };
      case MESSAGE_TYPES.WORD_STATUS_SET: {
        const status = p.status as MockStatus | 'unknown';
        if (status === 'unknown') {
          statuses.delete(term);
          return { success: true, data: {} };
        }
        trash.delete(term);
        statuses.set(term, { term, status, updatedAt: Date.now() });
        return { success: true, data: {} };
      }
      case MESSAGE_TYPES.WORD_STATUS_CYCLE: {
        const live = statuses.get(term);
        if (!live) return { success: true, data: { status: 'unknown' } };
        const next: Record<MockStatus, MockStatus | 'unknown'> = {
          tracking: 'known',
          known: 'ignore',
          ignore: 'unknown',
        };
        const status = next[live.status];
        if (status === 'unknown') statuses.delete(term);
        else statuses.set(term, { term, status, updatedAt: Date.now() });
        return { success: true, data: { status } };
      }
      case MESSAGE_TYPES.WORD_STATUS_DELETE:
        statuses.delete(term);
        trash.delete(term);
        return { success: true, data: {} };
      case MESSAGE_TYPES.WORD_STATUS_TRASH: {
        const live = statuses.get(term);
        if (!live) return { success: true, data: {} };
        trash.set(term, { term, previousStatus: live.status, trashedAt: Date.now() });
        statuses.delete(term);
        return { success: true, data: {} };
      }
      case MESSAGE_TYPES.WORD_STATUS_RESTORE: {
        const dead = trash.get(term);
        if (!dead) return { success: true, data: { status: 'tracking' } };
        statuses.set(term, { term, status: dead.previousStatus, updatedAt: Date.now() });
        trash.delete(term);
        return { success: true, data: { status: dead.previousStatus } };
      }
      case MESSAGE_TYPES.WORD_STATUS_TRASH_DELETE:
        trash.delete(term);
        return { success: true, data: {} };
      default:
        return { success: false, error: `unhandled ${request.type}` };
    }
  };
};

export function RealPanel(): React.JSX.Element {
  useEffect(() => {
    const backend = createFakeBackend();
    const g = globalThis as { __cellSendMessage?: FakeBackend };
    g.__cellSendMessage = backend;
    return () => {
      if (g.__cellSendMessage === backend) delete g.__cellSendMessage;
    };
  }, []);

  return (
    <div className={styles.panel}>
      <VocabularyTab langCode="en" onLookup={() => undefined} />
    </div>
  );
}
