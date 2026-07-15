// quickAddHandler — spec §9.2, D7: Quick Add to Anki via AnkiConnect.
//
// Flow:
// 1. assembleQuickAddPayload (Task 5.1) → QuickAddPayload.
// 2. buildAnkiNoteFields → field mapping → AnkiNote fields.
// 3. addNote via AnkiConnectClient.
// 4. On connection error → offline retry (queue + retry on reconnect).
// 5. On field error → return QuickAddResponse with fieldErrors.
//
// Media (audio/image) binary fetch happens here — fetch URL → storeMediaFile
// → field ref. Fail → skip item, continue.

import { addNote, storeMediaFile, type AnkiNote, type FetchFn } from '@/features/cardCreator/service/ankiConnectClient';
import type { QuickAddPayload, QuickAddResponse, QuickAddFieldError } from '../types';
import type { CardCreatorSettings } from '@/entities/settings/types';
import { buildAnkiNoteFields } from './quickAddAssembler';

/** Default fetch implementation — uses global fetch. */
const defaultFetch: FetchFn = (url, opts) => fetch(url, opts);

/** Retry queue for offline Quick Add (spec: offline retry). */
interface QueuedQuickAdd {
  readonly payload: QuickAddPayload;
  readonly settings: CardCreatorSettings;
  readonly fieldMapping: Record<string, string>;
  readonly timestamp: number;
}

const offlineQueue: QueuedQuickAdd[] = [];

/** Queue a Quick Add for later retry (offline mode). */
export function queueQuickAdd(
  payload: QuickAddPayload,
  settings: CardCreatorSettings,
  fieldMapping: Record<string, string>,
): void {
  offlineQueue.push({ payload, settings, fieldMapping, timestamp: Date.now() });
}

/** Get the current offline queue length. */
export function getOfflineQueueLength(): number {
  return offlineQueue.length;
}

/** Clear the offline queue (for testing). */
export function clearOfflineQueue(): void {
  offlineQueue.length = 0;
}

/** Process the offline queue — retry all queued Quick Adds. */
export async function processOfflineQueue(
  fetchFn: FetchFn = defaultFetch,
): Promise<QuickAddResponse[]> {
  const results: QuickAddResponse[] = [];
  while (offlineQueue.length > 0) {
    const item = offlineQueue.shift()!;
    const result = await executeQuickAdd(item.payload, item.settings, item.fieldMapping, fetchFn);
    results.push(result);
    if (!result.ok && isConnectionError(result.error ?? '')) {
      // executeQuickAdd already re-queued on connection error — stop processing.
      break;
    }
  }
  return results;
}

/**
 * Execute a Quick Add to Anki.
 *
 * @param payload - QuickAddPayload from assembleQuickAddPayload.
 * @param settings - Card Creator settings (deck, noteType, tags, URL).
 * @param fieldMapping - Field mapping (fieldName → source).
 * @param fetchFn - Fetch function (for testing).
 * @returns QuickAddResponse with ok/noteId/error/fieldErrors.
 */
export async function executeQuickAdd(
  payload: QuickAddPayload,
  settings: CardCreatorSettings,
  fieldMapping: Record<string, string>,
  fetchFn: FetchFn = defaultFetch,
): Promise<QuickAddResponse> {
  try {
    // Build Anki note fields from payload + mapping.
    const fields = buildAnkiNoteFields(payload, fieldMapping);

    // Build AnkiNote.
    const note: AnkiNote = {
      deckName: settings.defaultDeck,
      modelName: settings.defaultNoteType,
      fields,
      tags: settings.defaultTags ? settings.defaultTags.split(/\s+/).filter(Boolean) : [],
    };

    // Add note via AnkiConnect.
    const noteId = await addNote(fetchFn, settings.ankiConnectUrl, note);

    if (noteId === null) {
      return {
        ok: false,
        error: 'AnkiConnect returned null noteId (duplicate or invalid note)',
      };
    }

    // Media: fetch binary + storeMediaFile (audio/image).
    // ponytail: media fetch is best-effort — failures skip the item, not the note.
    const mediaErrors: string[] = [];
    for (const audio of payload.audios) {
      if (audio.url) {
        try {
          await fetchAndStoreMedia(fetchFn, settings.ankiConnectUrl, audio.url, audio.id);
        } catch {
          mediaErrors.push(`Audio ${audio.label} fetch failed — skipped`);
        }
      }
    }
    for (const image of payload.images) {
      try {
        await fetchAndStoreMedia(fetchFn, settings.ankiConnectUrl, image.src, image.id);
      } catch {
        mediaErrors.push(`Image ${image.alt} fetch failed — skipped`);
      }
    }

    return {
      ok: true,
      noteId,
      error: mediaErrors.length > 0 ? mediaErrors.join('; ') : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Check if it's a connection error (offline).
    if (isConnectionError(message)) {
      // Queue for retry.
      queueQuickAdd(payload, settings, fieldMapping);
      return {
        ok: false,
        error: `AnkiConnect offline — queued for retry (${message})`,
      };
    }

    // Check if it's a field error (AnkiConnect returns field-specific errors).
    const fieldErrors = parseFieldErrors(message);
    if (fieldErrors.length > 0) {
      return { ok: false, error: message, fieldErrors };
    }

    return { ok: false, error: message };
  }
}

/** Fetch binary media + store via AnkiConnect storeMediaFile. */
async function fetchAndStoreMedia(
  fetchFn: FetchFn,
  ankiUrl: string,
  url: string,
  filename: string,
): Promise<void> {
  // Media fetch uses the real fetch API (not FetchFn — which is a minimal
  // interface for AnkiConnect JSON only). ponytail: if media fetch needs
  // testing, inject a separate mediaFetchFn.
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Media fetch failed: ${response.status} ${url}`);
  }
  const blob = await response.blob();
  const base64 = await blobToBase64(blob);
  await storeMediaFile(fetchFn, ankiUrl, {
    filename,
    data: base64,
  });
}

/** Convert blob to base64 string. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix: "data:image/jpeg;base64,..."
      const base64 = result.split(',')[1] ?? result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Check if an error message indicates a connection issue (offline). */
function isConnectionError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('connection refused') ||
    lower.includes('err_connection') ||
    lower.includes('load failed')
  );
}

/** Parse AnkiConnect field errors from error message. */
function parseFieldErrors(message: string): QuickAddFieldError[] {
  // AnkiConnect returns errors like: "cannot create note because it is a duplicate"
  // or field-specific: "value for field 'Front' is required"
  const errors: QuickAddFieldError[] = [];
  const fieldMatch = message.match(/field ['"]?(\w+)['"]?/i);
  if (fieldMatch) {
    errors.push({ field: fieldMatch[1]!, message });
  }
  return errors;
}
