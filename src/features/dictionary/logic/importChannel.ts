// importChannel — SW ↔ offscreen transport for resource-import jobs.
//
// chrome.runtime.sendMessage is JSON-only, so the assembled File cannot ride a
// runtime message. BroadcastChannel structured-clones blobs (handle, not bytes)
// and is origin-scoped — the SW and the offscreen document share it. Events
// flow back on the same channel; the job keep-alive pin holds the SW alive
// while the import job is active, and boot reconcile covers an SW that died
// mid-import anyway.

import type {
  DictionaryComponent,
  DuplicateDecision,
  ImportResult,
} from '@/entities/dictionary';

export const IMPORT_CHANNEL = 'cell-import';

/** SW → offscreen: one resource-import job. */
export interface ImportRunRequest {
  readonly type: 'import-run';
  readonly jobId: string;
  readonly file: File;
  readonly langCode: string;
  readonly components?: readonly DictionaryComponent[];
  readonly signature?: string;
  readonly duplicateDecision?: DuplicateDecision;
}

/** Offscreen → SW: lifecycle events for one job. */
export type ImportRunEvent =
  | { readonly type: 'import-accepted'; readonly jobId: string }
  | { readonly type: 'import-progress'; readonly jobId: string; readonly done: number; readonly total: number }
  | { readonly type: 'import-resource'; readonly jobId: string; readonly resourceId: number }
  | { readonly type: 'import-done'; readonly jobId: string; readonly result: ImportResult }
  | { readonly type: 'import-failed'; readonly jobId: string; readonly error: string };

export type ImportChannelMessage = ImportRunRequest | ImportRunEvent;

/** Minimal port surface so both ends are unit-testable with a fake channel. */
export interface ImportChannelPort {
  postMessage(message: ImportChannelMessage): void;
  listen(handler: (message: unknown) => void): void;
  close(): void;
}

export function isImportRunRequest(message: unknown): message is ImportRunRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === 'import-run'
  );
}

const EVENT_TYPES: ReadonlySet<string> = new Set([
  'import-accepted',
  'import-progress',
  'import-resource',
  'import-done',
  'import-failed',
]);

export function isImportRunEvent(message: unknown): message is ImportRunEvent {
  const type = (message as { type?: unknown } | null)?.type;
  return typeof type === 'string' && EVENT_TYPES.has(type);
}

export function openImportChannel(): ImportChannelPort {
  const channel = new BroadcastChannel(IMPORT_CHANNEL);
  return {
    postMessage: (message) => channel.postMessage(message),
    listen: (handler) => {
      channel.onmessage = (event: MessageEvent) => handler(event.data);
    },
    close: () => channel.close(),
  };
}
