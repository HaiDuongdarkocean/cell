/**
 * CardDraft — in-memory card draft state + autosave to chrome.storage.local.
 *
 * Per spec §5.2: the draft holds the user's work-in-progress card (note type,
 * deck, fields, field mapping, tags, update mode). Config selections (note
 * type, deck, field mapping, media update mode) + tags are autosaved to
 * `chrome.storage.local` under key `cardCreatorDraft` (debounced 500ms) so
 * that a tab crash / accidental close doesn't lose selections. Text field
 * content (targetWord, sentence, definitions, note, moreExample) and media
 * are NOT persisted — closing the dialog clears all field content except
 * tags. Cleared on successful Add/Update.
 *
 * Note: MediaFile ArrayBuffer is NOT persisted (storage.local can't hold
 * ArrayBuffer reliably across sessions + would bloat storage). On restore,
 * media arrays are emptied — the user re-captures. Text fields are also
 * emptied on restore (closing the dialog = clear content, keep tags + config).
 */
import type { MediaFile } from '../media/mediaFile';
import type { FieldMapping } from '../service/fieldMapping';
import type { CardCreatorPrefill } from '../types';

/** Update mode for media + fields when updating an existing note. */
export type MediaUpdateMode = 'overwrite' | 'append' | 'skip';

/** Card field values (text + media). */
export interface CardFields {
  readonly targetWord: string;
  readonly sentence: string;
  readonly sentenceTranslation: string;
  readonly definitions: string;
  readonly images: readonly MediaFile[];
  readonly sentenceAudios: readonly MediaFile[];
  readonly wordAudios: readonly MediaFile[];
  readonly note: string;
  readonly moreExample: string;
}

/** Full card draft. */
export interface CardDraft {
  readonly noteType: string;
  readonly deck: string;
  readonly fields: CardFields;
  readonly fieldMapping: FieldMapping;
  readonly tags: string;
  readonly mediaUpdateMode: MediaUpdateMode;
}

/** Storage key for the autosaved draft. */
export const DRAFT_STORAGE_KEY = 'cardCreatorDraft';

/** Autosave debounce delay (ms). */
const AUTOSAVE_DEBOUNCE_MS = 500;

/** Serialized draft (only config + tags persisted; field content cleared on
 *  close per UX requirement: closing the dialog clears all field content
 *  except tags). */
interface SerializedDraft {
  readonly noteType: string;
  readonly deck: string;
  readonly fieldMapping: FieldMapping;
  readonly tags: string;
  readonly mediaUpdateMode: MediaUpdateMode;
  /** Saved timestamp (ms since epoch). */
  readonly savedAt: number;
}

/** Serialize a draft for storage (strips field content + media — only config
 *  + tags persisted). */
export function serializeDraft(draft: CardDraft): SerializedDraft {
  return {
    noteType: draft.noteType,
    deck: draft.deck,
    fieldMapping: draft.fieldMapping,
    tags: draft.tags,
    mediaUpdateMode: draft.mediaUpdateMode,
    savedAt: Date.now(),
  };
}

/** Deserialize a stored draft back to a CardDraft (text fields + media empty
 *  — closing the dialog clears all field content except tags). */
export function deserializeDraft(serialized: SerializedDraft): CardDraft {
  return {
    noteType: serialized.noteType,
    deck: serialized.deck,
    fields: {
      targetWord: '',
      sentence: '',
      sentenceTranslation: '',
      definitions: '',
      images: [],
      sentenceAudios: [],
      wordAudios: [],
      note: '',
      moreExample: '',
    },
    fieldMapping: serialized.fieldMapping,
    tags: serialized.tags,
    mediaUpdateMode: serialized.mediaUpdateMode,
  };
}

/** Check if a serialized draft is valid (has required shape). */
export function isValidSerializedDraft(value: unknown): value is SerializedDraft {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.noteType === 'string' &&
    typeof v.deck === 'string' &&
    typeof v.tags === 'string' &&
    (v.mediaUpdateMode === 'overwrite' || v.mediaUpdateMode === 'append' || v.mediaUpdateMode === 'skip') &&
    typeof v.savedAt === 'number'
  );
}

/**
 * Debounced autosave controller. Call `schedule(draft)` to schedule a save
 * (debounced 500ms). Call `flush()` to save immediately. Call `cancel()` to
 * cancel a pending save.
 *
 * Uses chrome.storage.local directly (no message bus — storage is fast +
 * synchronous-ish). Falls back to no-op if chrome.storage is unavailable
 * (test env).
 */
export class DraftAutosaver {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: CardDraft | null = null;
  private readonly storage: chrome.storage.StorageArea | null;

  constructor() {
    this.storage =
      typeof chrome !== 'undefined' && chrome.storage?.local ? chrome.storage.local : null;
  }

  /** Schedule a debounced save. */
  schedule(draft: CardDraft): void {
    this.pending = draft;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), AUTOSAVE_DEBOUNCE_MS);
  }

  /** Save immediately (cancel any pending debounce). */
  flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.pending || !this.storage) {
      this.pending = null;
      return Promise.resolve();
    }
    const serialized = serializeDraft(this.pending);
    this.pending = null;
    return this.storage.set({ [DRAFT_STORAGE_KEY]: serialized });
  }

  /** Cancel a pending save (without saving). */
  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pending = null;
  }

  /** Load the saved draft from storage (or null if none/invalid). */
  async load(): Promise<CardDraft | null> {
    if (!this.storage) return null;
    const result = await this.storage.get(DRAFT_STORAGE_KEY);
    const value = result[DRAFT_STORAGE_KEY];
    if (!isValidSerializedDraft(value)) return null;
    return deserializeDraft(value);
  }

  /** Clear the saved draft from storage (on successful Add/Update or Cancel). */
  async clear(): Promise<void> {
    if (this.storage) {
      await this.storage.remove(DRAFT_STORAGE_KEY);
    }
  }
}

/** Create an empty draft with the given note type + deck defaults. */
export function createEmptyDraft(noteType: string, deck: string): CardDraft {
  return {
    noteType,
    deck,
    fields: {
      targetWord: '',
      sentence: '',
      sentenceTranslation: '',
      definitions: '',
      images: [],
      sentenceAudios: [],
      wordAudios: [],
      note: '',
      moreExample: '',
    },
    fieldMapping: {},
    tags: '',
    mediaUpdateMode: 'overwrite',
  };
}

/** Merge plan for a single media collection (images, word/sentence audio).
 *  `keptByUrl` maps source URLs to existing MediaFiles that should be reused.
 *  `orderedUrls` is the final desired order (kept URLs + new URLs to fetch).
 *  `unmapped` holds media that came from outside the prefill (screenshots,
 *  disk uploads, captured audio) and are preserved at the end. */
export interface MediaMergePlan {
  /** Existing media keyed by source URL that are still selected. */
  readonly keptByUrl: Readonly<Record<string, MediaFile>>;
  /** Final ordered source URLs (existing + new, in prefill order). */
  readonly orderedUrls: readonly string[];
  /** Existing media without a source URL to preserve at the end. */
  readonly unmapped: readonly MediaFile[];
}

/** Result of merging a new prefill into an existing draft. */
export interface PrefillMergeResult {
  /** Draft with text fields merged. Media arrays are left as-is and must be
   *  rebuilt from `media` after the caller fetches any missing URLs. */
  readonly draft: CardDraft;
  readonly media: {
    readonly images: MediaMergePlan;
    readonly wordAudios: MediaMergePlan;
    readonly sentenceAudios: MediaMergePlan;
  };
}

/** Split a formatted definition string into individual bullet lines. */
function splitDefinitionLines(value: string): string[] {
  return value
    .split(/\n\s*\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Normalize a definition line for matching (collapse whitespace). */
function normalizeDefinitionLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

/** Merge two definition strings by diff/merge of their bullet lines.
 *  Deterministic and idempotent for identical inputs. */
function mergeDefinitionLines(current: string, next: string | undefined, mode: MediaUpdateMode): string {
  if (next === undefined) return current;
  if (mode === 'overwrite') return next;
  if (mode === 'skip') return current.trim() === '' ? next : current;

  const currentLines = splitDefinitionLines(current);
  const nextLines = splitDefinitionLines(next);
  const currentByNormal = new Map<string, string>();
  for (const line of currentLines) {
    const key = normalizeDefinitionLine(line);
    if (!currentByNormal.has(key)) currentByNormal.set(key, line);
  }
  const merged = nextLines.map((line) => {
    const key = normalizeDefinitionLine(line);
    return currentByNormal.get(key) ?? line;
  });
  return merged.join('\n\n');
}

/** Merge a single text field according to `mediaUpdateMode`. */
function mergeTextField(current: string, next: string | undefined, mode: MediaUpdateMode): string {
  if (next === undefined) return current;
  if (mode === 'overwrite') return next;
  if (mode === 'skip') return current.trim() === '' ? next : current;
  // append: replace with the new selection when it differs and is non-empty.
  return next && next !== current ? next : current;
}

/** Build a merge plan for one media collection. */
function buildMediaMergePlan(
  current: readonly MediaFile[],
  nextUrls: readonly string[] | undefined,
  mode: MediaUpdateMode,
): MediaMergePlan {
  const ordered = nextUrls ?? [];
  const bySourceUrl: Record<string, MediaFile> = {};
  const currentSourceUrls: string[] = [];
  const unmapped: MediaFile[] = [];

  for (const file of current) {
    if (file.sourceUrl) {
      if (!bySourceUrl[file.sourceUrl]) bySourceUrl[file.sourceUrl] = file;
      if (!currentSourceUrls.includes(file.sourceUrl)) currentSourceUrls.push(file.sourceUrl);
    } else {
      unmapped.push(file);
    }
  }

  if (mode === 'skip' && current.length > 0) {
    return { keptByUrl: bySourceUrl, orderedUrls: currentSourceUrls, unmapped };
  }

  const kept: Record<string, MediaFile> = {};
  for (const url of ordered) {
    if (bySourceUrl[url] && !kept[url]) kept[url] = bySourceUrl[url];
  }

  if (mode === 'overwrite') {
    return { keptByUrl: kept, orderedUrls: ordered, unmapped: [] };
  }

  if (mode === 'append') {
    return { keptByUrl: kept, orderedUrls: ordered, unmapped };
  }

  // skip with an empty current collection
  return { keptByUrl: {}, orderedUrls: ordered, unmapped: [] };
}

/** Compare the new prefill with the current draft and produce a merge plan.
 *  Respects `mediaUpdateMode`: `overwrite` replaces, `append` diff/merges,
 *  `skip` only fills empty fields. The function is pure, deterministic, and
 *  idempotent for identical inputs. */
export function mergePrefillIntoDraft(draft: CardDraft, prefill: CardCreatorPrefill): PrefillMergeResult {
  const { fields, mediaUpdateMode } = draft;

  const nextFields: CardFields = {
    ...fields,
    targetWord: mergeTextField(fields.targetWord, prefill.targetWord, mediaUpdateMode),
    sentence: mergeTextField(fields.sentence, prefill.sentence, mediaUpdateMode),
    sentenceTranslation: mergeTextField(fields.sentenceTranslation, prefill.sentenceTranslation, mediaUpdateMode),
    definitions: mergeDefinitionLines(fields.definitions, prefill.definitions, mediaUpdateMode),
    note: prefill.note === undefined ? fields.note : mergeTextField(fields.note, prefill.note, mediaUpdateMode),
    moreExample: prefill.moreExample === undefined ? fields.moreExample : mergeTextField(fields.moreExample, prefill.moreExample, mediaUpdateMode),
  };

  return {
    draft: { ...draft, fields: nextFields },
    media: {
      images: buildMediaMergePlan(fields.images, prefill.imageUrls, mediaUpdateMode),
      wordAudios: buildMediaMergePlan(fields.wordAudios, prefill.wordAudioUrls, mediaUpdateMode),
      sentenceAudios: buildMediaMergePlan(fields.sentenceAudios, prefill.sentenceAudioUrls, mediaUpdateMode),
    },
  };
}

/** Return the source URLs from a merge plan that need to be fetched. */
export function mediaUrlsToFetch(plan: MediaMergePlan): readonly string[] {
  return plan.orderedUrls.filter((url) => !plan.keptByUrl[url]);
}

/** Build the final media array by combining kept + newly fetched files. */
export function buildMergedMediaArray(
  plan: MediaMergePlan,
  fetchedByUrl: Record<string, MediaFile | undefined>,
): readonly MediaFile[] {
  const result: MediaFile[] = [];
  for (const url of plan.orderedUrls) {
    const file = plan.keptByUrl[url] ?? fetchedByUrl[url];
    if (file) result.push(file);
  }
  result.push(...plan.unmapped);
  return result;
}
