import { createCandidate, resolveLanguage } from '../candidate';
import { ISO_LANGUAGE_MAP } from '@/shared/config/languageRegistry';
import type {
  SubtitleCandidate,
  SubtitleDiscoveryAdapter,
  SubtitleDiscoveryContext,
  SubtitleDiscoveryEnvironment,
  SubtitleSignal,
} from '../types';

/**
 * SvelteKit remote module endpoint used by PhimWar and similar sites for
 * per-episode subtitle listings. The payload is a base64-encoded array,
 * and the response is a JSON wrapper around a SvelteKit-deferred string.
 */
export const SVELTEKIT_GETSUBTITLES_PATTERN = /\/_app\/remote\/[^/]+\/getSubtitles\?payload=/i;

export interface SvelteKitSubtitleEntry {
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
 * Parse a SvelteKit-deferred `getSubtitles` response.
 *
 * The outer JSON has `{ type: 'result', data: '<stringified-array>' }`.
 * The inner array uses numeric back-references: objects hold numeric indices
 * that point at the real values in the same array.
 */
export function parseSvelteKitSubtitles(
  body: string,
): SvelteKitSubtitleEntry[] | null {
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

    const entries: SvelteKitSubtitleEntry[] = [];
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

function buildSvelteKitSubtitleUrl(
  signalUrl: string,
  context: SubtitleDiscoveryContext,
  entry: SvelteKitSubtitleEntry,
): string {
  const baseOrigin = (() => {
    try {
      return new URL(signalUrl, context.origin).origin;
    } catch {
      try {
        return new URL(context.origin).origin;
      } catch {
        return '';
      }
    }
  })();
  if (!baseOrigin) {
    // Without a base we cannot build a usable URL.
    return signalUrl;
  }
  const subsceneId = `${entry.subsceneId}${
    entry.rand ? `~${entry.rand}` : ''
  }`;
  return `${baseOrigin}/api/subtitle/${subsceneId}/${entry.fileName}`;
}

function svelteKitDisplayName(code: string): string {
  return ISO_LANGUAGE_MAP.get(code.toLowerCase()) ?? code;
}

export function createSvelteKitSubtitlesAdapter(): SubtitleDiscoveryAdapter {
  return {
    id: 'sveltekit-getsubtitles',
    priority: 10,

    match(signal: SubtitleSignal): boolean {
      if (signal.kind !== 'network-response') return false;
      if (signal.body.length === 0) return false;
      return SVELTEKIT_GETSUBTITLES_PATTERN.test(signal.url);
    },

    async discover(
      signal: SubtitleSignal,
      context: SubtitleDiscoveryContext,
      _env: SubtitleDiscoveryEnvironment,
    ): Promise<readonly SubtitleCandidate[]> {
      if (signal.kind !== 'network-response') return [];

      const entries = parseSvelteKitSubtitles(signal.body);
      if (!entries || entries.length === 0) return [];

      const candidates: SubtitleCandidate[] = [];
      for (const entry of entries) {
        const language = resolveLanguage(entry.language);
        candidates.push(
          createCandidate(
            {
              label: svelteKitDisplayName(entry.language),
              language,
              format: 'srt',
              url: buildSvelteKitSubtitleUrl(signal.url, context, entry),
              source: 'direct',
              provider: 'sveltekit-getsubtitles',
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
