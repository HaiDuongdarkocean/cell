import { collapseCueTextLines, emitSrtBlocks } from './srtNormalizer';
import { parseVtt } from './vttParser';

export function convertVttToSrt(vttContent: string): string {
  const { cues } = parseVtt(vttContent);
  const cleaned = cues
    .map((cue) => ({
      start: cue.start,
      end: cue.end,
      text: collapseCueTextLines(cue.text),
    }))
    .filter((cue) => cue.text.length > 0);
  return emitSrtBlocks(cleaned);
}
