// HTML-variable subtitle-list adapter (MyAsianTV/kisscloud `playerjsSubtitle`).
//
// The player embed page stores its subtitle list in a single JS variable.
// The adapter only allow-lists that variable and parses its grammar; it never
// executes arbitrary page script.

import { createCandidate, formatFromUrl, languageFromLabel } from '../candidate';
import type {
  SubtitleCandidate,
  SubtitleDiscoveryAdapter,
  SubtitleDiscoveryContext,
  SubtitleDiscoveryEnvironment,
  SubtitleSignal,
} from '../types';

export interface HtmlVariableProfile {
  readonly id: string;
  readonly priority: number;
  readonly urlPattern: RegExp;
  readonly originPattern?: RegExp;
  readonly variableName: string;
  readonly provider: string;
  readonly origin?: string;
}

function extractVariable(html: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:var|const|let)\\s+${escaped}\\s*=\\s*["']([^"']+)["']`, 'i');
  const match = regex.exec(html);
  return match?.[1];
}

function parseBracketList(value: string): Array<{ label: string; url: string }> {
  const entries: Array<{ label: string; url: string }> = [];
  const regex = /\[([^\]]+)\]([^,]+)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(value)) !== null) {
    const label = m[1].trim();
    const url = m[2].trim();
    if (url) entries.push({ label, url });
  }
  return entries;
}

export function createHtmlVariableAdapter(profile: HtmlVariableProfile): SubtitleDiscoveryAdapter {
  return {
    id: profile.id,
    priority: profile.priority,
    match(signal: SubtitleSignal): boolean {
      if (signal.kind === 'player-state') {
        return (
          signal.playerKey === profile.variableName &&
          profile.originPattern?.test(signal.origin) !== false
        );
      }
      if (signal.kind !== 'document-html') return false;
      if (!profile.urlPattern.test(signal.url)) return false;
      return signal.html.includes(profile.variableName);
    },

    async discover(
      signal: SubtitleSignal,
      context: SubtitleDiscoveryContext,
      _env: SubtitleDiscoveryEnvironment,
    ): Promise<readonly SubtitleCandidate[]> {
      let raw: string | undefined;

      if (signal.kind === 'player-state' && typeof signal.payload === 'string') {
        raw = signal.payload;
      } else if (signal.kind === 'document-html') {
        raw = extractVariable(signal.html, profile.variableName);
      }

      if (signal.kind !== 'player-state' && signal.kind !== 'document-html') return [];
      if (!raw) {
        return [createCandidate({ label: 'rejected', status: 'rejected', rejectReason: 'missing player variable' }, context)];
      }

      const entries = parseBracketList(raw);
      if (entries.length === 0) {
        return [createCandidate({ label: 'rejected', status: 'rejected', rejectReason: 'empty player variable list' }, context)];
      }

      return entries.map((entry) =>
        createCandidate(
          {
            label: entry.label,
            language: languageFromLabel(entry.label),
            url: entry.url,
            source: 'direct',
            provider: profile.provider,
            format: formatFromUrl(entry.url) ?? 'unknown',
          },
          context,
        ),
      );
    },
  };
}
