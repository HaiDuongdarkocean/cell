import type { BookRecord } from '@/features/reader/services/readerRepository';

export type ParsedBook = Omit<BookRecord, 'id' | 'addedAt' | 'lastReadAt'>;

/**
 * Parse a plain-text file into a book record.
 *
 * ponytail: only UTF-8. TXT files in other encodings (Windows-1252, Shift_JIS,
 * GBK) will show mojibake — upgrade to encoding detection if users report it.
 */
export async function parseTxtBook(file: File): Promise<ParsedBook> {
  const text = await file.text();
  const paragraphs = text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const title = file.name.replace(/\.[^.]+$/, '');
  return {
    filename: file.name,
    title,
    languageCode: null,
    paragraphs,
  };
}
