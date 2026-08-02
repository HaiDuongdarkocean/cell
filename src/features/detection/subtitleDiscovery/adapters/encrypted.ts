// Encrypted-listing subtitle adapter (moviepire/videasy).
//
// The videasy `sources-with-title` endpoint returns a custom XOR/PRNG-encrypted
// payload. This adapter isolates the decoder; when the decoder is not yet
// available, it preserves the encrypted response as an unresolved handle.

import { createCandidate } from '../candidate';
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

export function createEncryptedAdapter(profile: EncryptedProfile): SubtitleDiscoveryAdapter {
  return {
    id: profile.id,
    priority: profile.priority,
    match(signal: SubtitleSignal): boolean {
      return signal.kind === 'network-response' && profile.urlPattern.test(signal.url);
    },

    async discover(
      signal: SubtitleSignal,
      context: SubtitleDiscoveryContext,
      _env: SubtitleDiscoveryEnvironment,
    ): Promise<readonly SubtitleCandidate[]> {
      if (signal.kind !== 'network-response') return [];

      // The player-side evidence confirms 85 direct VTT URLs live inside the
      // encrypted body, but the extension's decoder has not been ported yet.
      // Keep the response as an unresolved metadata handle rather than fabricate.
      return [
        createCandidate(
          {
            label: 'Encrypted videasy listing',
            language: 'unknown',
            source: 'metadata',
            provider: profile.provider,
            status: 'unresolved',
            metadata: {
              provider: 'videasy',
              providerId: `enc:${signal.url}`,
              language: 'unknown',
              label: 'Encrypted listing',
              extra: { url: signal.url },
            },
          },
          context,
        ),
      ];
    },
  };
}
