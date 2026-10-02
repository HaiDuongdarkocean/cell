import type { SrsFieldValue } from '@/entities/srs/types';
import { mediaFieldValues } from '@/features/srs';
import type {
  FieldMapping,
  FieldRole,
  NormalizedAnkiNote,
  NormalizedAnkiNotetype,
} from '../model/normalized';


const SOUND_RE = /\[sound:([^\]]+)\]/g;
const IMG_RE = /<img[^>]+src=["']?([^"'\s>]+)["']?[^>]*>/gi;
const HAS_SOUND_RE = /\[sound:[^\]]+\]/;
const HAS_IMG_RE = /<img[^>]+src=/i;
const BR_RE = /<br\s*\/?\s*>/gi;
const BLOCK_RE = /<\/(?:div|p|ul|ol|dl|dt|dd|h[1-6]|blockquote|pre|table|tr|td|th|section|article|header|footer|figure|figcaption|main|aside)\s*>|<(?:li|hr)\b[^>]*>/gi;
const TAG_RE = /<[^>]+>/g;

/** Strip Anki field HTML to plain text: <br>/block tags→newline, tags removed, common entities decoded. */
export function htmlToText(html: string): string {
  const text = html
    .replace(SOUND_RE, '')
    .replace(IMG_RE, '')
    .replace(BR_RE, '\n')
    .replace(BLOCK_RE, '\n')
    .replace(TAG_RE, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function mediaRefsIn(html: string): { sounds: string[]; images: string[] } {
  const sounds = [...html.matchAll(SOUND_RE)].map((m) => m[1]!);
  const images = [...html.matchAll(IMG_RE)].map((m) => m[1]!);
  return { sounds, images };
}

/** A field is "media-only" when stripping media markup + whitespace leaves nothing. */
function isMediaOnly(html: string): boolean {
  return htmlToText(html) === '';
}

/**
 * Guess field roles for a notetype from field names + sample content.
 * Priority: media markers → name hints → ordinal/text-length fallback.
 */
export function guessFieldMapping(
  notetype: NormalizedAnkiNotetype,
  samples: readonly NormalizedAnkiNote[],
): FieldMapping {
  const mapping: FieldMapping = {};

  const sampleValues = (ord: number): string[] =>
    samples.map((n) => n.fields[ord] ?? '').filter((v) => v !== '');

  const medianLen = (ord: number): number => {
    const lens = sampleValues(ord).map((v) => htmlToText(v).length).sort((a, b) => a - b);
    return lens[Math.floor(lens.length / 2)] ?? 0;
  };

  const taken = new Set<FieldRole>();
  const assign = (name: string, role: FieldRole): void => {
    mapping[name] = role;
    taken.add(role);
  };

  // Pass 1: structural markers + name hints.
  for (const f of notetype.fields) {
    const values = sampleValues(f.ord);
    const hasSound = values.some((v) => HAS_SOUND_RE.test(v));
    const hasImg = values.some((v) => HAS_IMG_RE.test(v));
    const mediaOnly = values.length > 0 && values.every(isMediaOnly);
    const name = f.name.toLowerCase();

    if (hasSound && mediaOnly) {
      assign(f.name, /sent|câu|phrase/.test(name) ? 'sentenceAudio' : 'audio');
      continue;
    }
    if (hasImg && mediaOnly) { assign(f.name, 'image'); continue; }
    if (/translation|dịch/.test(name)) { assign(f.name, 'translation'); continue; }
    if (/ipa/.test(name)) { assign(f.name, 'skip'); continue; }
    if (/kana|reading|phonetic|furigana/.test(name)) { assign(f.name, 'context'); continue; }
    if (/audio|sound/.test(name) && mediaOnly) {
      assign(f.name, /sent|câu|phrase/.test(name) ? 'sentenceAudio' : 'audio');
      continue;
    }
    if (/image|picture|photo/.test(name) && mediaOnly) { assign(f.name, 'image'); continue; }
    if (/sentence|example|câu/.test(name)) { assign(f.name, 'sentence'); continue; }
    if (/meaning|definition|glossary|nghĩa/.test(name)) { assign(f.name, 'definition'); continue; }
    if (/note|extra|comment/.test(name)) { assign(f.name, 'notes'); continue; }
    if (/word|term|vocab|expression|front|headword|keyword|target/.test(name)
      && !/audio|sound|image|picture|photo|sentence|example/.test(name)) {
      assign(f.name, 'target');
      continue;
    }
  }

  // Pass 2: lowest-ord unmapped field → target (unless already taken).
  if (!taken.has('target')) {
    const free = notetype.fields
      .filter((f) => mapping[f.name] === undefined)
      .reduce<NormalizedAnkiNotetype['fields'][number] | undefined>(
        (min, f) => (min === undefined || f.ord < min.ord ? f : min),
        undefined,
      );
    if (free) assign(free.name, 'target');
  }

  // Pass 3: longest median text → sentence, second longest → definition.
  const textFields = notetype.fields
    .filter((f) => mapping[f.name] === undefined)
    .map((f) => ({ f, len: medianLen(f.ord) }))
    .sort((a, b) => b.len - a.len);
  for (const { f, len } of textFields) {
    if (len === 0) continue;
    if (!taken.has('sentence') && len >= 12) { assign(f.name, 'sentence'); continue; }
    if (!taken.has('definition')) { assign(f.name, 'definition'); continue; }
  }

  for (const f of notetype.fields) {
    if (mapping[f.name] === undefined) mapping[f.name] = 'skip';
  }
  return mapping;
}

/**
 * Field ids of the single system notetype (`createDefaultNotetype`).
 * Anki notetypes are never imported — every field role normalizes onto these.
 */
const ROLE_FIELD_ID: Record<Exclude<FieldRole, 'skip'>, string> = {
  target: 'target',
  sentence: 'sentence',
  definition: 'def',
  translation: 'translation',
  context: 'context',
  notes: 'notes',
  audio: 'wordAudio',
  sentenceAudio: 'sentAudio',
  image: 'image',
};

export interface BuiltNoteFields {
  readonly fields: Record<string, SrsFieldValue>;
  readonly mediaRequests: readonly { fieldId: string; filename: string; kind: 'audio' | 'image' }[];
}

/**
 * Build `SrsNote.fields` for one Anki note onto the system notetype.
 * Same-role fields merge with `\n\n`; media embedded in text fields routes to
 * `image`/`wordAudio`/`sentAudio` when free. `mediaRequests` lists what the
 * writer must resolve — a miss leaves the field unset (no raw markup).
 */
export function buildNoteFields(
  note: NormalizedAnkiNote,
  nt: NormalizedAnkiNotetype,
  mapping: FieldMapping,
): BuiltNoteFields {
  const fields: Record<string, SrsFieldValue> = {};
  const mediaRequests: { fieldId: string; filename: string; kind: 'audio' | 'image' }[] = [];

  const putMedia = (ids: readonly string[], filename: string, kind: 'audio' | 'image'): void => {
    const id = ids.find((i) => fields[i] === undefined || fields[i]!.kind === kind);
    if (!id) return;
    mediaRequests.push({ fieldId: id, filename, kind });
    const prev = fields[id];
    const list = prev && (prev.kind === 'audio' || prev.kind === 'image') ? mediaFieldValues(prev) : [];
    fields[id] = kind === 'audio'
      ? { kind: 'audio', value: [...list, filename], source: 'local' }
      : { kind: 'image', value: [...list, filename] };
  };

  const putText = (id: string, text: string, kind: 'text' | 'translation' | 'context'): void => {
    const prev = fields[id];
    const merged = prev?.kind === kind ? `${String(prev.value)}\n\n${text}` : text;
    fields[id] = kind === 'translation' ? { kind, value: merged }
      : kind === 'context' ? { kind, value: merged }
      : { kind: 'text', value: merged };
  };

  for (const f of nt.fields) {
    const role = mapping[f.name] ?? 'skip';
    if (role === 'skip') continue;
    const raw = note.fields[f.ord] ?? '';
    const refs = mediaRefsIn(raw);

    if (role === 'audio' || role === 'sentenceAudio') {
      const id = ROLE_FIELD_ID[role];
      for (const s of refs.sounds) {
        putMedia([id, id === 'wordAudio' ? 'sentAudio' : 'wordAudio'], s, 'audio');
      }
      continue;
    }
    if (role === 'image') {
      for (const img of refs.images) putMedia(['image'], img, 'image');
      continue;
    }

    const text = htmlToText(raw);
    if (text) {
      const id = ROLE_FIELD_ID[role];
      const kind = role === 'translation' ? 'translation' : role === 'context' ? 'context' : 'text';
      if (role === 'target' && fields[id]) putText('notes', text, 'text');
      else putText(id, text, kind);
    }
    {
      const id = role === 'sentence' ? 'sentAudio' : 'wordAudio';
      for (const s of refs.sounds) {
        putMedia([id, id === 'wordAudio' ? 'sentAudio' : 'wordAudio'], s, 'audio');
      }
    }
    for (const img of refs.images) putMedia(['image'], img, 'image');
  }

  return { fields, mediaRequests };
}
