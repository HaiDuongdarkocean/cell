/**
 * Phoneme audio packs — pluggable human-recorded IPA chip audio.
 *
 * A pack maps IPA symbols to audio slots per accent: `d` is the shared
 * default used when the two accents sound the same; `br`/`us` hold
 * accent-specific recordings only where the realization actually differs.
 * This keeps the pack deduplicated by design.
 *
 * Built-in pack ships as static assets under `pronunciation/phonemes/`
 * (filenames in `files`). Custom packs users import store base64 audio
 * inline in the same `files` shape — one self-contained JSON is a plugin.
 */

export type PhonemeAccent = 'br' | 'us';

export interface PhonemeFileSlots {
  readonly d?: string;
  readonly br?: string;
  readonly us?: string;
}

export interface PhonemePack {
  readonly name: string;
  readonly license?: string;
  readonly version?: number;
  readonly files: Readonly<Record<string, PhonemeFileSlots>>;
}

export interface PhonemePackMeta {
  readonly id: string;
  readonly name: string;
  readonly license?: string;
  readonly symbolCount: number;
  readonly addedAt: number;
}

/** Normalizes a free-text accent label ('AmE', 'US', 'BrE', 'RP'…)
 *  to the pack accent key. Unknown labels return null → shared default. */
export function normalizeAccent(label: string | undefined): PhonemeAccent | null {
  if (!label) return null;
  const l = label.toLowerCase();
  if (/(^|\b)(us|ame|american|ga|general american)(\b|$)/.test(l)) return 'us';
  if (/(^|\b)(br|bre|uk|gb|british|rp|received)(\b|$)/.test(l)) return 'br';
  return null;
}

/** Pick the right slot for an accent: explicit accent slot → shared default. */
export function resolvePhonemeFile(
  files: Readonly<Record<string, PhonemeFileSlots>>,
  ipa: string,
  accent: PhonemeAccent | null,
): string | null {
  const slots = files[ipa];
  if (!slots) return null;
  return (accent ? slots[accent] : undefined) ?? slots.d ?? null;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const SLOTS: readonly ('d' | 'br' | 'us')[] = ['d', 'br', 'us'];

/** Validate + normalize an imported pack JSON. Throws with a reason string. */
export function parsePhonemePack(raw: unknown): PhonemePack {
  if (!isRecord(raw)) throw new Error('Pack must be a JSON object');
  if (typeof raw.name !== 'string' || !raw.name.trim()) throw new Error('Pack needs a non-empty "name"');
  if (!isRecord(raw.files) || Object.keys(raw.files).length === 0) {
    throw new Error('Pack needs a non-empty "files" map');
  }
  const files: Record<string, PhonemeFileSlots> = {};
  for (const [ipa, slots] of Object.entries(raw.files)) {
    if (!isRecord(slots)) throw new Error(`"${ipa}": slots must be an object`);
    const out: Record<string, string> = {};
    for (const k of SLOTS) {
      const v = slots[k];
      if (v !== undefined && typeof v !== 'string') throw new Error(`"${ipa}.${k}" must be a string`);
      if (typeof v === 'string') out[k] = v;
    }
    if (!out.d && !out.br && !out.us) throw new Error(`"${ipa}": needs at least one of d/br/us`);
    files[ipa] = out;
  }
  return {
    name: raw.name.trim(),
    license: typeof raw.license === 'string' ? raw.license : undefined,
    version: typeof raw.version === 'number' ? raw.version : undefined,
    files,
  };
}
