import { createStrategy, resolveFormat } from '@/features/dictionary/strategies/strategyFactory';
import { TxtLineStrategy } from '@/features/dictionary/strategies/txtLineStrategy';
import { JsonArrayStrategy } from '@/features/dictionary/strategies/jsonArrayStrategy';
import { TermBankStrategy } from '@/features/dictionary/strategies/termBankStrategy';
import { JsonEntriesStrategy } from '@/features/dictionary/strategies/jsonEntriesStrategy';
import { SqliteStrategy } from '@/features/dictionary/strategies/sqliteStrategy';
import { UnsupportedFormatError } from '@/features/dictionary/logic/importErrors';
import { strToU8 } from 'fflate';

const options = { resourceId: 1, langCode: 'en' };
const fileData = { data: strToU8('test'), fileName: 'test.txt' };

describe('strategyFactory', () => {
  it('creates TxtLineStrategy for txt', () => {
    const s = createStrategy('txt', 'FREQUENCY', options, fileData);
    expect(s).toBeInstanceOf(TxtLineStrategy);
  });

  it('creates JsonArrayStrategy for json-array', () => {
    const s = createStrategy('json-array', 'FREQUENCY', options, fileData);
    expect(s).toBeInstanceOf(JsonArrayStrategy);
  });

  it('creates TermBankStrategy for term-bank', () => {
    const s = createStrategy('term-bank', 'FREQUENCY', options, fileData);
    expect(s).toBeInstanceOf(TermBankStrategy);
  });

  it('creates JsonEntriesStrategy for json-entries', () => {
    const s = createStrategy('json-entries', 'DICTIONARY', options, fileData);
    expect(s).toBeInstanceOf(JsonEntriesStrategy);
  });

  it('creates SqliteStrategy for sqlite', () => {
    const s = createStrategy('sqlite', 'FREQUENCY', options, fileData);
    expect(s).toBeInstanceOf(SqliteStrategy);
  });

  it('throws UnsupportedFormatError for unknown format', () => {
    expect(() => createStrategy('unknown' as never, 'FREQUENCY', options, fileData)).toThrow(UnsupportedFormatError);
  });
});

describe('resolveFormat', () => {
  it('resolves json-array + DICTIONARY → json-entries', () => {
    expect(resolveFormat('json-array', 'DICTIONARY')).toBe('json-entries');
  });

  it('keeps json-array for FREQUENCY', () => {
    expect(resolveFormat('json-array', 'FREQUENCY')).toBe('json-array');
  });

  it('keeps other formats unchanged', () => {
    expect(resolveFormat('txt', 'FREQUENCY')).toBe('txt');
    expect(resolveFormat('term-bank', 'FREQUENCY')).toBe('term-bank');
    expect(resolveFormat('sqlite', 'FREQUENCY')).toBe('sqlite');
    expect(resolveFormat('json-entries', 'DICTIONARY')).toBe('json-entries');
  });
});
