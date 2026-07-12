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
import type { FieldMapping, SourceFieldKey } from '../service/fieldMapping';

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

/** All source field keys (used to iterate when building the Anki note).
 *  Tags are NOT included — they're sent via the note's `tags` array, not
 *  mapped to an Anki note field. */
export const ALL_SOURCE_KEYS: readonly SourceFieldKey[] = [
  'targetWord',
  'sentence',
  'sentenceTranslation',
  'definitions',
  'images',
  'sentenceAudios',
  'wordAudios',
  'note',
  'moreExample',
];
