// HLS playlist subtitle-list adapter.
//
// Inspects master/media playlists for `#EXT-X-MEDIA:TYPE=SUBTITLES` entries and
// resolves relative subtitle segment/media URLs. Also acts as a fallback for
// direct VTT requests seen inside a playlist body.

import { createCandidate, formatFromUrl, languageFromPath } from '../candidate';
import type {
  SubtitleCandidate,
  SubtitleDiscoveryAdapter,
  SubtitleDiscoveryContext,
  SubtitleDiscoveryEnvironment,
  SubtitleSignal,
} from '../types';

const MEDIA_TAG = /#EXT-X-MEDIA:TYPE=SUBTITLES/i;

function parseHlsAttributes(line: string): Map<string, string> {
  const map = new Map<string, string>();
  const regex = /([A-Z0-9\-]+)=("([^"]*)"|([^,\s]+))/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(line)) !== null) {
    const value = m[3] ?? m[4] ?? '';
    map.set(m[1], value);
  }
  return map;
}

function parseVttUrls(body: string): string[] {
  const urls: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (/\.vtt(?:\?|$)/i.test(trimmed)) urls.push(trimmed);
  }
  return urls;
}

export interface HlsProfile {
  readonly id: string;
  readonly priority: number;
  readonly urlPattern: RegExp;
  readonly provider: string;
}

export function createHlsAdapter(profile: HlsProfile): SubtitleDiscoveryAdapter {
  return {
    id: profile.id,
    priority: profile.priority,
    match(signal: SubtitleSignal): boolean {
      const url = signal.kind === 'hls-playlist' ? signal.url : signal.kind === 'network-response' ? signal.url : '';
      return url ? profile.urlPattern.test(url) || /\.m3u8(?:\?|$)/i.test(url) : false;
    },

    async discover(
      signal: SubtitleSignal,
      context: SubtitleDiscoveryContext,
      env: SubtitleDiscoveryEnvironment,
    ): Promise<readonly SubtitleCandidate[]> {
      const baseUrl = signal.kind === 'hls-playlist' || signal.kind === 'network-response' ? signal.url : '';
      if (!baseUrl) return [];

      let body = signal.kind === 'hls-playlist' ? signal.body : '';
      if (signal.kind === 'network-response' && !body) {
        const result = await env.fetchText(baseUrl, {
          origin: context.origin,
          referer: context.initiator,
          initiator: context.initiator,
        });
        if (!result.ok) return [];
        body = result.content;
      }

      const candidates: SubtitleCandidate[] = [];


      // Master playlist: look for EXT-X-MEDIA subtitle tracks.
      for (const line of body.split(/\r?\n/)) {
        if (!MEDIA_TAG.test(line)) continue;
        const attrs = parseHlsAttributes(line);
        const uri = attrs.get('URI');
        if (!uri) continue;

        let url: string;
        try {
          url = new URL(uri, baseUrl).href;
        } catch {
          continue;
        }

        const label = attrs.get('NAME') || attrs.get('LANGUAGE') || 'Subtitle';
        const language = attrs.get('LANGUAGE')
          ? languageFromPath(attrs.get('LANGUAGE')!)
          : languageFromPath(uri);

        candidates.push(
          createCandidate(
            {
              label,
              language,
              url,
              source: 'direct',
              baseUrl,
              provider: profile.provider,
              format: formatFromUrl(url) ?? 'vtt',
              default: attrs.get('DEFAULT')?.toUpperCase() === 'YES',
              forced: attrs.get('FORCED')?.toUpperCase() === 'YES',
            },
            context,
          ),
        );
      }

      // Fallback: any VTT URL referenced as a standalone playlist line.
      for (const vtt of parseVttUrls(body)) {
        let url: string;
        try {
          url = new URL(vtt, baseUrl).href;
        } catch {
          continue;
        }
        const label = `Subtitle ${candidates.length + 1}`;
        candidates.push(
          createCandidate(
            {
              label,
              language: languageFromPath(url),
              url,
              source: 'direct',
              baseUrl,
              provider: profile.provider,
              format: 'vtt',
            },
            context,
          ),
        );
      }

      return candidates;
    },
  };
}
