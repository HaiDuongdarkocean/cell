import { type ViewportWidth, VIEWPORT_PRESETS } from './ViewportFrame';

/**
 * Central URL parameter parser for the design-system showcase.
 *
 * Provides the `data` edge-case state (`full` | `empty` | `overflow`) and the
 * `viewport` dimension state that every mock fixture and preview frame should
 * read. Parsing happens once at module load so module-level fixtures (cue lists,
 * lookup results, etc.) can be computed before React renders.
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
export function withDataParam(search: string, value = SHOWCASE_DATA): string {
  const params = new URLSearchParams(search);
  params.set('data', value);
  return `?${params.toString()}`;
}

const VALID_VIEWPORT_VALUES: ViewportWidth[] = [
  'full', 320, 360, 375, 390, 430, 600, 768, 840, 1024, 1200, 1280, 1920,
];

function parseViewportParam(): ViewportWidth {
  if (typeof window === 'undefined') return 'full';
  const value = new URLSearchParams(window.location.search).get('viewport');
  if (value === 'full') return 'full';
  if (value) {
    const num = Number(value);
    if (!Number.isNaN(num) && (VALID_VIEWPORT_VALUES as number[]).includes(num)) {
      return num as ViewportWidth;
    }
  }
  return 'full';
}

/**
 * Active viewport state for this showcase session.
 * Showcase pages and the preview frame should default to this value;
 * callers can also pass an explicit viewport when building URLs.
 */
export const SHOWCASE_VIEWPORT: ViewportWidth = parseViewportParam();

/** Height (px) that pairs with the current viewport, if one is defined. */
export function getViewportHeight(viewport: ViewportWidth = SHOWCASE_VIEWPORT): number | undefined {
  if (viewport === 'full') return undefined;
  const preset = VIEWPORT_PRESETS.find((p) => p.value === viewport);
  return preset?.height;
}

/** Append the viewport parameter to an existing URL search string. */
export function withViewportParam(search: string, value = SHOWCASE_VIEWPORT): string {
  const params = new URLSearchParams(search);
  params.set('viewport', String(value));
  return `?${params.toString()}`;
}
