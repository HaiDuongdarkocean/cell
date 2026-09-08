import type { SubtitleFormat } from '@/entities/media';

/**
 * Detect subtitle format from content sniffing.
 * ponytail: only the first 40 chars — enough for WEBVTT, ASS headers, and SRT.
 */
export function formatFromContent(content: string): SubtitleFormat | null {
  const stripped = content.replace(/^\uFEFF/, '').trimStart();
  const head = stripped.slice(0, 40).toUpperCase();
  if (head.startsWith('WEBVTT')) return 'vtt';
  if (head.startsWith('[SCRIPT INFO]') || head.startsWith('DIALOGUE:')) return 'ass';
  if (/^\d+\s*\n\d{1,2}:\d{2}:/.test(stripped.slice(0, 40))) return 'srt';
  return null;
}
