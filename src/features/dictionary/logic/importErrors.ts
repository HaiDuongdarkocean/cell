// importErrors — error hierarchy for import pipeline (ADR-023 D6, spec F9-F10).
//
// ImportError abstract base + 7 subclasses. getUserMessage maps to user-facing
// Vietnamese messages. Rollback triggers: any ImportError → orchestrator catch.

/** Abstract base for all import errors. */
export abstract class ImportError extends Error {
  abstract readonly code: ImportErrorCode;
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.cause = cause;
  }
}

/** Error codes for programmatic handling. */
export type ImportErrorCode =
  | 'DUPLICATE_FILE'
  | 'CORRUPTED_FILE'
  | 'UNSUPPORTED_FORMAT'
  | 'DATABASE_ERROR'
  | 'PARSE_ERROR'
  | 'ROLLBACK'
  | 'CANCELLED'
  | 'QUOTA_EXCEEDED';

/** Re-import same file (same signature). No resource created. */
export class DuplicateFileError extends ImportError {
  readonly code = 'DUPLICATE_FILE' as const;
  constructor(signature: string, existingName: string) {
    super(`File already imported (signature: ${signature}, existing: "${existingName}").`);
    this.name = 'DuplicateFileError';
  }
}

/** Corrupt gzip/zip/json/sqlite. */
export class CorruptedFileError extends ImportError {
  readonly code = 'CORRUPTED_FILE' as const;
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'CorruptedFileError';
  }
}

/** Format not supported or undetectable. */
export class UnsupportedFormatError extends ImportError {
  readonly code = 'UNSUPPORTED_FORMAT' as const;
  constructor(fileName: string, detail?: string) {
    super(`Could not detect or unsupported format for "${fileName}"${detail ? `: ${detail}` : ''}.`);
    this.name = 'UnsupportedFormatError';
  }
}

/** Database error (IndexedDB open/put/get fail, sql.js wasm load fail). */
export class DatabaseError extends ImportError {
  readonly code = 'DATABASE_ERROR' as const;
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'DatabaseError';
  }
}

/** Parse error (malformed JSON, invalid encoding, bad Yomitan structure). */
export class ParseError extends ImportError {
  readonly code = 'PARSE_ERROR' as const;
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'ParseError';
  }
}

/** Rollback failed during error recovery (rollback-during-rollback). */
export class RollbackError extends ImportError {
  readonly code = 'ROLLBACK' as const;
  readonly resourceId: number;
  constructor(resourceId: number, cause?: unknown) {
    super(`Rollback failed for resource ${resourceId}. Manual cleanup needed.`, cause);
    this.name = 'RollbackError';
    this.resourceId = resourceId;
  }
}

/** User cancelled import mid-batch. */
export class CancelledError extends ImportError {
  readonly code = 'CANCELLED' as const;
  constructor(resourceId: number) {
    super(`Import cancelled by user (resource ${resourceId}).`);
    this.name = 'CancelledError';
  }
}

/** IndexedDB quota exceeded. */
export class QuotaExceededError extends ImportError {
  readonly code = 'QUOTA_EXCEEDED' as const;
  constructor(cause?: unknown) {
    super('Storage quota exceeded. Free up space or import a smaller file.', cause);
    this.name = 'QuotaExceededError';
  }
}

/** Map ImportError code → user-facing Vietnamese message. */
export function getUserMessage(error: ImportError): string {
  switch (error.code) {
    case 'DUPLICATE_FILE':
      return 'File này đã được import rồi. Không cần import lại.';
    case 'CORRUPTED_FILE':
      return `File bị hỏng hoặc không hợp lệ. ${error.message}`;
    case 'UNSUPPORTED_FORMAT':
      return `Định dạng không được hỗ trợ. ${error.message}`;
    case 'DATABASE_ERROR':
      return `Lỗi cơ sở dữ liệu. ${error.message}`;
    case 'PARSE_ERROR':
      return `Lỗi đọc file. ${error.message}`;
    case 'ROLLBACK':
      return `Import thất bại và không thể rollback. Cần dọn dẹp thủ công (resource ${error instanceof RollbackError ? error.resourceId : '?'}).`;
    case 'CANCELLED':
      return 'Import đã bị hủy.';
    case 'QUOTA_EXCEEDED':
      return 'Đã hết dung lượng lưu trữ. Hãy xóa bớt tài nguyên hoặc import file nhỏ hơn.';
    default:
      return error.message;
  }
}

/** Check if error is an ImportError. */
export function isImportError(error: unknown): error is ImportError {
  return error instanceof ImportError;
}
