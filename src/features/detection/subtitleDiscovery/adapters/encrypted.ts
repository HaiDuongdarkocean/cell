// Encrypted-listing subtitle adapter (moviepire/videasy).
//
// The videasy `sources-with-title` endpoint returns a custom XOR/PRNG-encrypted
// payload. The content-script fetch bridge captures the response body; this
// adapter extracts the `seed` and `tmdbId` from the URL, decrypts the payload,
// and emits one candidate per subtitle entry.

import { createCandidate } from '../candidate';
import { formatFromUrl, resolveLanguage } from '../candidate';
import type { SubtitleFormat } from '@/entities/subtitle/types';
import { decryptVideasyResponse } from './videasyDecoder';
import type {
  SubtitleCandidate,
  SubtitleDiscoveryAdapter,
  SubtitleDiscoveryContext,
  SubtitleDiscoveryEnvironment,
  SubtitleSignal,
} from '../types';

export interface EncryptedProfile {
  readonly id: string;
  readonly priority: number;
  readonly urlPattern: RegExp;
  readonly provider: string;
}

function getTmdbIdFromUrl(url: string): number | undefined {
  try {
    const u = new URL(url);
    const raw = u.searchParams.get('tmdbId');
    if (!raw) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  } catch {
    return undefined;
  }
}

function getSeedFromUrl(url: string): string | undefined {
  try {
    return new URL(url).searchParams.get('seed') ?? undefined;
  } catch {
    return undefined;
  }
}

function getProviderFromUrl(url: string): string | undefined {
  try {
    const path = new URL(url).pathname;
    const match = path.match(/^\/([^/]+)\/sources-with-title/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

function getSubtitleFormat(subtitle: { readonly url: string }): SubtitleFormat | null {
  const url = subtitle.url;
  const direct = formatFromUrl(url);
  if (direct) return direct;

  // Some proxies carry the real subtitle URL in a `url` query parameter.
  try {
    const u = new URL(url);
    const proxied = u.searchParams.get('url');
    if (proxied) return formatFromUrl(proxied);
  } catch {
    // ignore
  }
  return null;
}

export function createEncryptedAdapter(profile: EncryptedProfile): SubtitleDiscoveryAdapter {
  return {
    id: profile.id,
    priority: profile.priority,
    match(signal: SubtitleSignal): boolean {
      // Only process captured network-response bodies. Empty bodies come from
      // webRequest-only paths where we cannot decrypt without the response text,
      // and re-fetching usually fails under Cloudflare.
      return (
        signal.kind === 'network-response' &&
        profile.urlPattern.test(signal.url) &&
        signal.body.length > 0
      );
    },

    async discover(
      signal: SubtitleSignal,
      context: SubtitleDiscoveryContext,
      _env: SubtitleDiscoveryEnvironment,
    ): Promise<readonly SubtitleCandidate[]> {
      if (signal.kind !== 'network-response') return [];

      const body = signal.body.trim();
      if (!body) return [];

      const tmdbId = getTmdbIdFromUrl(signal.url);
      const seed = getSeedFromUrl(signal.url);
      if (!tmdbId || !seed) return [];

      let listing;
      try {
        listing = decryptVideasyResponse(body, seed, tmdbId);
      } catch {
        // Preserve as an unresolved handle so the user/panel can see the attempt.
        const provider = getProviderFromUrl(signal.url) ?? profile.provider;
        return [
          createCandidate(
            {
              label: 'Encrypted videasy listing',
              language: 'unknown',
              source: 'metadata',
              provider,
              status: 'unresolved',
              metadata: {
                provider,
                providerId: `enc:${signal.url}`,
                language: 'unknown',
                label: 'Encrypted listing',
                extra: { url: signal.url },
              },
            },
            context,
          ),
        ];
      }

      const baseUrl = signal.url;
      const provider = getProviderFromUrl(signal.url) ?? profile.provider;
      const candidates: SubtitleCandidate[] = [];

      for (const sub of listing.subtitles) {
        const url = sub.url;
        if (!url) continue;

        const lang = resolveLanguage(sub.lang ?? sub.language ?? undefined);
        const format = getSubtitleFormat({ url });

        candidates.push(
          createCandidate(
            {
              label: lang === 'unknown' ? 'Subtitle' : sub.lang ?? sub.language ?? 'Subtitle',
              language: lang,
              url,
              source: 'direct',
              baseUrl,
              provider,
              format: format ?? 'srt',
              default: false,
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
