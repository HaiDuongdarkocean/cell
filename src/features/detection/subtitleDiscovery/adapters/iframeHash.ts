// Iframe-hash subtitle-list adapter (lunastream/moviesapi → flixcdn.cyou).
//
// The player passes a complete subtitle list as a URL-encoded JSON array in the
// child iframe's `src` hash. The parent (or the content script running in the
// parent) observes the `iframe.src` attribute without reading cross-origin DOM.

import { createCandidate, languageFromLabel, formatFromUrl } from '../candidate';
import type {
  SubtitleCandidate,
  SubtitleDiscoveryAdapter,
  SubtitleDiscoveryContext,
  SubtitleDiscoveryEnvironment,
  SubtitleSignal,
} from '../types';

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseHashParams(url: string): Map<string, string> {
  const map = new Map<string, string>();
  try {
    const hash = url.split('#')[1] ?? '';
    const parts = hash.split('&');
    for (const part of parts) {
      const eq = part.indexOf('=');
      if (eq > 0) {
        map.set(part.slice(0, eq), safeDecode(part.slice(eq + 1)));
      }
    }
  } catch {
    // ignore malformed hash
  }
  return map;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface IframeHashProfile {
  readonly id: string;
  readonly priority: number;
  readonly urlPattern: RegExp;
  readonly hashKey: string;
  readonly origin: string;
  readonly provider: string;
}

export function createIframeHashAdapter(profile: IframeHashProfile): SubtitleDiscoveryAdapter {
  return {
    id: profile.id,
    priority: profile.priority,
    match(signal: SubtitleSignal): boolean {
      if (signal.kind !== 'frame-source') return false;
      if (!profile.urlPattern.test(signal.frameUrl)) return false;
      const params = parseHashParams(signal.frameUrl);
      return params.has(profile.hashKey);
    },

    async discover(
      signal: SubtitleSignal,
      context: SubtitleDiscoveryContext,
      _env: SubtitleDiscoveryEnvironment,
    ): Promise<readonly SubtitleCandidate[]> {
      if (signal.kind !== 'frame-source') return [];

      const params = parseHashParams(signal.frameUrl);
      const raw = params.get(profile.hashKey);
      if (!raw) return [];

      let list: unknown[];
      try {
        const parsed = JSON.parse(raw) as unknown;
        list = Array.isArray(parsed) ? parsed : [];
      } catch {
        return [createCandidate({ label: 'rejected', status: 'rejected', rejectReason: 'malformed iframe hash JSON' }, context)];
      }

      const candidates: SubtitleCandidate[] = [];
      for (let i = 0; i < list.length; i++) {
        const entry = list[i];
        if (!isRecord(entry)) continue;
        const label = typeof entry.label === 'string' ? entry.label : `Track ${i + 1}`;
        const url = typeof entry.url === 'string' ? entry.url : undefined;
        if (!url) continue;
        const language = typeof entry.language === 'string' && entry.language !== 'unknown'
          ? entry.language
          : languageFromLabel(label);

        candidates.push(
          createCandidate(
            {
              label,
              language,
              url,
              source: 'direct',
              provider: profile.provider,
              format: formatFromUrl(url) ?? 'unknown',
              default: entry.default === true,
            },
            context,
          ),
        );
      }

      return candidates;
    },
  };
}
