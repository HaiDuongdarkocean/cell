// Bounded text fetch helper for subtitle discovery.
//
// The helper is injected into the pipeline so that browser-specific mechanics
// (offscreen, DNR referer rewrite) stay at the entrypoint layer, while the
// adapters remain pure protocol code.

import type { SubtitleReplayContext, FetchTextResult } from './types';

export interface FetchTextDependencies {
  fetcher: (url: string, options?: { headers?: Record<string, string>; credentials?: RequestCredentials }) => Promise<FetchTextResult>;
  setRefererRule?: (url: string, referer: string) => Promise<number>;
  removeRefererRule?: (ruleId: number) => Promise<void>;
}

export function createFetchText(
  deps: FetchTextDependencies,
): (url: string, context: SubtitleReplayContext) => Promise<FetchTextResult> {
  return async (url: string, context: SubtitleReplayContext): Promise<FetchTextResult> => {
    const referer = context.referer ?? context.origin;
    let ruleId: number | undefined;

    try {
      if (deps.setRefererRule && referer) {
        ruleId = await deps.setRefererRule(url, referer);
      }

      const result = await deps.fetcher(url, {
        credentials: context.credentials ?? 'same-origin',
      });

      return result;
    } finally {
      if (ruleId !== undefined && deps.removeRefererRule) {
        void deps.removeRefererRule(ruleId).catch(() => {});
      }
    }
  };
}
