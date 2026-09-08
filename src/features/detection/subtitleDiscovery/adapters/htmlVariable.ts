// HTML-variable subtitle-list adapter (MyAsianTV/kisscloud `playerjsSubtitle`,
// vidrift `subtitleTracks`).
//
// The player embed page stores its subtitle list in a single JS variable.
// The adapter only allow-lists that variable and parses its grammar; it never
// executes arbitrary page script.

import { createCandidate, formatFromUrl, languageFromLabel, resolveLanguage } from '../candidate';
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

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stripQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

function extractVariable(html: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(?:var|const|let)\\s+${escaped}\\s*=\\s*([^;]+);`, 'i');
  const match = regex.exec(html);
  return match?.[1]?.trim();
}

function tryParseJsonArray(raw: string): unknown[] | undefined {
  if (!raw.startsWith('[') && !raw.startsWith('{')) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
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

function mapObjectArray(
  payload: readonly Record<string, unknown>[],
  base: string,
  provider: string,
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
          provider,
          format: formatFromUrl(url) ?? 'vtt',
          default: entry.default === true || index === 0,
        },
        context,
      );
    })
    .filter((c): c is SubtitleCandidate => c !== null);
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

      const value = stripQuotes(raw);
      const jsonArray = tryParseJsonArray(value);
      if (jsonArray) {
        if (!jsonArray.every(isRecord)) {
          return [createCandidate({ label: 'rejected', status: 'rejected', rejectReason: 'variable JSON array contains non-object items' }, context)];
        }
        const base = context.frameUrl ?? context.tabUrl ?? context.origin;
        if (!base) {
          return [createCandidate({ label: 'rejected', status: 'rejected', rejectReason: 'missing base URL for object array' }, context)];
        }
        const candidates = mapObjectArray(jsonArray as Record<string, unknown>[], base, profile.provider, context);
        return candidates.length > 0 ? candidates : [createCandidate({ label: 'rejected', status: 'rejected', rejectReason: 'empty object array' }, context)];
      }

      const entries = parseBracketList(value);
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
