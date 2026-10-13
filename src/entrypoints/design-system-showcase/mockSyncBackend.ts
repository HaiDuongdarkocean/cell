/**
 * Mock sync backend for the design-system showcase.
 *
 * SyncPanel and AnkiStatusSyncPanel talk to the background worker via
 * sendMessage, which doesn't exist under Vite. This wraps the installed
 * __TihokaSendMessage (mockDictionary's) so `?sync=` / `?anki=` URL params
 * render every panel state: empty → connect → connected → reauth/offline…
 *
 *   ?sync=empty|connected|full|reauth|offline|syncing|storage-full|error
 *   ?anki=absent|connected|failing|never
 */

import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { MessageResponse } from '@/entities/message';
import { EMPTY_ANKI_SYNC_STATE } from '@/entities/ankiStatusSync';
import type { AnkiStatusSyncView } from '@/entities/ankiStatusSync';
import type {
  BindingStatusEntry,
  ConnectionStatusEntry,
  SyncStatusView,
} from '@/features/sync/app/syncService';
import type { SyncRunRecord } from '@/features/sync/app/runHistory';
import type { ConnectionId } from '@/features/sync/domain/types';

type SyncScene =
  | 'empty'
  | 'connected'
  | 'full'
  | 'reauth'
  | 'offline'
  | 'syncing'
  | 'storage-full'
  | 'error';

type AnkiScene = 'absent' | 'connected' | 'failing' | 'never';

const params = new URLSearchParams(window.location.search);
let scene: SyncScene = (params.get('sync') as SyncScene | null) ?? 'empty';
const ankiScene: AnkiScene = (params.get('anki') as AnkiScene | null) ?? 'absent';

const MIN = 60_000;

function connection(
  accountKey: string,
  displayName: string,
  isSystem: boolean,
  state: ConnectionStatusEntry['state'] = 'connected',
): ConnectionStatusEntry {
  return {
    connectionId: `google-drive:${accountKey}`,
    providerId: 'google-drive',
    displayName,
    isSystem,
    disconnectPending: state === 'disconnect-pending',
    state,
    hasToken: state !== 'needs-reauth',
  };
}

function binding(
  target: string,
  destination: ConnectionId | 'local',
): BindingStatusEntry {
  return {
    target,
    scope: `profile:${target}`,
    destination,
    frozen: false,
    waiting: false,
    waitingFor: null,
    vacatedFrom: null,
  };
}

const PERSONAL = 'google-drive:me@gmail.com' as ConnectionId;
const WORK = 'google-drive:work@corp.example' as ConnectionId;

const DAY = 24 * 60 * MIN;

function runHistory(now: number): SyncRunRecord[] {
  const mk = (
    daysAgo: number,
    kind: SyncRunRecord['kind'],
    ackedKeys: number,
    pushed: SyncRunRecord['pushed'] = [],
    pulled: SyncRunRecord['pulled'] = [],
    extra: Partial<SyncRunRecord> = {},
  ): SyncRunRecord => ({
    id: `run-${daysAgo}-${kind}`,
    at: now - daysAgo * DAY - 3 * MIN,
    kind,
    ok: true,
    pushed,
    pulled,
    appliedDataClasses: [],
    ackedKeys,
    failed: [],
    errors: [],
    ...extra,
  });
  return [
    mk(0.1, 'full', 41, ['global', 'profile:en'], ['profile:en'], {
      appliedDataClasses: ['wordStatus', 'settings'],
    }),
    mk(1, 'push', 18, ['profile:en']),
    mk(1.2, 'push', 7, ['profile:ja']),
    mk(2, 'check', 0, [], ['profile:en'], {
      appliedDataClasses: ['wordStatus'],
    }),
    mk(3, 'full', 66, ['global', 'profile:en', 'profile:ja'], ['profile:ko'], {
      appliedDataClasses: ['wordStatus', 'srsCard', 'settings'],
    }),
    mk(4, 'push', 12, ['profile:en']),
    mk(5, 'check', 0, [], [], {
      ok: false,
      failed: [{ connectionId: 'google-drive:me@gmail.com', state: 'offline' }],
      errors: [],
    }),
    mk(6, 'full', 88, ['global', 'profile:en'], []),
  ];
}

function buildView(current: SyncScene): SyncStatusView {
  const updatedAt = Date.now();
  const history = current === 'empty' ? [] : runHistory(updatedAt);
  switch (current) {
    case 'connected':
      return {
        engine: { state: 'idle', updatedAt },
        directory: {
          connections: [connection('me@gmail.com', 'me@gmail.com', true)],
          bindings: [binding('en', PERSONAL), binding('ja', PERSONAL), binding('ko', PERSONAL)],
          systemConnection: PERSONAL,
          lastAppliedAt: updatedAt - 13 * MIN,
        },
        history,
      };
    case 'full':
      return {
        engine: { state: 'idle', updatedAt },
        directory: {
          connections: [
            connection('me@gmail.com', 'me@gmail.com', true),
            connection('work@corp.example', 'work@corp.example', false),
          ],
          bindings: [binding('en', WORK), binding('ja', PERSONAL), binding('ko', 'local')],
          systemConnection: PERSONAL,
          lastAppliedAt: updatedAt - 2 * MIN,
        },
        history,
      };
    case 'reauth':
      return {
        engine: { state: 'needs-reauth', updatedAt },
        directory: {
          connections: [connection('me@gmail.com', 'me@gmail.com', true, 'needs-reauth')],
          bindings: [binding('en', PERSONAL), binding('ja', PERSONAL), binding('ko', PERSONAL)],
          systemConnection: PERSONAL,
          lastAppliedAt: updatedAt - 60 * MIN,
        },
        history,
      };
    case 'offline':
      return {
        engine: { state: 'offline', updatedAt },
        directory: {
          connections: [connection('me@gmail.com', 'me@gmail.com', true, 'offline')],
          bindings: [binding('en', PERSONAL), binding('ja', PERSONAL), binding('ko', PERSONAL)],
          systemConnection: PERSONAL,
          lastAppliedAt: updatedAt - 5 * 60 * MIN,
        },
        history,
      };
    case 'syncing':
      return {
        engine: {
          state: 'running',
          updatedAt,
          progress: {
            phase: 'push',
            pending: 41,
            done: 17,
            scopesDone: 1,
            scopesTotal: 3,
            scope: 'profile:en',
            items: [
              { scope: 'global', dataClass: 'settings', total: 4, done: 4 },
              { scope: 'global', dataClass: 'dictResource', total: 3, done: 3 },
              { scope: 'profile:en', dataClass: 'wordStatus', total: 18, done: 9 },
              { scope: 'profile:en', dataClass: 'srsCard', total: 6, done: 0 },
              { scope: 'profile:ja', dataClass: 'wordStatus', total: 10, done: 0 },
            ],
          },
        },
        directory: {
          connections: [connection('me@gmail.com', 'me@gmail.com', true)],
          bindings: [binding('en', PERSONAL), binding('ja', PERSONAL), binding('ko', PERSONAL)],
          systemConnection: PERSONAL,
          lastAppliedAt: updatedAt - MIN,
        },
        history,
      };
    case 'storage-full':
      return {
        engine: { state: 'storage-full', updatedAt },
        directory: {
          connections: [connection('me@gmail.com', 'me@gmail.com', true, 'storage-full')],
          bindings: [binding('en', PERSONAL), binding('ja', PERSONAL), binding('ko', PERSONAL)],
          systemConnection: PERSONAL,
          lastAppliedAt: updatedAt - 24 * 60 * MIN,
        },
        history,
      };
    case 'empty':
    default:
      return {
        engine: { state: 'idle', updatedAt },
        directory: { connections: [], bindings: [], systemConnection: null, lastAppliedAt: null },
        history: [],
      };
  }
}

function buildAnkiState(current: AnkiScene): AnkiStatusSyncView {
  const now = Date.now();
  const view = (state: Partial<AnkiStatusSyncView>): AnkiStatusSyncView => ({
    ...EMPTY_ANKI_SYNC_STATE,
    running: false,
    linkedCards: 1240,
    pendingWriteBacks: 0,
    writeBackQueue: [],
    writeBackLog: [],
    ...state,
  });
  const runs = (
    entries: Array<{ at: number; changed: number; errors: number }>,
  ): AnkiStatusSyncView['history'] =>
    entries.map((e, i) => ({
      at: e.at,
      trigger: 'alarm',
      cardsSeen: 1840,
      changed: e.changed,
      errors: e.errors,
      writeBacksFlushed: i % 2,
      addonOnline: true,
      langCode: 'en',
    }));
  switch (current) {
    case 'connected':
      return view({
        lastSyncAt: now - 2 * MIN,
        lastTrigger: 'event',
        cardsSeen: 1840,
        changed: 12,
        addonOnline: true,
        history: runs([
          { at: now - 2 * MIN, changed: 12, errors: 0 },
          { at: now - 7 * MIN, changed: 4, errors: 0 },
          { at: now - 32 * MIN, changed: 21, errors: 0 },
          { at: now - DAY, changed: 9, errors: 0 },
          { at: now - 2 * DAY, changed: 17, errors: 1 },
        ]),
        pendingWriteBacks: 2,
        writeBackQueue: [
          { cardId: 1001, term: 'ubiquitous', langCode: 'en', enqueuedAt: now - 4 * MIN, attempts: 0 },
          { cardId: 1002, term: 'ephemeral', langCode: 'en', enqueuedAt: now - 9 * MIN, attempts: 1 },
        ],
        writeBackLog: [
          { cardId: 997, term: 'serendipity', ok: true, reason: 'scheduled', at: now - 3 * MIN },
          { cardId: 992, term: 'lucid', ok: true, reason: 'already-mature', at: now - 8 * MIN },
        ],
      });
    case 'failing':
      return view({
        lastSyncAt: now - 9 * MIN,
        lastTrigger: 'alarm',
        cardsSeen: 1840,
        errors: 3,
        consecutiveFailures: 3,
        addonOnline: false,
        history: runs([
          { at: now - 9 * MIN, changed: 0, errors: 3 },
          { at: now - 14 * MIN, changed: 2, errors: 1 },
          { at: now - 39 * MIN, changed: 8, errors: 0 },
        ]),
        writeBackLog: [
          { cardId: 981, term: 'resilient', ok: false, reason: 'AnkiConnect timeout', at: now - 9 * MIN },
        ],
      });
    case 'never':
      return { ...view({}), linkedCards: 0 };
    case 'absent':
    default:
      return view({
        lastSyncAt: now - 13 * 60 * MIN,
        lastTrigger: 'alarm',
        cardsSeen: 1840,
        changed: 5,
        addonOnline: false,
        history: runs([{ at: now - 13 * 60 * MIN, changed: 5, errors: 0 }]),
      });
  }
}

function pushStatus(view: SyncStatusView): void {
  const g = globalThis as { __TihokaOnMessageListeners?: Set<(msg: unknown) => void> };
  g.__TihokaOnMessageListeners?.forEach((listener) => {
    try {
      listener({ type: MESSAGE_TYPES.SYNC_STATUS_CHANGED, payload: view });
    } catch {
      /* listeners are best-effort in showcase */
    }
  });
}

function ok<T>(data: T): MessageResponse<T> {
  return { success: true, data };
}

async function handleSyncMessage(message: unknown): Promise<MessageResponse<unknown> | undefined> {
  const type = (message as { type?: unknown } | undefined)?.type;
  switch (type) {
    case MESSAGE_TYPES.SYNC_GET_STATUS:
      if (scene === 'error') return { success: false, error: 'sync-data-invalid' };
      return ok(buildView(scene));
    case MESSAGE_TYPES.SYNC_CONNECT:
      if (params.has('connectwait')) {
        await new Promise((resolve) => setTimeout(resolve, 60_000));
      }
      scene = 'connected';
      pushStatus(buildView(scene));
      return ok({ connectionId: PERSONAL });
    case MESSAGE_TYPES.SYNC_DISCONNECT:
    case MESSAGE_TYPES.SYNC_DISCONNECT_LOCAL:
      scene = 'empty';
      pushStatus(buildView(scene));
      return ok({});
    case MESSAGE_TYPES.SYNC_NOW:
      return ok({});
    case MESSAGE_TYPES.SYNC_SET_SYSTEM_CONNECTION: {
      const connectionId = String((message as { payload?: { connectionId?: string } }).payload?.connectionId ?? PERSONAL) as ConnectionId;
      const view = buildView(scene);
      pushStatus({ ...view, directory: { ...view.directory, systemConnection: connectionId } });
      return ok(null);
    }
    case MESSAGE_TYPES.SYNC_SET_BINDING: {
      const payload = (message as { payload?: { scope?: string; destination?: string } }).payload;
      const view = buildView(scene);
      const scope = payload?.scope ?? '';
      const target = scope.replace(/^profile:/, '');
      const next = view.directory.bindings.filter((b) => b.scope !== scope);
      next.push(
        binding(target, (payload?.destination ?? 'local') as ConnectionId | 'local'),
      );
      pushStatus({ ...view, directory: { ...view.directory, bindings: next } });
      return ok(null);
    }
    case MESSAGE_TYPES.SYNC_CANCEL_REBIND:
    case MESSAGE_TYPES.SYNC_DELETE_OLD_COPY:
      return ok(undefined);
    case MESSAGE_TYPES.ANKI_STATUS_SYNC_STATE:
    case MESSAGE_TYPES.ANKI_STATUS_SYNC_RUN:
      return ok(buildAnkiState(ankiScene));
    default:
      return undefined;
  }
}

/** Install after installMockDictionarySendMessage so sync types intercept
 *  first and everything else delegates to the dictionary mock. */
export function installMockSyncBackend(): void {
  const g = globalThis as { __TihokaSendMessage?: (m: unknown) => Promise<unknown> };
  const inner = g.__TihokaSendMessage;
  g.__TihokaSendMessage = async (message: unknown) => {
    const handled = await handleSyncMessage(message);
    if (handled !== undefined) return handled;
    if (inner) return inner(message);
    return { success: false, error: 'Unknown message type' };
  };
}
