// Pure candidate factory + normalization.
//
// All candidate production flows through this file so language, format, identity,
// and replay context are handled consistently. No side effects.

import {
  toIso6391,
  isValidIsoCode,
  labelToIsoCode,
} from '@/shared/config/languageRegistry';
import { formatFromContent } from '@/shared/lib/parsers/subtitleFormat';
import type { SubtitleFormat } from '@/entities/media';
import type {
  SubtitleCandidate,
  SubtitleCandidateStatus,
  SubtitleDiscoveryContext,
  SubtitleMetadataHandle,
  SubtitleReplayContext,
  SubtitleSourceKind,
} from './types';

const FORMAT_EXTENSIONS: ReadonlyArray<[SubtitleFormat, string]> = [
  ['ass', '.ass'],
  ['ssa', '.ssa'],
  ['vtt', '.vtt'],
  ['srt', '.srt'],
];

const QUERY_FORMAT_KEYS = ['format', 'type', 'subtype'] as const;

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function formatFromUrl(url: string): SubtitleFormat | null {
  const path = url.split('?')[0]?.split('#')[0] ?? url;
  const lower = path.toLowerCase();
  for (const [format, ext] of FORMAT_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      return format;
    }
  }

  try {
    const u = new URL(url);
    for (const key of QUERY_FORMAT_KEYS) {
      const value = u.searchParams.get(key);
      if (value) {
        const fmt = value.toLowerCase();
        for (const [format, ext] of FORMAT_EXTENSIONS) {
          if (fmt === format || fmt === ext.replace('.', '')) {
            return format;
          }
        }
      }
    }
  } catch {
    // not a valid URL
  }

  return null;
}

export { formatFromContent };

export function languageFromPath(path: string): string {
  const base = path.split('?')[0]?.split('#')[0] ?? path;
  const file = base.slice(base.lastIndexOf('/') + 1);
  const withoutExt = file.replace(/\.[^.]+$/, '');
  // Some paths end with `<lang>.vtt` (e.g. lookmovie `/.../subtitles/en.vtt`).
  // Also handles `<name>.<lang>` or `<lang>-<index>`.
  const parts = withoutExt.split('.');
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 1] ?? '';
    if (isValidIsoCode(candidate.toLowerCase())) {
      return toIso6391(candidate);
    }
  }
  const kebab = withoutExt.split('-');
  if (kebab.length >= 2) {
    const candidate = kebab[kebab.length - 1] ?? '';
    if (isValidIsoCode(candidate.toLowerCase())) {
      return toIso6391(candidate);
    }
  }
  if (isValidIsoCode(withoutExt.toLowerCase())) {
    return toIso6391(withoutExt);
  }
  return 'unknown';
}

export function resolveLanguage(input?: string | null): string {
  if (!input) return 'unknown';
  const cleaned = input.trim();
  if (isValidIsoCode(cleaned)) return toIso6391(cleaned);
  const fromLabel = labelToIsoCode(cleaned);
  if (fromLabel) return fromLabel;
  // Accept BCP-47 primary subtag if it passes ISO validation.
  const primary = cleaned.split('-')[0]?.toLowerCase() ?? '';
  if (isValidIsoCode(primary)) return toIso6391(primary);
  return 'unknown';
}

export function languageFromLabel(label: string): string {
  const iso = labelToIsoCode(label);
  if (iso) return iso;
  // Some labels carry a parenthesised region, e.g. "Portuguese (BR)".
  const withoutRegion = label.replace(/\s*\([^)]*\)/g, '').trim();
  const iso2 = labelToIsoCode(withoutRegion);
  if (iso2) return iso2;
  return 'unknown';
}

export function buildReplayContext(
  ctx: SubtitleDiscoveryContext,
  overrides?: Partial<SubtitleReplayContext>,
): SubtitleReplayContext {
  return {
    origin: ctx.origin,
    referer: overrides?.referer ?? ctx.initiator ?? ctx.frameUrl ?? ctx.tabUrl,
    initiator: ctx.initiator,
    tabUrl: ctx.tabUrl,
    frameUrl: ctx.frameUrl,
  };
}

export interface CandidateInit {
  label: string;
  language?: string;
  format?: SubtitleFormat | null;
  source?: SubtitleSourceKind;
  url?: string;
  baseUrl?: string;
  metadata?: SubtitleMetadataHandle;
  status?: SubtitleCandidateStatus;
  provider?: string;
  default?: boolean;
  forced?: boolean;
  sdh?: boolean;
  asr?: boolean;
  identity?: string;
  rejectReason?: string;
}

export function createCandidate(
  init: CandidateInit,
  ctx: SubtitleDiscoveryContext,
): SubtitleCandidate {
  const resolvedFormat: SubtitleFormat =
    init.format ?? (init.url ? formatFromUrl(init.url) : null) ?? 'unknown';

  const resolvedLanguage =
    init.language ?? languageFromLabel(init.label);

  const source: SubtitleSourceKind = init.source ?? (init.url ? 'direct' : 'metadata');

  const identity =
    init.identity ??
    buildCandidateIdentity({
      provider: init.provider ?? 'unknown',
      label: init.label,
      language: resolvedLanguage,
      url: init.url,
      metadataId: init.metadata?.providerId,
    });

  const status: SubtitleCandidateStatus =
    init.status ?? (source === 'metadata' ? 'unresolved' : 'ready');

  return {
    id: generateId(),
    label: init.label,
    language: resolvedLanguage,
    format: resolvedFormat,
    source,
    url: init.url,
    baseUrl: init.baseUrl,
    metadata: init.metadata,
    status,
    identity,
    provider: init.provider,
    default: init.default,
    forced: init.forced,
    sdh: init.sdh,
    asr: init.asr,
    tabId: ctx.tabId,
    frameId: ctx.frameId,
    initiator: ctx.initiator,
    replayContext: buildReplayContext(ctx),
    rejectReason: init.rejectReason,
  };
}

export interface IdentityParts {
  provider: string;
  label: string;
  language: string;
  url?: string;
  metadataId?: string;
}

export function buildCandidateIdentity(parts: IdentityParts): string {
  const label = parts.label.toLowerCase().replace(/\s+/g, '-');
  const lang = parts.language.toLowerCase();
  if (parts.metadataId) {
    return `${parts.provider}:${parts.metadataId}:${lang}`;
  }
  if (parts.url) {
    const path = parts.url.split('?')[0]?.split('#')[0] ?? parts.url;
    const key = path.slice(path.lastIndexOf('/') + 1);
    return `${parts.provider}:${label}:${lang}:${key}`;
  }
  return `${parts.provider}:${label}:${lang}`;
}

export function resolveRelativeUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

export function stripQueryTokens(url: string): string {
  try {
    const u = new URL(url);
    u.search = '';
    u.hash = '';
    return u.href;
  } catch {
    return url.split('?')[0]?.split('#')[0] ?? url;
  }
}
