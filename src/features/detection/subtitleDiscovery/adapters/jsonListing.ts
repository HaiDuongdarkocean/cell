// Generic JSON-listing adapter for subtitle discovery.
//
// Supports both bare arrays (`cinesrc`, `kisskh`) and object-wrapped arrays
// (`lookmovie.subtitles`, `broodingmovies.default_subs`). Each site is configured
// via a profile; the adapter has no site-specific branches.

import type { SubtitleDiscoveryContext, SubtitleDiscoveryEnvironment, SubtitleSignal } from '../types';
import { createCandidate, type CandidateInit } from '../candidate';
import type { SubtitleCandidate, SubtitleDiscoveryAdapter } from '../types';

export interface JsonListingProfile {
  readonly id: string;
  readonly priority: number;
  readonly urlPattern: RegExp;
  readonly responseType: 'array' | 'object-key';
  readonly objectKey?: string;
  readonly extractList: (parsed: unknown) => unknown[];
  readonly mapEntry: (entry: unknown, context: SubtitleDiscoveryContext, index: number) => CandidateInit | null;
  readonly replayReferer?: (context: SubtitleDiscoveryContext) => string | undefined;
}

export function createJsonListingAdapter(profile: JsonListingProfile): SubtitleDiscoveryAdapter {
  return {
    id: profile.id,
    priority: profile.priority,
    match(signal: SubtitleSignal): boolean {
      if (signal.kind !== 'network-response') return false;
      return profile.urlPattern.test(signal.url);
    },

    async discover(
      signal: SubtitleSignal,
      context: SubtitleDiscoveryContext,
      env: SubtitleDiscoveryEnvironment,
    ): Promise<readonly SubtitleCandidate[]> {
      if (signal.kind !== 'network-response') {
        return [];
      }

      let body = signal.body;
      let finalUrl = signal.url;

      if (!body) {
        const referer = profile.replayReferer?.(context) ?? context.initiator ?? context.frameUrl ?? context.origin;
        const result = await env.fetchText(signal.url, {
          origin: context.origin,
          referer,
          initiator: context.initiator,
          frameUrl: context.frameUrl,
          tabUrl: context.tabUrl,
        });
        if (!result.ok) {
          return [makeRejectedCandidate(`listing fetch failed: ${result.status}`, context)];
        }
        body = result.content;
        finalUrl = result.finalUrl;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(body) as unknown;
      } catch {
        return [makeRejectedCandidate('invalid JSON in listing response', context)];
      }

      const list = profile.extractList(parsed);
      if (!Array.isArray(list)) {
        return [makeRejectedCandidate(`listing ${profile.objectKey ?? 'array'} missing`, context)];
      }

      const candidates: SubtitleCandidate[] = [];
      for (let i = 0; i < list.length; i++) {
        const init = profile.mapEntry(list[i], context, i);
        if (!init) {
          continue;
        }
        candidates.push(createCandidate(init, { ...context, frameUrl: finalUrl }));
      }

      return candidates;
    },
  };
}

function makeRejectedCandidate(reason: string, context: SubtitleDiscoveryContext): SubtitleCandidate {
  return createCandidate(
    {
      label: 'rejected',
      status: 'rejected',
      rejectReason: reason,
    },
    context,
  );
}
