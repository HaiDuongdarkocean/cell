import type {
  ComponentType,
  SrsField,
  SrsFieldValue,
  SrsFrontTemplate,
  SrsNotetype,
} from '@/entities/srs/types';
import type {
  FieldMapping,
  FieldRole,
  NormalizedAnkiNote,
  NormalizedAnkiNotetype,
} from '../model/normalized';
import { ROLE_TO_FIELD_TYPE } from '../model/normalized';

const SOUND_RE = /\[sound:([^\]]+)\]/g;
const IMG_RE = /<img[^>]+src=["']?([^"'\s>]+)["']?[^>]*>/gi;
const HAS_SOUND_RE = /\[sound:[^\]]+\]/;
const HAS_IMG_RE = /<img[^>]+src=/i;
const BR_RE = /<br\s*\/?\s*>/gi;
const TAG_RE = /<[^>]+>/g;

/** Strip Anki field HTML to plain text: <br>→newline, tags removed, common entities decoded. */
export function htmlToText(html: string): string {
  const text = html
    .replace(SOUND_RE, '')
    .replace(IMG_RE, '')
    .replace(BR_RE, '\n')
    .replace(TAG_RE, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
  return text.replace(/[ \t]+\n/g, '\n').trim();
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
  const ord0 = notetype.fields.reduce(
    (min, f) => (f.ord < min.ord ? f : min),
    notetype.fields[0]!,
  );

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

    if (hasSound && mediaOnly) { assign(f.name, 'audio'); continue; }
    if (hasImg && mediaOnly) { assign(f.name, 'image'); continue; }
    if (/translation|dịch/.test(name)) { assign(f.name, 'translation'); continue; }
    if (/ipa|kana|reading|phonetic|furigana/.test(name)) { assign(f.name, 'context'); continue; }
    if (/audio|sound/.test(name) && mediaOnly) { assign(f.name, 'audio'); continue; }
    if (/image|picture|photo/.test(name) && mediaOnly) { assign(f.name, 'image'); continue; }
    if (/sentence|example|câu/.test(name)) { assign(f.name, 'sentence'); continue; }
    if (/meaning|definition|glossary|nghĩa/.test(name)) { assign(f.name, 'definition'); continue; }
    if (/note|extra|comment/.test(name)) { assign(f.name, 'notes'); continue; }
  }

  // Pass 2: ord0 → target (unless already taken).
  if (!taken.has('target')) assign(ord0.name, 'target');

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

const MEDIA_SUFFIX = '__media';

/**
 * Synthesize an `SrsNotetype` from an Anki notetype + role mapping.
 * Mixed text+media fields keep their text and additionally emit a
 * `<fieldId>__media` field typed by the media kind.
 */
export function synthesizeNotetype(
  collectionId: string,
  nt: NormalizedAnkiNotetype,
  mapping: FieldMapping,
  samples: readonly NormalizedAnkiNote[],
): SrsNotetype {
  const fields: SrsField[] = [];
  const fieldIdByOrd = new Map<number, string>();
  let order = 0;

  for (const f of nt.fields) {
    const role = mapping[f.name] ?? 'skip';
    const id = `f${f.ord}`;
    fieldIdByOrd.set(f.ord, id);
    if (role === 'skip') continue;
    fields.push({ id, name: f.name, order: order++, type: ROLE_TO_FIELD_TYPE[role] });

    if (role !== 'audio' && role !== 'image') {
      const values = samples.map((n) => n.fields[f.ord] ?? '');
      const kind = values.some((v) => HAS_SOUND_RE.test(v)) ? 'audio'
        : values.some((v) => HAS_IMG_RE.test(v)) ? 'image' : null;
      if (kind) {
        fields.push({ id: `${id}${MEDIA_SUFFIX}`, name: `${f.name} (media)`, order: order++, type: kind });
      }
    }
  }

  const target = nt.fields.find((f) => mapping[f.name] === 'target') ?? nt.fields[0]!;
  const targetFieldId = fieldIdByOrd.get(target.ord)!;
  const ntId = `anki-${collectionId}-${nt.id}`;

  const byRole = new Map<FieldRole, string[]>();
  for (const f of nt.fields) {
    const role = mapping[f.name] ?? 'skip';
    if (role === 'skip') continue;
    const list = byRole.get(role) ?? [];
    list.push(fieldIdByOrd.get(f.ord)!);
    byRole.set(role, list);
  }
  for (const f of fields) {
    if (f.id.endsWith(MEDIA_SUFFIX)) {
      const list = byRole.get(f.type === 'audio' ? 'audio' : 'image') ?? [];
      list.push(f.id);
      byRole.set(f.type === 'audio' ? 'audio' : 'image', list);
    }
  }

  return {
    id: ntId,
    collectionId,
    name: nt.name,
    targetFieldId,
    fields,
    frontTemplates: buildFrontTemplates(ntId, byRole, targetFieldId),
    backTemplate: { fieldIds: fields.map((f) => f.id), showAll: true },
  };
}

function buildFrontTemplates(
  ntId: string,
  byRole: ReadonlyMap<FieldRole, string[]>,
  targetFieldId: string,
): SrsFrontTemplate[] {
  const templates: SrsFrontTemplate[] = [];
  const audioIds = byRole.get('audio') ?? [];
  const imageIds = byRole.get('image') ?? [];
  const sentenceIds = byRole.get('sentence') ?? [];
  const definitionIds = [...(byRole.get('definition') ?? []), ...(byRole.get('notes') ?? []), ...(byRole.get('context') ?? [])];

  const push = (componentType: ComponentType, stimulusType: SrsFrontTemplate['stimulusType'], fieldIds: string[], extra?: Partial<SrsFrontTemplate>): void => {
    templates.push({
      id: `${componentType}-${stimulusType}-${fieldIds.join('+')}-${ntId}`,
      componentType,
      stimulusType,
      fieldIds,
      requiresInput: componentType === 'spelling',
      ...extra,
    });
  };

  for (const id of imageIds) push('meaning', 'image', [id], { requiresInput: false });
  for (const id of definitionIds) push('meaning', 'definition', [id], { requiresInput: false });
  for (const id of sentenceIds) push('meaning', 'sentence', [id], { maskFieldId: id, maskTarget: true, requiresInput: false });
  push('meaning', 'definition', [targetFieldId], { requiresInput: false, prompt: 'Recall the meaning' });

  for (const id of audioIds) push('sound', id.includes('sent') || id.includes('sentence') ? 'sentence-audio' : 'word-audio', [id], { requiresInput: false });
  for (const id of sentenceIds) push('sound', 'sentence', [id], { maskFieldId: id, maskTarget: true, requiresInput: false });
  push('sound', 'ipa', [targetFieldId], { requiresInput: false, prompt: 'Pronounce this' });

  for (const id of imageIds) push('spelling', 'image', [id]);
  for (const id of sentenceIds) push('spelling', 'sentence', [id], { maskFieldId: id, maskTarget: true });
  push('spelling', 'ipa', [targetFieldId]);

  return templates;
}

export interface BuiltNoteFields {
  readonly fields: Record<string, SrsFieldValue>;
  readonly mediaRequests: readonly { fieldId: string; filename: string; kind: 'audio' | 'image' }[];
}

/**
 * Build `SrsNote.fields` for one Anki note under a synthesized notetype.
 * Media references are NOT resolved here — `mediaRequests` lists what the
 * writer must fetch/store, after which `applyMediaResult` fills values.
 */
export function buildNoteFields(
  note: NormalizedAnkiNote,
  nt: NormalizedAnkiNotetype,
  notetype: SrsNotetype,
  mapping: FieldMapping,
): BuiltNoteFields {
  const fields: Record<string, SrsFieldValue> = {};
  const mediaRequests: { fieldId: string; filename: string; kind: 'audio' | 'image' }[] = [];
  const srsFieldById = new Map(notetype.fields.map((f) => [f.id, f]));

  for (const f of nt.fields) {
    const role = mapping[f.name] ?? 'skip';
    if (role === 'skip') continue;
    const raw = note.fields[f.ord] ?? '';
    const fieldId = `f${f.ord}`;
    const srsField = srsFieldById.get(fieldId);
    if (!srsField) continue;

    const refs = mediaRefsIn(raw);
    const mediaFieldId = `${fieldId}${MEDIA_SUFFIX}`;
    const hasMediaField = srsFieldById.has(mediaFieldId);

    if (srsField.type === 'audio') {
      const filename = refs.sounds[0];
      if (filename) {
        mediaRequests.push({ fieldId, filename, kind: 'audio' });
        fields[fieldId] = { kind: 'audio', value: filename, source: 'local' };
      }
      continue;
    }
    if (srsField.type === 'image') {
      const filename = refs.images[0];
      if (filename) {
        mediaRequests.push({ fieldId, filename, kind: 'image' });
        fields[fieldId] = { kind: 'image', value: filename };
      }
      continue;
    }

    const text = htmlToText(raw);
    if (text === '') continue;
    if (srsField.type === 'translation') fields[fieldId] = { kind: 'translation', value: text };
    else if (srsField.type === 'context') fields[fieldId] = { kind: 'context', value: text };
    else fields[fieldId] = { kind: 'text', value: text };

    if (hasMediaField) {
      const mediaField = srsFieldById.get(mediaFieldId)!;
      const filename = mediaField.type === 'audio' ? refs.sounds[0] : refs.images[0];
      if (filename) {
        mediaRequests.push({ fieldId: mediaFieldId, filename, kind: mediaField.type as 'audio' | 'image' });
        fields[mediaFieldId] = mediaField.type === 'audio'
          ? { kind: 'audio', value: filename, source: 'local' }
          : { kind: 'image', value: filename };
      }
    }
  }

  return { fields, mediaRequests };
}
