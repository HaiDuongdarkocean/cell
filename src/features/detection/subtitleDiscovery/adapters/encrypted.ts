// Encrypted-listing subtitle adapter (moviepire/videasy + peachify).
//
// The videasy `sources-with-title` endpoint returns a custom XOR/PRNG-encrypted
// payload. The content-script fetch bridge captures the response body; this
// adapter extracts the `seed` and `tmdbId` from the URL, decrypts the payload,
// and emits one candidate per subtitle entry.
//
// The peachify (eat-peach.sbs) endpoint returns AES-GCM encrypted JSON with
// `{ isEncrypted: true, data: "iv.ciphertext.authTag" }`. A separate decoder
// handles that format.

import { createCandidate } from '../candidate';
import { formatFromUrl, resolveLanguage } from '../candidate';
import type { SubtitleFormat } from '@/entities/subtitle/types';
import { decryptVideasyResponse } from './videasyDecoder';
import { decryptPeachifyResponse } from './peachifyDecoder';
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
  readonly decryptor?: 'videasy' | 'peachify';
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

      const decryptor = profile.decryptor ?? 'videasy';

      if (decryptor === 'peachify') {
        return decryptPeachify(signal, context, profile, body);
      }

      return decryptVideasy(signal, context, profile, body);
    },
  };
}

async function decryptPeachify(
  signal: SubtitleSignal,
  context: SubtitleDiscoveryContext,
  profile: EncryptedProfile,
  body: string,
): Promise<readonly SubtitleCandidate[]> {
  if (signal.kind !== 'network-response') return [];
  const signalUrl = signal.url;
  let parsed: { isEncrypted?: boolean; data?: string; subtitles?: unknown[] };
  try {
    parsed = JSON.parse(body);
  } catch {
    return [];
  }

  // Non-encrypted responses have subtitles directly.
  if (!parsed.isEncrypted || !parsed.data) {
    if (!Array.isArray(parsed.subtitles)) return [];
    return mapPeachifySubtitles(parsed.subtitles, context, profile, signalUrl);
  }

  let listing;
  try {
    listing = await decryptPeachifyResponse(parsed.data);
  } catch {
    return [
      createCandidate(
        {
          label: 'Encrypted peachify listing',
          language: 'unknown',
          source: 'metadata',
          provider: profile.provider,
          status: 'unresolved',
          metadata: {
            provider: profile.provider,
            providerId: `enc:${signalUrl}`,
            language: 'unknown',
            label: 'Encrypted listing',
            extra: { url: signalUrl },
          },
        },
        context,
      ),
    ];
  }

  if (!Array.isArray(listing.subtitles)) return [];
  return mapPeachifySubtitles(listing.subtitles, context, profile, signalUrl);
}

function mapPeachifySubtitles(
  subtitles: readonly unknown[],
  context: SubtitleDiscoveryContext,
  profile: EncryptedProfile,
  baseUrl: string,
): SubtitleCandidate[] {
  const candidates: SubtitleCandidate[] = [];
  for (const entry of subtitles) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const url = (e.url as string) || (e.file as string) || (e.src as string);
    if (!url || typeof url !== 'string') continue;
    const label = (e.label as string) || (e.name as string) || (e.language as string) || 'Auto';
    const code = (e.langCode as string) || (e.lang as string) || (e.language as string);
    const lang = resolveLanguage(code ?? label);
    const format = formatFromUrl(url) ?? 'vtt';
    candidates.push(
      createCandidate(
        {
          label,
          language: lang,
          url,
          source: 'direct',
          baseUrl,
          provider: profile.provider,
          format,
          default: false,
          forced: false,
        },
        context,
      ),
    );
  }
  return candidates;
}

async function decryptVideasy(
  signal: SubtitleSignal,
  context: SubtitleDiscoveryContext,
  profile: EncryptedProfile,
  body: string,
): Promise<readonly SubtitleCandidate[]> {
  if (signal.kind !== 'network-response') return [];
  const signalUrl = signal.url;
  const tmdbId = getTmdbIdFromUrl(signalUrl);
  const seed = getSeedFromUrl(signalUrl);
  if (!tmdbId || !seed) return [];

  let listing;
  try {
    listing = decryptVideasyResponse(body, seed, tmdbId);
  } catch {
    // Preserve as an unresolved handle so the user/panel can see the attempt.
    const provider = getProviderFromUrl(signalUrl) ?? profile.provider;
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
            providerId: `enc:${signalUrl}`,
            language: 'unknown',
            label: 'Encrypted listing',
            extra: { url: signalUrl },
          },
        },
        context,
      ),
    ];
  }

  const baseUrl = signalUrl;
  const provider = getProviderFromUrl(signalUrl) ?? profile.provider;
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
}
