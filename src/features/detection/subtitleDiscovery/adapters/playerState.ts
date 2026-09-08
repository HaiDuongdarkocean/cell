// Deep player-state subtitle-list adapter (noxx `window.the_subtitles`,
// vidrift `window.subtitleTracks`).
//
// The deep player frame exposes an allow-listed global array of subtitle
// entries. Two shapes are supported:
//   - `[label]/path` strings (noxx)
//   - `{ code, label, url }` objects (vidrift)

import { createCandidate, formatFromUrl, languageFromLabel, languageFromPath, resolveLanguage } from '../candidate';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function mapStringArray(
  payload: readonly string[],
  base: string,
  profile: PlayerStateProfile,
  context: SubtitleDiscoveryContext,
): readonly SubtitleCandidate[] {
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
}

function mapObjectArray(
  payload: readonly Record<string, unknown>[],
  base: string,
  profile: PlayerStateProfile,
  context: SubtitleDiscoveryContext,
): readonly SubtitleCandidate[] {
  return payload
    .map((entry, index) => {
      const rawUrl = entry.url ?? entry.src ?? entry.file;
      const rawLabel = entry.label ?? entry.name ?? entry.language;
      const rawCode = entry.code ?? entry.lang ?? entry.language ?? entry.srclang;
      if (!isString(rawUrl) || !isString(rawLabel)) return null;

      let url: string;
      try {
        url = new URL(rawUrl, base).href;
      } catch {
        return null;
      }

      const fromCode = isString(rawCode) ? resolveLanguage(rawCode) : 'unknown';
      const language = fromCode !== 'unknown' ? fromCode : languageFromLabel(rawLabel);

      return createCandidate(
        {
          label: rawLabel,
          language,
          url,
          source: 'direct',
          baseUrl: base,
          provider: profile.provider,
          format: formatFromUrl(url) ?? 'vtt',
          default: entry.default === true || index === 0,
        },
        context,
      );
    })
    .filter((c): c is SubtitleCandidate => c !== null);
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
      if (!Array.isArray(payload) || payload.length === 0) {
        return [createCandidate({ label: 'rejected', status: 'rejected', rejectReason: 'player state is not a non-empty array' }, context)];
      }

      const base = context.frameUrl ?? context.origin;
      if (!base) {
        return [createCandidate({ label: 'rejected', status: 'rejected', rejectReason: 'missing frame origin for relative path resolution' }, context)];
      }

      if (payload.every(isString)) {
        return mapStringArray(payload as string[], base, profile, context);
      }

      if (payload.every(isRecord)) {
        return mapObjectArray(payload as Record<string, unknown>[], base, profile, context);
      }

      return [createCandidate({ label: 'rejected', status: 'rejected', rejectReason: 'player state array has unsupported item shape' }, context)];
    },
  };
}
