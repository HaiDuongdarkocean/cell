import { parseAss } from './assParser';
import { emitSrtBlocks } from './srtNormalizer';

function stripAssStyling(text: string): string {
  let result = text.replace(/\{\\p1\}[\s\S]*?\{\\p0\}/g, '');

  result = result.replace(/(?:^|\s)[mnlbsp]\s+[-\d.]+(?:\s+[-\d.]+)+/g, ' ');

  result = result.replace(/\{[^}]*\}/g, '');

  result = result.replace(/\\N/g, '\n');

  result = result.replace(/\\n/g, ' ');

  result = result
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
    .join('\n');

  return result.trim();
}

export function convertAssToSrt(assContent: string): string {
  const { dialogues } = parseAss(assContent);

  const cues = dialogues
    .slice()
    .sort((a, b) => a.start - b.start)
    .map((dialogue) => ({
      start: dialogue.start,
      end: dialogue.end,
      text: stripAssStyling(dialogue.text),
    }))
    .filter((cue) => cue.text.length > 0);

  return emitSrtBlocks(cues);
}
