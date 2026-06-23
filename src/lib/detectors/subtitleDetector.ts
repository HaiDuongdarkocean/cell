import { SUBTITLE_URL_PATTERNS } from '../../constants/urls';
import type {
  DetectedSubtitle,
  NetworkRequest,
  SubtitleFormat,
} from '../../types/media';

const FORMAT_EXTENSIONS: ReadonlyArray<[SubtitleFormat, string]> = [
  ['ass', '.ass'],
  ['vtt', '.vtt'],
  ['srt', '.srt'],
];

const LANGUAGE_PATTERN = /^[a-z]{2,3}$/i;

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function detectFormat(url: string): SubtitleFormat | null {
  const pathname = url.split('?')[0]?.split('#')[0] ?? url;
  const lower = pathname.toLowerCase();
  for (const [format, ext] of FORMAT_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      return format;
    }
  }
  return null;
}

function extractLanguage(url: string): string {
  const pathname = url.split('?')[0]?.split('#')[0] ?? url;
  const filename = pathname.split('/').pop() ?? '';
  const filenameWithoutExt = filename.replace(/\.[^.]+$/, '');
  const parts = filenameWithoutExt.split('.');

  if (parts.length >= 2) {
    const candidate = parts[parts.length - 1] ?? '';
    if (LANGUAGE_PATTERN.test(candidate)) {
      return candidate.toLowerCase();
    }
  }

  const segments = pathname.split('/').filter((s) => s.length > 0);
  if (segments.length >= 2) {
    const candidate = segments[segments.length - 2] ?? '';
    if (LANGUAGE_PATTERN.test(candidate)) {
      return candidate.toLowerCase();
    }
  }

  return 'unknown';
}

export function detectSubtitle(request: NetworkRequest): DetectedSubtitle | null {
  const matches = SUBTITLE_URL_PATTERNS.some((pattern) => pattern.test(request.url));
  if (!matches) {
    return null;
  }

  const format = detectFormat(request.url);
  if (format === null) {
    return null;
  }

  const language = extractLanguage(request.url);

  return {
    id: generateId(),
    url: request.url,
    format,
    language,
    tabId: request.tabId,
    detectedAt: request.timeStamp,
  };
}
