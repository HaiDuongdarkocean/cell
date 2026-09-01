import type { SrsFieldValue, SrsNotetype } from '@/entities/srs/types';

export const COMPONENT_TYPES: readonly ('meaning' | 'sound' | 'spelling')[] = [
  'sound',
  'meaning',
  'spelling',
];

export const FUTURE_ISO = '9999-12-31T23:59:59.999Z';

/**
 * Return the earliest ISO string from a list. An empty list falls back to
 * `FUTURE_ISO` (everything is later than the far future).
 */
export function minISO(...values: string[]): string {
  return values.reduce((min, v) => (v < min ? v : min), values[0] ?? FUTURE_ISO);
}

/**
 * Spelling normalization: lowercase, trim, collapse whitespace, and strip
 * leading/trailing non-word / non-whitespace characters.
 *
 * V1 targets English; multi-language punctuation handling is a known ceiling.
 */
export function normalizeSpelling(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[^\w\s]+|[^\w\s]+$/g, '');
}

/**
 * Escape a string so it can be safely embedded in a RegExp source.
 */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Synchronous, stable DJB2 hash. Used to generate deterministic asset ids in
 * the browser without depending on `crypto`.
 */
export function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i);
    hash |= 0; // keep 32-bit signed
  }
  return (hash >>> 0).toString(36);
}

/**
 * Stable audio asset id for a given note + field + source.
 */
export function audioAssetId(noteId: string, fieldId: string, source: string): string {
  return hashString(`${noteId}:${fieldId}:${source}`);
}

/**
 * Stable image asset id for a given note + field.
 */
export function imageAssetId(noteId: string, fieldId: string): string {
  return hashString(`${noteId}:${fieldId}`);
}

/**
 * Returns true when a string starts with the `data:` scheme.
 */
export function isDataUrl(s: string): boolean {
  return s.startsWith('data:');
}

/**
 * Generate a unique id. Uses `crypto.randomUUID` when available, otherwise a
 * time + random fallback suitable for tests and jsdom.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2);
  return `${time}-${random}`;
}

export interface DictionaryToSrsFieldsInput {
  readonly term: string;
  readonly reading?: string;
  readonly sentence?: string;
  readonly definitions?: readonly string[];
  readonly audioUrl?: string;
  readonly sentenceAudioUrl?: string;
  readonly imageUrl?: string;
  readonly translation?: string;
}

/**
 * Map a raw dictionary lookup result onto a notetype's field ids.
 * Unknown or absent fields are omitted.
 */
export function mapDictionaryToSrsFields(
  notetype: SrsNotetype,
  result: DictionaryToSrsFieldsInput,
): Record<string, SrsFieldValue> {
  const fields: Record<string, SrsFieldValue> = {};

  for (const field of notetype.fields) {
    switch (field.id) {
      case 'target':
        fields['target'] = { kind: 'text', value: result.term };
        break;
      case 'ipa':
        if (result.reading) {
          fields['ipa'] = { kind: 'text', value: result.reading };
        }
        break;
      case 'sentence':
        if (result.sentence) {
          fields['sentence'] = { kind: 'text', value: result.sentence };
        }
        break;
      case 'def':
        if (result.definitions?.length) {
          fields['def'] = { kind: 'text', value: result.definitions[0] };
        }
        break;
      case 'wordAudio':
        if (result.audioUrl) {
          fields['wordAudio'] = {
            kind: 'audio',
            value: result.audioUrl,
            source: 'pronunciation',
          };
        }
        break;
      case 'sentAudio':
        if (result.sentenceAudioUrl) {
          fields['sentAudio'] = {
            kind: 'audio',
            value: result.sentenceAudioUrl,
            source: 'tts',
          };
        }
        break;
      case 'image':
        if (result.imageUrl) {
          fields['image'] = { kind: 'image', value: result.imageUrl };
        }
        break;
      case 'translation':
        if (result.translation) {
          fields['translation'] = { kind: 'translation', value: result.translation };
        }
        break;
    }
  }

  return fields;
}
