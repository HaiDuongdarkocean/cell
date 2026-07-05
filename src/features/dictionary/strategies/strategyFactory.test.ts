import { createStrategy, resolveFormat } from '@/features/dictionary/strategies/strategyFactory';
import { TxtLineStrategy } from '@/features/dictionary/strategies/txtLineStrategy';
import { JsonArrayStrategy } from '@/features/dictionary/strategies/jsonArrayStrategy';
import { YomitanStrategy } from '@/features/dictionary/strategies/yomitanStrategy';
import { CambridgeJsonStrategy } from '@/features/dictionary/strategies/cambridgeJsonStrategy';
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

  it('creates YomitanStrategy for yomitan', () => {
    const s = createStrategy('yomitan', 'FREQUENCY', options, fileData);
    expect(s).toBeInstanceOf(YomitanStrategy);
  });

  it('creates CambridgeJsonStrategy for cambridge-json', () => {
    const s = createStrategy('cambridge-json', 'DICTIONARY', options, fileData);
    expect(s).toBeInstanceOf(CambridgeJsonStrategy);
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
  it('resolves json-array + DICTIONARY → cambridge-json', () => {
    expect(resolveFormat('json-array', 'DICTIONARY')).toBe('cambridge-json');
  });

  it('keeps json-array for FREQUENCY', () => {
    expect(resolveFormat('json-array', 'FREQUENCY')).toBe('json-array');
  });

  it('keeps other formats unchanged', () => {
    expect(resolveFormat('txt', 'FREQUENCY')).toBe('txt');
    expect(resolveFormat('yomitan', 'FREQUENCY')).toBe('yomitan');
    expect(resolveFormat('sqlite', 'FREQUENCY')).toBe('sqlite');
    expect(resolveFormat('cambridge-json', 'DICTIONARY')).toBe('cambridge-json');
  });
});
