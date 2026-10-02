import type { SrsVariant, SrsVariantPreset } from '@/entities/srs/types';
import { generateId } from '@/features/srs/lib/helpers';

/** Builtin variants ship with empty `name` — the UI renders the i18n default until the user renames. */
export function createDefaultVariants(): SrsVariant[] {
  return [
    { id: 'sound', name: '', icon: 'volumeHigh', builtin: 'sound', fieldIds: ['target', 'sentence'], newLoops: 1, order: 0 },
    { id: 'meaning', name: '', icon: 'image', builtin: 'meaning', fieldIds: ['image'], newLoops: 1, order: 1 },
    { id: 'spelling', name: '', icon: 'pencil', builtin: 'spelling', fieldIds: ['wordAudio', 'sentAudio', 'input'], newLoops: 1, order: 2 },
  ];
}

export function createDefaultVariantPreset(collectionId: string): SrsVariantPreset {
  return {
    id: `vpreset-default-${collectionId}`,
    collectionId,
    name: 'Default',
    variants: createDefaultVariants(),
    isDefault: true,
    createdAt: Date.now(),
  };
}

/** Restore the three builtins into a preset, keeping custom variants untouched. */
export function withResetBuiltinVariants(preset: SrsVariantPreset): SrsVariantPreset {
  const customs = preset.variants.filter((v) => !v.builtin);
  return { ...preset, variants: [...createDefaultVariants(), ...customs.map((v, i) => ({ ...v, order: 3 + i }))] };
}

export function createCustomVariant(order: number): SrsVariant {
  return { id: `variant-${generateId()}`, name: '', icon: 'layers', fieldIds: ['target'], newLoops: 1, order };
}
