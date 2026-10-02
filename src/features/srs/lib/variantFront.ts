import type { ResolvedVariantToggles, SrsNote, SrsVariant, SrsVariantToggles } from '@/entities/srs/types';
import { SRS_INPUT_FIELD_ID } from '@/entities/srs/types';
import { mediaFieldValues } from '@/features/srs/lib/helpers';

export type { ResolvedVariantToggles };

export type VariantFieldKind = 'target' | 'text' | 'list' | 'image' | 'audio' | 'input';

export function variantFieldKind(fieldId: string, notetype?: { readonly fields: readonly { id: string; type: string }[] }): VariantFieldKind {
  if (fieldId === SRS_INPUT_FIELD_ID) return 'input';
  if (fieldId === 'target') return 'target';
  const type = notetype?.fields.find((f) => f.id === fieldId)?.type;
  if (type === 'audio') return 'audio';
  if (type === 'image') return 'image';
  if (type === 'list') return 'list';
  return 'text';
}

/** Field-level material check — no I/O, field record presence only. */
export function hasVariantMaterial(fieldId: string, note: SrsNote): boolean {
  if (fieldId === 'target') return note.targetWord.trim().length > 0;
  if (fieldId === SRS_INPUT_FIELD_ID) return true;
  const value = note.fields[fieldId];
  if (!value) return false;
  switch (value.kind) {
    case 'audio':
    case 'image':
      return mediaFieldValues(value).length > 0;
    case 'list':
      return value.value.length > 0;
    default:
      return value.value.trim().length > 0;
  }
}

function hasAudioMaterial(fieldId: string, note: SrsNote, notetype?: { readonly fields: readonly { id: string; type: string }[] }): boolean {
  return variantFieldKind(fieldId, notetype) === 'audio' && hasVariantMaterial(fieldId, note);
}

/** A variant is servable on a note when its front can render real material. Dictation additionally requires audio to listen to. */
export function isVariantServable(
  variant: SrsVariant,
  note: SrsNote,
  notetype?: { readonly fields: readonly { id: string; type: string }[] },
): boolean {
  const renderable = variant.fieldIds.some(
    (f) => f !== SRS_INPUT_FIELD_ID && hasVariantMaterial(f, note),
  );
  if (!renderable) return false;
  if (!variant.fieldIds.includes(SRS_INPUT_FIELD_ID)) return true;
  return variant.fieldIds.some((f) => hasAudioMaterial(f, note, notetype));
}

export function servableVariantIds(
  variants: readonly SrsVariant[],
  note: SrsNote,
  notetype?: { readonly fields: readonly { id: string; type: string }[] },
): ReadonlySet<string> {
  return new Set(variants.filter((v) => isVariantServable(v, note, notetype)).map((v) => v.id));
}

export function variantHasScopeToggle(variant: SrsVariant, note: SrsNote): boolean {
  return (
    variant.fieldIds.includes('target') &&
    variant.fieldIds.includes('sentence') &&
    hasVariantMaterial('target', note) &&
    hasVariantMaterial('sentence', note)
  );
}

export function variantHasAudioToggle(variant: SrsVariant, note: SrsNote): boolean {
  return (
    variant.fieldIds.includes('wordAudio') &&
    variant.fieldIds.includes('sentAudio') &&
    hasVariantMaterial('wordAudio', note) &&
    hasVariantMaterial('sentAudio', note)
  );
}

/** Resolve effective toggles: derive availability from fieldIds + material, apply persisted pref when its option is still offered. */
export function resolveVariantToggles(
  variant: SrsVariant,
  note: SrsNote,
  pref?: SrsVariantToggles,
): ResolvedVariantToggles {
  const scopeToggle = variantHasScopeToggle(variant, note);
  const audioToggle = variantHasAudioToggle(variant, note);

  let scope: 'both' | 'word' | 'sentence' = 'both';
  if (!scopeToggle) {
    if (variant.fieldIds.includes('target') && hasVariantMaterial('target', note) && !hasVariantMaterial('sentence', note)) scope = 'word';
    else if (variant.fieldIds.includes('sentence') && hasVariantMaterial('sentence', note) && !hasVariantMaterial('target', note)) scope = 'sentence';
  } else if (pref?.scope && pref.scope !== 'both') {
    scope = pref.scope;
  }

  let audio: 'word' | 'sentence' = 'word';
  const hasWA = variant.fieldIds.includes('wordAudio') && hasVariantMaterial('wordAudio', note);
  const hasSA = variant.fieldIds.includes('sentAudio') && hasVariantMaterial('sentAudio', note);
  if (hasWA && !hasSA) audio = 'word';
  else if (hasSA && !hasWA) audio = 'sentence';
  else if (audioToggle && pref?.audio) audio = pref.audio;

  return { scope, audio, scopeToggle, audioToggle };
}

/** Ordered field ids to render on the front after material + toggle filtering. */
export function visibleVariantFields(
  variant: SrsVariant,
  note: SrsNote,
  toggles: ResolvedVariantToggles,
): readonly string[] {
  return variant.fieldIds.filter((fid) => {
    if (fid === SRS_INPUT_FIELD_ID) return true;
    if (!hasVariantMaterial(fid, note)) return false;
    if (fid === 'target') return toggles.scope !== 'sentence';
    if (fid === 'sentence') return toggles.scope !== 'word';
    if (fid === 'wordAudio') return !toggles.audioToggle || toggles.audio === 'word';
    if (fid === 'sentAudio') return !toggles.audioToggle || toggles.audio === 'sentence';
    return true;
  });
}

/** Field the dictation input expects. Null when the variant has no input or no audio material. */
export function expectedInputField(
  variant: SrsVariant,
  note: SrsNote,
  toggles: ResolvedVariantToggles,
): 'target' | 'sentence' | null {
  if (!variant.fieldIds.includes(SRS_INPUT_FIELD_ID)) return null;
  const hasWA = variant.fieldIds.includes('wordAudio') && hasVariantMaterial('wordAudio', note);
  const hasSA = variant.fieldIds.includes('sentAudio') && hasVariantMaterial('sentAudio', note);
  if (!hasWA && !hasSA) return null;
  if (!hasWA) return 'sentence';
  if (!hasSA) return 'target';
  return toggles.audio === 'word' ? 'target' : 'sentence';
}

/** Resolve the expected dictation answer text. */
export function expectedInputText(
  variant: SrsVariant,
  note: SrsNote,
  toggles: ResolvedVariantToggles,
): string | null {
  const field = expectedInputField(variant, note, toggles);
  if (field === 'target') return note.targetWord;
  if (field === 'sentence') {
    const v = note.fields.sentence;
    return v && (v.kind === 'text' || v.kind === 'context' || v.kind === 'translation') ? v.value : null;
  }
  return null;
}
