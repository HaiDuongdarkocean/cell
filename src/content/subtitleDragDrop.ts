import { parseSubtitle } from './subtitleParser';
import type { ParseResult, SubtitleFormat } from '../types/subtitle';

const SUPPORTED_EXTENSIONS = ['.srt', '.vtt', '.ass', '.ssa'];

/**
 * Read File content as text via FileReader.
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsText(file);
  });
}

/**
 * Get subtitle format from file extension.
 */
function getFormatFromExtension(filename: string): SubtitleFormat | null {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  if (ext === '.srt') return 'srt';
  if (ext === '.vtt') return 'vtt';
  if (ext === '.ass' || ext === '.ssa') return 'ass';
  return null;
}

/**
 * Handle dropped subtitle file: validate extension, read content, parse.
 *
 * @param file - Dropped File object
 * @returns ParseResult with cues or error
 */
export async function handleFileDrop(file: File): Promise<ParseResult> {
  const format = getFormatFromExtension(file.name);
  if (!format) {
    return {
      success: false,
      cues: [],
      format: 'unknown',
      error: `Unsupported file type: ${file.name}. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`,
    };
  }

  const content = await readFileAsText(file);
  if (!content.trim()) {
    return {
      success: false,
      cues: [],
      format,
      error: 'File is empty',
    };
  }

  // ass/ssa fallback to srt parser until converter is added (Task 13)
  const parseFormat = format === 'ass' || format === 'ssa' ? 'srt' : format;
  return parseSubtitle(content, parseFormat);
}
