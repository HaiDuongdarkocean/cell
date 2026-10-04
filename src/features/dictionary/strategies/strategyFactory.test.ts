import { createStrategy } from '@/features/dictionary/strategies/strategyFactory';
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
    const s = createStrategy('txt', options, fileData);
    expect(s).toBeInstanceOf(TxtLineStrategy);
  });

  it('creates JsonArrayStrategy for json-array', () => {
    const s = createStrategy('json-array', options, fileData);
    expect(s).toBeInstanceOf(JsonArrayStrategy);
  });

  it('creates TermBankStrategy for term-bank', () => {
    const s = createStrategy('term-bank', options, fileData);
    expect(s).toBeInstanceOf(TermBankStrategy);
  });

  it('creates JsonEntriesStrategy for json-entries', () => {
    const s = createStrategy('json-entries', options, fileData);
    expect(s).toBeInstanceOf(JsonEntriesStrategy);
  });

  it('creates SqliteStrategy for sqlite', () => {
    const s = createStrategy('sqlite', options, fileData);
    expect(s).toBeInstanceOf(SqliteStrategy);
  });

  it('throws UnsupportedFormatError for unknown format', () => {
    expect(() => createStrategy('unknown' as never, options, fileData)).toThrow(UnsupportedFormatError);
  });
});
