import type { SrtCue } from '@/entities/media';
import { parseSmi } from './smiParser';
import { emitSrtBlocks } from './srtNormalizer';

export function convertSmiToSrt(
  smiContent: string,
  preferredClass: string = 'ENUSCC',
): string {
  const cues: SrtCue[] = parseSmi(smiContent, preferredClass);
  return emitSrtBlocks(cues.filter((cue) => cue.text.length > 0));
}
