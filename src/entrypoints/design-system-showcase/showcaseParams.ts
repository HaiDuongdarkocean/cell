/**
 * Central URL parameter parser for the design-system showcase.
 *
 * Provides the `data` edge-case state (`full` | `empty` | `overflow`) that
 * every mock fixture and store seed should read. Parsing happens once at
 * module load so module-level fixtures (cue lists, lookup results, etc.)
 * can be computed before React renders.
 */

export type DataVariant = 'full' | 'empty' | 'overflow';

const VALID_DATA_VARIANTS: DataVariant[] = ['full', 'empty', 'overflow'];

function parseDataParam(): DataVariant {
  if (typeof window === 'undefined') return 'full';
  const value = new URLSearchParams(window.location.search).get('data');
  if (value && (VALID_DATA_VARIANTS as readonly string[]).includes(value)) {
    return value as DataVariant;
  }
  return 'full';
}

/**
 * Active data state for this showcase session. Fixtures and store seeds should
 * default to this value; callers can also pass an explicit variant when
 * building URLs or testing.
 */
export const SHOWCASE_DATA: DataVariant = parseDataParam();

/** Append the data parameter to an existing URL search string. */
export function withDataParam(search: string): string {
  const params = new URLSearchParams(search);
  params.set('data', SHOWCASE_DATA);
  return `?${params.toString()}`;
}
