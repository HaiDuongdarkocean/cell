import type {
  ComponentType,
  SrsAudioAsset,
  SrsFieldValue,
  SrsImageAsset,
  SrsNote,
  SrsNotetype,
  SrsStimulus,
  SrsVariant,
} from '@/entities/srs/types';
import { SRS_INPUT_FIELD_ID } from '@/entities/srs/types';
import { audioAssetId, escapeRegExp, imageAssetId, isDataUrl, mediaFieldValues } from '@/features/srs/lib/helpers';
import { hasVariantMaterial } from '@/features/srs/lib/variantFront';
import { createBlobUrl } from '@/shared/lib/blobUrl';
import type { SrsFrontTemplate } from '@/entities/srs/types';

/** Mask every case-insensitive occurrence of the target word in a sentence. */
export function maskSentence(sentence: string, targetWord: string): string {
  const re = new RegExp(escapeRegExp(targetWord), 'gi');
  return sentence.replace(re, (match) => '░'.repeat(match.length));
}

/** Resolve one note field into a renderable value — media may come from the asset cache or a direct URL. */
function resolveFieldValue(
  note: SrsNote,
  fieldId: string,
  audioCache: ReadonlyMap<string, SrsAudioAsset>,
  imageCache: ReadonlyMap<string, SrsImageAsset>,
): SrsFieldValue | null {
  if (fieldId === 'target') {
    return note.targetWord.trim() ? { kind: 'text', value: note.targetWord } : null;
  }
  const value = note.fields[fieldId];
  if (!value) return null;

  if (value.kind === 'audio') {
    const urls: string[] = [];
    mediaFieldValues(value).forEach((v, i) => {
      const cached = audioCache.get(audioAssetId(note.id, fieldId, value.source, i));
      if (cached) {
        urls.push(createBlobUrl(cached.bytes, cached.mimeType));
      } else if (isDataUrl(v) || /^https?:|^blob:/.test(v)) {
        urls.push(v);
      }
    });
    if (urls.length === 0) return null;
    return { kind: 'audio', value: urls, source: value.source };
  }
  if (value.kind === 'image') {
    const urls: string[] = [];
    mediaFieldValues(value).forEach((v, i) => {
      const cached = imageCache.get(imageAssetId(note.id, fieldId, i));
      if (cached) {
        urls.push(createBlobUrl(cached.bytes, cached.mimeType));
      } else if (isDataUrl(v) || /^https?:|^blob:/.test(v)) {
        urls.push(v);
      }
    });
    if (urls.length === 0) return null;
    return { kind: 'image', value: urls };
  }
  return value;
}

/**
 * Note view restricted to the fields that actually resolved — used to re-derive
 * servability and toggles on real material instead of field-record presence.
 */
export function resolvedNoteOf(note: SrsNote, payload: Readonly<Record<string, SrsFieldValue>>): SrsNote {
  return {
    ...note,
    targetWord: payload.target?.kind === 'text' ? note.targetWord : '',
    fields: Object.fromEntries(
      Object.entries(note.fields).filter(([k]) => payload[k] !== undefined),
    ),
  };
}

/**
 * Build the front stimulus for a variant — every non-input field in fieldIds order.
 * Fields that fail to resolve are dropped; returns null when nothing rendered.
 */
export function buildVariantStimulus(
  note: SrsNote,
  variant: SrsVariant,
  audioCache: ReadonlyMap<string, SrsAudioAsset>,
  imageCache: ReadonlyMap<string, SrsImageAsset>,
): { stimulus: SrsStimulus; resolvedNote: SrsNote } | null {
  const payload: Record<string, SrsFieldValue> = {};
  for (const fieldId of variant.fieldIds) {
    if (fieldId === SRS_INPUT_FIELD_ID) continue;
    if (!hasVariantMaterial(fieldId, note)) continue;
    const resolved = resolveFieldValue(note, fieldId, audioCache, imageCache);
    if (resolved) payload[fieldId] = resolved;
  }
  if (Object.keys(payload).length === 0) return null;
  return { stimulus: { type: `variant:${variant.id}`, payload }, resolvedNote: resolvedNoteOf(note, payload) };
}

/** Build a single stimulus for a template, returning null if any required field is missing or not cacheable. */
export function buildStimulus(
  note: SrsNote,
  template: SrsFrontTemplate,
  audioCache: ReadonlyMap<string, SrsAudioAsset>,
  imageCache: ReadonlyMap<string, SrsImageAsset>,
): SrsStimulus | null {
  const payload: Record<string, SrsFieldValue> = {};

  for (const fieldId of template.fieldIds) {
    const value = note.fields[fieldId];
    if (!value) return null;

    if (template.maskTarget && template.maskFieldId === fieldId && value.kind === 'text') {
      payload[fieldId] = { kind: 'text', value: maskSentence(value.value, note.targetWord) };
      continue;
    }
    const resolved = resolveFieldValue(note, fieldId, audioCache, imageCache);
    if (!resolved) return null;
    payload[fieldId] = resolved;
  }

  return { type: template.stimulusType, payload };
}

/** Pick the first template that can produce a renderable stimulus for the requested component. */
export function resolveReviewSurface(
  note: SrsNote,
  notetype: SrsNotetype,
  type: ComponentType,
  audioCache: ReadonlyMap<string, SrsAudioAsset>,
  imageCache: ReadonlyMap<string, SrsImageAsset>,
): { template: SrsFrontTemplate; stimulus: SrsStimulus } | null {
  const candidates = notetype.frontTemplates.filter((t) => t.componentType === type);
  if (candidates.length === 0) return null;

  for (const template of candidates) {
    const stimulus = buildStimulus(note, template, audioCache, imageCache);
    if (stimulus) return { template, stimulus };
  }

  return null;
}
