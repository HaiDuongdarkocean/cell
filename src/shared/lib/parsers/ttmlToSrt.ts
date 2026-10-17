import { collapseCueTextLines, emitSrtBlocks, stripSubtitleTags } from './srtNormalizer';
import { parseTtmlTime } from './ttmlTime';

export function convertTtmlToSrt(ttmlContent: string): string {
  const stripped = ttmlContent.replace(/^\uFEFF/, '');
  if (stripped.trim().length === 0) {
    throw new Error('Cannot convert empty TTML content');
  }

  const tickRateMatch = stripped.match(/ttp:tickRate="(\d+)"/);
  const tickRate = tickRateMatch ? parseInt(tickRateMatch[1], 10) : 1;

  const frameRateMatch = stripped.match(/ttp:frameRate="(\d+)"/);
  const frameRate = frameRateMatch ? parseInt(frameRateMatch[1], 10) : 30;

  const pRegex = /<p\b[^>]*\bbegin="([^"]+)"[^>]*\bend="([^"]+)"[^>]*>([\s\S]*?)<\/p>/g;
  const cues: { start: number; end: number; text: string }[] = [];
  let match: RegExpExecArray | null;

  while ((match = pRegex.exec(stripped)) !== null) {
    const startMs = parseTtmlTime(match[1], tickRate, frameRate);
    const endMs = parseTtmlTime(match[2], tickRate, frameRate);
    if (startMs === null || endMs === null) continue;

    const text = collapseCueTextLines(
      stripSubtitleTags(match[3].replace(/<br\s*\/?>/gi, '\n')),
    ).trim();
    if (text.length === 0) continue;

    cues.push({ start: startMs, end: endMs, text });
  }

  if (cues.length === 0) {
    throw new Error('No cues found in TTML content');
  }

  return emitSrtBlocks(cues);
}
