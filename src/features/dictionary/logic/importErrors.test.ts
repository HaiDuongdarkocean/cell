import {
  ImportError,
  DuplicateFileError,
  CorruptedFileError,
  UnsupportedFormatError,
  DatabaseError,
  ParseError,
  RollbackError,
  CancelledError,
  QuotaExceededError,
  getUserMessage,
  isImportError,
} from '@/features/dictionary/logic/importErrors';

describe('importErrors', () => {
  describe('error classes', () => {
    it('DuplicateFileError has correct code + name', () => {
      const err = new DuplicateFileError('sig123', 'old.txt');
      expect(err.code).toBe('DUPLICATE_FILE');
      expect(err.name).toBe('DuplicateFileError');
      expect(err.message).toContain('sig123');
      expect(err.message).toContain('old.txt');
      expect(err).toBeInstanceOf(ImportError);
    });

    it('CorruptedFileError has correct code + cause', () => {
      const cause = new Error('inner');
      const err = new CorruptedFileError('bad zip', cause);
      expect(err.code).toBe('CORRUPTED_FILE');
      expect(err.name).toBe('CorruptedFileError');
      expect(err.cause).toBe(cause);
    });

    it('UnsupportedFormatError has correct code', () => {
      const err = new UnsupportedFormatError('file.xyz', 'unknown ext');
      expect(err.code).toBe('UNSUPPORTED_FORMAT');
      expect(err.message).toContain('file.xyz');
      expect(err.message).toContain('unknown ext');
    });

    it('DatabaseError has correct code', () => {
      const err = new DatabaseError('wasm load fail');
      expect(err.code).toBe('DATABASE_ERROR');
      expect(err.message).toBe('wasm load fail');
    });

    it('ParseError has correct code', () => {
      const err = new ParseError('bad json');
      expect(err.code).toBe('PARSE_ERROR');
    });

    it('RollbackError has resourceId', () => {
      const err = new RollbackError(42);
      expect(err.code).toBe('ROLLBACK');
      expect(err.resourceId).toBe(42);
      expect(err.message).toContain('42');
    });

    it('CancelledError has resourceId in message', () => {
      const err = new CancelledError(7);
      expect(err.code).toBe('CANCELLED');
      expect(err.message).toContain('7');
    });

    it('QuotaExceededError has correct code', () => {
      const err = new QuotaExceededError();
      expect(err.code).toBe('QUOTA_EXCEEDED');
    });
  });

  describe('getUserMessage', () => {
    it('returns Vietnamese for DUPLICATE_FILE', () => {
      const msg = getUserMessage(new DuplicateFileError('sig', 'old.txt'));
      expect(msg).toContain('đã được import');
    });
    it('returns Vietnamese for CORRUPTED_FILE', () => {
      const msg = getUserMessage(new CorruptedFileError('bad'));
      expect(msg).toContain('hỏng');
    });
    it('returns Vietnamese for UNSUPPORTED_FORMAT', () => {
      const msg = getUserMessage(new UnsupportedFormatError('file.xyz'));
      expect(msg).toContain('không được hỗ trợ');
    });
    it('returns Vietnamese for DATABASE_ERROR', () => {
      const msg = getUserMessage(new DatabaseError('fail'));
      expect(msg).toContain('cơ sở dữ liệu');
    });
    it('returns Vietnamese for PARSE_ERROR', () => {
      const msg = getUserMessage(new ParseError('bad'));
      expect(msg).toContain('đọc file');
    });
    it('returns Vietnamese for ROLLBACK with resourceId', () => {
      const msg = getUserMessage(new RollbackError(42));
      expect(msg).toContain('42');
      expect(msg).toContain('rollback');
    });
    it('returns Vietnamese for CANCELLED', () => {
      const msg = getUserMessage(new CancelledError(1));
      expect(msg).toContain('hủy');
    });
    it('returns Vietnamese for QUOTA_EXCEEDED', () => {
      const msg = getUserMessage(new QuotaExceededError());
      expect(msg).toContain('dung lượng');
    });
  });

  describe('isImportError', () => {
    it('returns true for ImportError subclasses', () => {
      expect(isImportError(new DuplicateFileError('s', 'n'))).toBe(true);
      expect(isImportError(new ParseError('x'))).toBe(true);
    });
    it('returns false for generic Error', () => {
      expect(isImportError(new Error('generic'))).toBe(false);
      expect(isImportError(null)).toBe(false);
      expect(isImportError(undefined)).toBe(false);
    });
  });
});
