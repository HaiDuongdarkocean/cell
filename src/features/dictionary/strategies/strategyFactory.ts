// strategyFactory — route format → strategy (ADR-023 D3, spec F9).
//
// JSON → json-entries if resourceType==='DICTIONARY', else json-array.
// Creates strategy instance with options + file data.

import type { ImportFormat, ResourceType } from '@/entities/dictionary';
import type { StrategyOptions } from './baseImportStrategy';
import { TxtLineStrategy } from './txtLineStrategy';
import { JsonArrayStrategy } from './jsonArrayStrategy';
import { TermBankStrategy } from './termBankStrategy';
import { JsonEntriesStrategy } from './jsonEntriesStrategy';
import { SqliteStrategy } from './sqliteStrategy';
import { WordlistJsonStrategy } from './wordlistJsonStrategy';
import { JsonFrequencyStrategy } from './jsonFrequencyStrategy';
import { UnsupportedFormatError } from '../logic/importErrors';
import type { BaseImportStrategy } from './baseImportStrategy';

/** Create a strategy for a format + resource type. */
export function createStrategy(
  format: ImportFormat,
  resourceType: ResourceType,
  options: StrategyOptions,
  fileData: { data: Uint8Array; fileName: string },
): BaseImportStrategy<unknown, unknown> {
  switch (format) {
    case 'txt':
      return new TxtLineStrategy(options, fileData) as unknown as BaseImportStrategy<unknown, unknown>;
    case 'json-array':
      return new JsonArrayStrategy(options, fileData) as unknown as BaseImportStrategy<unknown, unknown>;
    case 'term-bank':
      return new TermBankStrategy(options, { ...fileData, resourceType }) as unknown as BaseImportStrategy<unknown, unknown>;
    case 'sqlite':
      return new SqliteStrategy(options, { ...fileData, resourceType }) as unknown as BaseImportStrategy<unknown, unknown>;
    case 'json-entries':
      return new JsonEntriesStrategy(options, fileData) as unknown as BaseImportStrategy<unknown, unknown>;
    case 'json-frequency':
      return new JsonFrequencyStrategy(options, fileData) as unknown as BaseImportStrategy<unknown, unknown>;
    case 'wordlist-json':
      return new WordlistJsonStrategy(options, fileData) as unknown as BaseImportStrategy<unknown, unknown>;
    default:
      throw new UnsupportedFormatError(fileData.fileName, `Unknown format: ${format}`);
  }
}

/** Resolve format — JSON can be json-array OR json-entries based on resource type. */
export function resolveFormat(format: ImportFormat, resourceType: ResourceType): ImportFormat {
  if (format === 'json-array' && resourceType === 'DICTIONARY') {
    return 'json-entries';
  }
  return format;
}
