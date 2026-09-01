import type {
  ComponentType,
  SrsAudioAsset,
  SrsFieldValue,
  SrsImageAsset,
  SrsNote,
  SrsNotetype,
  SrsStimulus,
} from '@/entities/srs/types';
import { audioAssetId, escapeRegExp, imageAssetId, isDataUrl } from '@/features/srs/lib/helpers';
import type { SrsFrontTemplate } from '@/entities/srs/types';

function blobUrl(blob: Blob): string {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(blob);
  }
  const bytes = new Uint8Array(blob as unknown as ArrayBuffer);
  const b64 = btoa(String.fromCharCode(...bytes));
  return `data:${(blob as unknown as { type?: string }).type ?? 'unknown'};base64,${b64}`;
}

/** Mask every case-insensitive occurrence of the target word in a sentence. */
export function maskSentence(sentence: string, targetWord: string): string {
  const re = new RegExp(escapeRegExp(targetWord), 'gi');
  return sentence.replace(re, (match) => '░'.repeat(match.length));
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

    if (value.kind === 'audio') {
      const cached = audioCache.get(audioAssetId(note.id, fieldId, value.source));
      if (cached) {
        const blob = new Blob([cached.bytes], { type: cached.mimeType });
        const url = blobUrl(blob);
        payload[fieldId] = { kind: 'audio', value: url, source: value.source } as SrsFieldValue;
      } else if (isDataUrl(value.value)) {
        payload[fieldId] = value;
      } else {
        return null;
      }
    } else if (value.kind === 'image') {
      const cached = imageCache.get(imageAssetId(note.id, fieldId));
      if (cached) {
        const blob = new Blob([cached.bytes], { type: cached.mimeType });
        const url = blobUrl(blob);
        payload[fieldId] = { kind: 'image', value: url } as SrsFieldValue;
      } else if (isDataUrl(value.value)) {
        payload[fieldId] = value;
      } else {
        return null;
      }
    } else if (template.maskTarget && template.maskFieldId === fieldId && value.kind === 'text') {
      payload[fieldId] = { kind: 'text', value: maskSentence(value.value, note.targetWord) };
    } else {
      payload[fieldId] = value;
    }
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
