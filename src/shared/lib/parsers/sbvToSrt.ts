import { parseSbv } from './sbvParser';
import { emitSrtBlocks } from './srtNormalizer';

export function convertSbvToSrt(sbvContent: string): string {
  if (!sbvContent || sbvContent.trim().length === 0) {
    return '';
  }
  return emitSrtBlocks(parseSbv(sbvContent));
}
