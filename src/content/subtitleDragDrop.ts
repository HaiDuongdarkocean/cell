import { parseSubtitle } from './subtitleParser';
import { convertAssToSrt } from '@/shared/lib/parsers/assToSrt';
import type { ParseResult, SubtitleFormat } from '../types/subtitle';

/**
 * ParseResult + source File (for multi-file drag-drop, ADR-015).
 * Caller uses `file` to read content again for language detection / bilingual
 * parse, and `result` to decide success/failure per file.
 */
export interface FileParseResult {
  readonly file: File;
  readonly result: ParseResult;
}

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

  // ass/ssa: convert to SRT first, then parse as SRT
  if (format === 'ass' || format === 'ssa') {
    const srtContent = convertAssToSrt(content);
    if (!srtContent) {
      return {
        success: false,
        cues: [],
        format,
        error: 'ASS conversion produced no cues',
      };
    }
    return parseSubtitle(srtContent, 'srt');
  }

  return parseSubtitle(content, format);
}

/**
 * Handle multiple dropped subtitle files (ADR-015 — multi-file drag-drop).
 *
 * Parses each file independently via `handleFileDrop`, preserving input order.
 * Invalid/unsupported files are included as failed results (caller filters by
 * `result.success`). Returns one `FileParseResult` per input file so the caller
 * can access the original `File` for language detection or bilingual parse.
 *
 * @param files - Dropped File objects (from DataTransfer.files)
 * @returns Array of { file, result } in input order
 */
export async function handleMultipleFilesDrop(
  files: readonly File[],
): Promise<FileParseResult[]> {
  const results: FileParseResult[] = [];
  for (const file of files) {
    const result = await handleFileDrop(file);
    results.push({ file, result });
  }
  return results;
}
