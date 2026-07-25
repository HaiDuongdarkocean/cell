/**
 * Card Creator service — high-level API the UI calls.
 *
 * Wraps the message bus to invoke AnkiConnect actions via the background
 * service worker. Each method returns a Result type (never throws) so the UI
 * can render errors without try/catch noise.
 *
 * === AnkiConnect API conformance (verified 2026-11) ===
 * Source: https://git.sr.ht/~foosoft/anki-connect (canonical) +
 *         https://github.com/KamWithK/AnkiconnectAndroid (Android reimpl).
 *         Android action list verified from source code:
 *         AnkiAPIRouting.java → findRoute() switch statement (authoritative).
 *
 * Android-supported actions (from source switch cases):
 *   version, deckNames, deckNamesAndIds, modelNames, modelNamesAndIds,
 *   modelFieldNames, findNotes, guiBrowse, canAddNotes,
 *   canAddNotesWithErrorDetail, addNote, updateNoteFields, storeMediaFile,
 *   notesInfo, multi
 *
 * Actions used here + their Android support:
 *   version          — desktop + Android (Android returns "6"; not in api.md
 *                      but confirmed in source)
 *   deckNames        — desktop + Android
 *   modelNames       — desktop + Android
 *   modelFieldNames  — desktop + Android
 *   findNotes        — desktop + Android (Android: quote-escaping broken
 *                      unless new Rust backend; we only quote when needed;
 *                      slower than desktop)
 *   notesInfo        — desktop + Android
 *   addNote          — desktop + Android (Android: media supports url+data
 *                      only, no skipHash; picture/audio/video all supported)
 *   updateNoteFields — desktop + Android
 *   storeMediaFile   — desktop + Android (Android: appends random number to
 *                      filename → MUST use returned filename in field refs)
 *   addTags          — desktop ONLY (Android: hits `default` case → silent
 *                      no-op returning "AnkiConnect v.6"; detected via
 *                      result shape check)
 *   createModel      — desktop ONLY (Android: hits `default` case → silent
 *                      no-op; detected via re-check modelNames after call)
 *
 * CRITICAL Android behavior: the `default` switch case returns
 * `"AnkiConnect v.6"` as the result with HTTP 200 — NOT an error. Any
 * unsupported action silently "succeeds" without doing anything. We detect
 * this for addTags (result !== null) and createModel (re-check modelNames).
 *
 * Actions NOT used (Android incompatibility — would hit default silent no-op):
 *   findCards, cardsInfo, cardsToNotes, removeTags, getTags, suspend, etc.
 *
 * Query syntax notes (Anki search):
 *   `deck:"Name"`    — quote only when name contains spaces (Android breaks
 *                      on quotes unless new backend)
 *   `note:"Model"`   — same quoting rule
 *   `added:N`        — notes added in last N days (granularity = days)
 *   `edited:N`       — notes edited in last N days (granularity = days)
 *   Note ids are timestamp-based (ms since epoch) → sorting by id desc gives
 *   newest-first without needing `edited:`/`added:` filters.
 */
import { sendMessage } from '@/shared/lib/chrome-apis';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type {
  MessageResponse,
  CardCreatorRequestPayload,
  CardCreatorResponseData,
} from '@/entities/message';
import type { MediaUpdateMode } from '@/entities/settings';

/** Ok or error result — never throws. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Send a raw AnkiConnect action through the background. */
async function sendAction(
  url: string,
  action: string,
  params?: Record<string, unknown>,
  timeoutMs?: number,
): Promise<Result<unknown>> {
  const payload: CardCreatorRequestPayload = { url, action, params, timeoutMs };
  try {
    const response = (await sendMessage({
      type: MESSAGE_TYPES.CARD_CREATOR_REQUEST,
      payload,
    })) as MessageResponse<CardCreatorResponseData> | undefined;
    if (!response) {
      return { ok: false, error: 'No response from background' };
    }
    if (!response.success) {
      return { ok: false, error: response.error ?? 'Unknown AnkiConnect error' };
    }
    return { ok: true, value: response.data?.result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/** Quote a deck/model name for Anki search query ONLY if it contains spaces
 *  or special chars. AnkiconnectAndroid breaks on quotes unless new backend,
 *  so we avoid quoting simple names. */
function quoteIfNeeded(name: string): string {
  if (!name) return '';
  // Quote if contains space, colon, or quote.
  if (/[\s:"]/.test(name)) {
    return `"${name.replace(/"/g, '')}"`;
  }
  return name;
}

/** Test connection — returns AnkiConnect version number. */
export async function testConnection(url: string): Promise<Result<number>> {
  const r = await sendAction(url, 'version');
  if (r.ok) return { ok: true, value: r.value as number };
  return r;
}

/** List all deck names. */
export async function listDecks(url: string): Promise<Result<string[]>> {
  const r = await sendAction(url, 'deckNames');
  if (r.ok) return { ok: true, value: r.value as string[] };
  return r;
}

/** List all note type (model) names. */
export async function listModels(url: string): Promise<Result<string[]>> {
  const r = await sendAction(url, 'modelNames');
  if (r.ok) return { ok: true, value: r.value as string[] };
  return r;
}

/** List field names of a note type. */
export async function listModelFields(
  url: string,
  modelName: string,
): Promise<Result<string[]>> {
  const r = await sendAction(url, 'modelFieldNames', { modelName });
  if (r.ok) return { ok: true, value: r.value as string[] };
  return r;
}

/** Find the most recently created note in a deck + note type. Returns the
 *  note id (newest first by id — Anki note ids are ms-timestamps), or null
 *  if no notes exist in that deck+model.
 *
 *  Uses `findNotes` (Android-compatible) instead of `findCards` (Android-
 *  incompatible). We do NOT filter by `added:`/`edited:` because their
 *  granularity is days, not minutes — instead we sort by id desc and let the
 *  caller decide whether the newest note is "recent enough". */
export async function findRecentNote(
  url: string,
  deck: string,
  modelName: string,
): Promise<Result<number | null>> {
  const query = `deck:${quoteIfNeeded(deck)} note:${quoteIfNeeded(modelName)}`;
  const r = await sendAction(url, 'findNotes', { query });
  if (!r.ok) return r;
  const ids = r.value as number[] | null;
  if (!ids || ids.length === 0) return { ok: true, value: null };
  // findNotes returns unordered; sort desc (newest first) + take first.
  const sorted = [...ids].sort((a, b) => b - a);
  return { ok: true, value: sorted[0] };
}

/** Get a note's info (fields, tags, modelName) by note id.
 *  Uses `notesInfo` (Android-compatible). */
export async function getNoteInfo(
  url: string,
  noteId: number,
): Promise<Result<{
  noteId: number;
  modelName: string;
  fields: Record<string, string>;
  tags: string[];
} | null>> {
  const r = await sendAction(url, 'notesInfo', { notes: [noteId] });
  if (!r.ok) return r;
  const notes = r.value as {
    noteId: number;
    modelName: string;
    fields: Record<string, { value: string; order: number }>;
    tags: string[];
  }[] | null;
  if (!notes || notes.length === 0) return { ok: true, value: null };
  const n = notes[0];
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(n.fields)) {
    fields[k] = v.value;
  }
  return { ok: true, value: { noteId, modelName: n.modelName, fields, tags: n.tags } };
}

/** Store a media file in Anki's collection.media. Returns the **stored**
 *  filename — on AnkiconnectAndroid a random number is appended
 *  (e.g. `file.png` → `file_123456789.png`), so callers MUST use the returned
 *  name when referencing the file in note fields (`<img src="...">`).
 *
 *  Desktop AnkiConnect may return `null` on success (older versions) — in
 *  that case we fall back to the input filename. */
export async function storeMedia(
  url: string,
  filename: string,
  base64Data: string,
): Promise<Result<string>> {
  const r = await sendAction(url, 'storeMediaFile', { filename, data: base64Data });
  if (!r.ok) return r;
  const stored = r.value as string | null;
  // Android returns the (possibly renamed) filename; desktop may return null.
  return { ok: true, value: stored ?? filename };
}

/** Add a new note. Returns the new note id (or null if duplicate was skipped).
 *  Pass allowDuplicate: true to bypass Anki's duplicate check. */
export async function addNote(
  url: string,
  note: {
    deckName: string;
    modelName: string;
    fields: Record<string, string>;
    tags: string[];
    options?: { allowDuplicate?: boolean };
  },
): Promise<Result<number | null>> {
  const r = await sendAction(url, 'addNote', { note });
  if (r.ok) return { ok: true, value: r.value as number | null };
  return r;
}

/** Update an existing note's fields per the media update mode.
 *
 *  `overwrite` — replace existing field values with new ones (fields not in
 *                the update payload are preserved by AnkiConnect).
 *  `append`    — append new value to existing value (separated by newline).
 *  `skip`      — only set fields that are empty in the current note.
 *
 *  Note: AnkiConnect `updateNoteFields` only updates the fields present in
 *  the `fields` object — others are preserved. So for `skip` mode we simply
 *  omit fields that already have a value. */
export async function updateNote(
  url: string,
  noteId: number,
  fields: Record<string, string>,
  mediaUpdateMode: MediaUpdateMode,
  currentFields: Record<string, string>,
): Promise<Result<void>> {
  let merged: Record<string, string>;
  if (mediaUpdateMode === 'overwrite') {
    // Only send fields that have a new value — preserve others untouched.
    merged = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v) merged[k] = v;
    }
  } else if (mediaUpdateMode === 'append') {
    merged = {};
    for (const [k, v] of Object.entries(fields)) {
      if (!v) continue;
      const existing = currentFields[k] ?? '';
      merged[k] = existing ? `${existing}\n${v}` : v;
    }
  } else {
    // skip: only set fields that are empty in the current note.
    merged = {};
    for (const [k, v] of Object.entries(fields)) {
      if (!v) continue;
      if (!currentFields[k]) merged[k] = v;
    }
  }
  if (Object.keys(merged).length === 0) {
    return { ok: true, value: undefined };
  }
  const r = await sendAction(url, 'updateNoteFields', { note: { id: noteId, fields: merged } });
  if (!r.ok) return r;
  return { ok: true, value: undefined };
}

/** Add tags to a note. NOTE: `addTags` is desktop-only — AnkiconnectAndroid
 *  does not implement it. On Android the `default` switch case returns
 *  `"AnkiConnect v.6"` as the result (a string) instead of `null` (the
 *  desktop success result), so we detect the silent no-op by checking the
 *  result shape. The UI should show a non-blocking warning (tags set via
 *  addNote on create still work on Android). */
export async function addNoteTags(
  url: string,
  noteId: number,
  tags: string[],
): Promise<Result<void>> {
  const tagString = tags.join(' ');
  if (!tagString) return { ok: true, value: undefined };
  const r = await sendAction(url, 'addTags', { notes: [noteId], tags: tagString });
  if (!r.ok) return r;
  // Desktop addTags success → result is null. Android default handler →
  // result is "AnkiConnect v.6" (silent no-op). Detect + report.
  if (r.value !== null && r.value !== undefined) {
    return {
      ok: false,
      error: 'addTags is not supported on AnkiconnectAndroid. Tags were set via addNote on create; for existing notes, please add tags manually in AnkiDroid.',
    };
  }
  return { ok: true, value: undefined };
}

/** Create the default "Cell Video Card" note type if it doesn't exist.
 *  NOTE: `createModel` is desktop-only — AnkiconnectAndroid does not implement
 *  it. On Android the `default` switch case silently returns
 *  `"AnkiConnect v.6"` as success without creating anything. We detect this
 *  by re-checking `modelNames` after the call — if the model still doesn't
 *  exist, we return a helpful error guiding the user to create it manually. */
export async function ensureDefaultModel(url: string): Promise<Result<void>> {
  // Check if model exists.
  const modelsR = await listModels(url);
  if (!modelsR.ok) return modelsR;
  if (modelsR.value.includes('Cell Video Card')) return { ok: true, value: undefined };

  // Attempt to create it (desktop only).
  const r = await sendAction(url, 'createModel', {
    modelName: 'Cell Video Card',
    inOrderFields: [
      'TargetWord',
      'Sentence',
      'SentenceTranslation',
      'Definitions',
      'Image',
      'SentenceAudio',
      'WordAudio',
      'Note',
      'MoreExample',
      'Tags',
    ],
    cardTemplates: [
      {
        Front: '{{TargetWord}}<br>{{Sentence}}<br>{{SentenceAudio}}',
        Back: '{{FrontSide}}<hr id=answer>{{SentenceTranslation}}<br>{{Definitions}}<br>{{Image}}<br>{{WordAudio}}<br>{{Note}}<br>{{MoreExample}}',
      },
    ],
    css: '.card { font-family: sans-serif; font-size: var(--font-size-base, 14px); text-align: center; color: var(--color-text, black); background-color: var(--color-background, white); }',
  });
  if (!r.ok) return r;

  // Re-check: did the model actually get created? On Android the default
  // handler silently returns success without creating anything.
  const recheckR = await listModels(url);
  if (!recheckR.ok) return recheckR;
  if (!recheckR.value.includes('Cell Video Card')) {
    return {
      ok: false,
      error:
        'createModel is not supported on AnkiconnectAndroid. Please create the "Cell Video Card" note type manually in AnkiDroid with fields: TargetWord, Sentence, SentenceTranslation, Definitions, Image, SentenceAudio, WordAudio, Note, MoreExample, Tags.',
    };
  }
  return { ok: true, value: undefined };
}
