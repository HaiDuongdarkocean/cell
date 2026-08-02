// Deep player-state subtitle-list adapter (noxx `window.the_subtitles`).
//
// The deep player frame exposes an allow-listed global array of `[label]/path`
// strings. The adapter reads only that field, resolves each path against the
// owning frame origin, and produces direct VTT candidates.

import { createCandidate, formatFromUrl, languageFromPath } from '../candidate';
import type {
  SubtitleCandidate,
  SubtitleDiscoveryAdapter,
  SubtitleDiscoveryContext,
  SubtitleDiscoveryEnvironment,
  SubtitleSignal,
} from '../types';

export interface PlayerStateProfile {
  readonly id: string;
  readonly priority: number;
  readonly originPattern: RegExp;
  readonly playerKey: string;
  readonly provider: string;
  readonly basePath?: string;
}

const THE_SUBTITLES_PATTERN = /^\[([^\]]+)\](.+)$/;

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function createPlayerStateAdapter(profile: PlayerStateProfile): SubtitleDiscoveryAdapter {
  return {
    id: profile.id,
    priority: profile.priority,
    match(signal: SubtitleSignal): boolean {
      if (signal.kind !== 'player-state') return false;
      return (
        profile.originPattern.test(signal.origin) &&
        signal.playerKey === profile.playerKey
      );
    },

    async discover(
      signal: SubtitleSignal,
      context: SubtitleDiscoveryContext,
      _env: SubtitleDiscoveryEnvironment,
    ): Promise<readonly SubtitleCandidate[]> {
      if (signal.kind !== 'player-state') return [];

      const payload = signal.payload;
      if (!Array.isArray(payload) || !payload.every(isString)) {
        return [createCandidate({ label: 'rejected', status: 'rejected', rejectReason: 'the_subtitles is not a string array' }, context)];
      }

      const base = context.frameUrl ?? context.origin;
      if (!base) {
        return [createCandidate({ label: 'rejected', status: 'rejected', rejectReason: 'missing frame origin for relative path resolution' }, context)];
      }

      return payload
        .map((entry, index) => {
          const match = THE_SUBTITLES_PATTERN.exec(entry);
          if (!match) return null;
          const label = match[1].trim();
          const relativePath = match[2].trim();
          if (!relativePath) return null;

          let url: string;
          try {
            url = new URL(relativePath, base).href;
          } catch {
            return null;
          }

          return createCandidate(
            {
              label,
              language: languageFromPath(relativePath) === 'unknown' ? languageFromPath(url) : languageFromPath(relativePath),
              url,
              source: 'direct',
              baseUrl: base,
              provider: profile.provider,
              format: formatFromUrl(url) ?? 'vtt',
              default: index === 0,
            },
            context,
          );
        })
        .filter((c): c is SubtitleCandidate => c !== null);
    },
  };
}
