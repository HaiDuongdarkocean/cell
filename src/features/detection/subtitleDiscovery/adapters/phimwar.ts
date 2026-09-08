import { createCandidate, resolveLanguage } from '../candidate';
import type {
  SubtitleCandidate,
  SubtitleDiscoveryAdapter,
  SubtitleDiscoveryContext,
  SubtitleDiscoveryEnvironment,
  SubtitleSignal,
} from '../types';

export const PHIMWAR_LISTING_PATTERN = /phimwar\.com\/_app\/remote\/[^/]+\/getSubtitles\?payload=/i;

export interface PhimwarSubtitleEntry {
  readonly id: number;
  readonly subsceneId: number;
  readonly language: string;
  readonly fileName: string;
  readonly isDefault: boolean;
  readonly rand?: number | string | null;
}

function isDescriptor(obj: unknown): obj is Record<string, number> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    !Array.isArray(obj) &&
    Object.values(obj).every((v) => typeof v === 'number')
  );
}

function resolveValue(
  value: unknown,
  arr: unknown[],
  seen: Set<number>,
): unknown {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value >= arr.length
  ) {
    return value;
  }
  if (seen.has(value)) {
    return null;
  }
  const item = arr[value];
  if (isDescriptor(item)) {
    seen.add(value);
    const resolved = resolveDescriptor(item, arr, seen);
    seen.delete(value);
    return resolved;
  }
  return item;
}

function resolveDescriptor(
  descriptor: Record<string, number>,
  arr: unknown[],
  seen: Set<number>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(descriptor)) {
    resolved[key] = resolveValue(value, arr, seen);
  }
  return resolved;
}

/**
 * Parse a PhimWar `getSubtitles` SvelteKit-deferred response.
 *
 * The outer JSON has `{ type: 'result', data: '<stringified-array>' }`.
 * The inner array uses numeric back-references: objects hold numeric indices
 * that point at the real values in the same array.
 */
export function parsePhimwarGetSubtitles(
  body: string,
): PhimwarSubtitleEntry[] | null {
  try {
    const outer = JSON.parse(body) as { type?: unknown; data?: unknown };
    if (outer.type === 'redirect') {
      return null;
    }
    const raw = outer.data;
    if (typeof raw !== 'string') {
      return null;
    }
    const arr: unknown[] = JSON.parse(raw);
    if (!Array.isArray(arr)) {
      return null;
    }

    const entries: PhimwarSubtitleEntry[] = [];
    for (const item of arr) {
      if (!isDescriptor(item)) continue;
      if (
        typeof item.subsceneId !== 'number' ||
        typeof item.fileName !== 'number'
      ) {
        continue;
      }

      const resolved = resolveDescriptor(item, arr, new Set<number>());
      const id = typeof resolved.id === 'number' ? resolved.id : 0;
      const subsceneId =
        typeof resolved.subsceneId === 'number' ? resolved.subsceneId : 0;
      const language =
        typeof resolved.language === 'string' ? resolved.language : 'unknown';
      const fileName =
        typeof resolved.fileName === 'string' ? resolved.fileName : '';
      const isDefault =
        typeof resolved.isDefault === 'boolean' ? resolved.isDefault : false;
      const rand = resolved.rand as number | string | null | undefined;

      if (!fileName) continue;
      entries.push({ id, subsceneId, language, fileName, isDefault, rand });
    }
    return entries;
  } catch {
    return null;
  }
}

function buildPhimwarSubtitleUrl(
  signalUrl: string,
  entry: PhimwarSubtitleEntry,
): string {
  const base = (() => {
    try {
      return new URL(signalUrl).origin;
    } catch {
      return 'https://phimwar.com';
    }
  })();
  const subsceneId = `${entry.subsceneId}${
    entry.rand ? `~${entry.rand}` : ''
  }`;
  return `${base}/api/subtitle/${subsceneId}/${entry.fileName}`;
}

function phimwarDisplayName(code: string): string {
  if (code === 'vi') return 'Vietnamese';
  if (code === 'en') return 'English';
  return code;
}

export function createPhimwarAdapter(): SubtitleDiscoveryAdapter {
  return {
    id: 'phimwar-listing',
    priority: 10,

    match(signal: SubtitleSignal): boolean {
      if (signal.kind !== 'network-response') return false;
      if (signal.body.length === 0) return false;
      return PHIMWAR_LISTING_PATTERN.test(signal.url);
    },

    async discover(
      signal: SubtitleSignal,
      context: SubtitleDiscoveryContext,
      _env: SubtitleDiscoveryEnvironment,
    ): Promise<readonly SubtitleCandidate[]> {
      if (signal.kind !== 'network-response') return [];

      const entries = parsePhimwarGetSubtitles(signal.body);
      if (!entries || entries.length === 0) return [];

      const candidates: SubtitleCandidate[] = [];
      for (const entry of entries) {
        const language = resolveLanguage(entry.language);
        candidates.push(
          createCandidate(
            {
              label: phimwarDisplayName(entry.language),
              language,
              format: 'srt',
              url: buildPhimwarSubtitleUrl(signal.url, entry),
              source: 'direct',
              provider: 'phimwar',
              default: entry.isDefault,
              forced: false,
            },
            context,
          ),
        );
      }
      return candidates;
    },
  };
}
