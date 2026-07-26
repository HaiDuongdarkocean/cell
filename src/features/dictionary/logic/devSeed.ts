// autoSeed — auto-import of default dictionary + frequency data.
//
// When DB is empty (fresh install, DB wiped, or never imported), fetches the
// Cambridge dictionary + standard frequency list from the extension bundle
// (dist/seed/) and imports both in parallel via importFile(). Fire-and-forget
// — never blocks UI or main thread. Files are copied into dist/seed/ by the
// autoSeedAssets Vite plugin (every build, including production).

import { importFile } from './importOrchestrator';
import { countResources } from '../repositories/resourceRepository';
import type { ReadableFile } from './fileDetector';
import type { ResourceType } from '@/entities/dictionary';

/** Seed file definitions — fetched from extension bundle + imported in parallel. */
const SEED_FILES: ReadonlyArray<{
  readonly path: string;
  readonly resourceType: ResourceType;
}> = [
  { path: 'seed/en/dictionary/CambridgeV1_0_20260121_1628_20260325_1617.json', resourceType: 'DICTIONARY' },
  { path: 'seed/en/frequency_list/standard.json', resourceType: 'FREQUENCY' },
] as const;

/** In-memory lock — prevents concurrent seed runs (e.g. onInstalled + Options mount). */
let seeding = false;

/** Wrap an ArrayBuffer as a ReadableFile for importFile(). */
function wrapBuffer(data: ArrayBuffer, name: string): ReadableFile {
  const bytes = new Uint8Array(data);
  return {
    name,
    size: bytes.length,
    slice: (start: number, end: number) => ({
      arrayBuffer: () => Promise.resolve(bytes.slice(start, end).buffer as ArrayBuffer),
    }),
  };
}

/** Extract filename from a URL path. */
function fileNameFromPath(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] ?? path;
}

/** Build extension-internal URL for a seed file (chrome-extension://<id>/seed/...). */
function seedUrl(path: string): string {
  // chrome.runtime.getURL returns chrome-extension://<id>/<path>
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(path);
  }
  // Fallback for non-extension contexts (should not happen in prod)
  return `/${path}`;
}

/**
 * Auto-seed: if DB is empty, fetch + import seed files in parallel.
 * Fire-and-forget — returns immediately, logs errors to console.
 * Safe to call from background SW onInstalled or Options page mount.
 * Callers should gate this with `isDevMode`; production builds do not ship the
 * test seed files, so the fetch would fail harmlessly but log a warning.
 */
export async function seedDevDataIfEmpty(langCode = 'en'): Promise<void> {
  // Prevent concurrent seed runs.
  if (seeding) return;
  seeding = true;

  try {
    const count = await countResources(langCode);
    if (count > 0) return; // DB already has data — skip.

    // Fetch all seed files in parallel from extension bundle, then import in parallel.
    const fetches = SEED_FILES.map(async (seed) => {
      const res = await fetch(seedUrl(seed.path));
      if (!res.ok) throw new Error(`Seed fetch failed: ${seed.path} → ${res.status}`);
      const buffer = await res.arrayBuffer();
      return { buffer, name: fileNameFromPath(seed.path), resourceType: seed.resourceType };
    });
    const files = await Promise.all(fetches);

    // Import all in parallel — importFile is concurrency-safe (auto-increment resourceId).
    const imports = files.map((f) => importFile(wrapBuffer(f.buffer, f.name), f.resourceType, { langCode }));
    const results = await Promise.all(imports);
    console.info(`[autoSeed] Imported ${results.length} seed resources for "${langCode}".`, results);
  } catch (err) {
    console.warn('[autoSeed] Auto-seed failed (non-fatal):', err);
  } finally {
    seeding = false;
  }
}
