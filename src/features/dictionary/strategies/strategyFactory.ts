// strategyFactory — route format → strategy (ADR-023 D3, spec F9).
//
// Format is content-detected; the strategy emits every content family the
// file contains (a term-bank zip or sqlite db can hold dictionary + frequency
// rows). `options.components` limits emission to the user's picked subset.

import type { ImportFormat } from '@/entities/dictionary';
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

/** Create a strategy for a detected format. */
export function createStrategy(
  format: ImportFormat,
  options: StrategyOptions,
  fileData: { data: Uint8Array; fileName: string; zipFiles?: Record<string, Uint8Array> },
): BaseImportStrategy<unknown, unknown> {
  switch (format) {
    case 'txt':
      return new TxtLineStrategy(options, fileData) as unknown as BaseImportStrategy<unknown, unknown>;
    case 'json-array':
      return new JsonArrayStrategy(options, fileData) as unknown as BaseImportStrategy<unknown, unknown>;
    case 'term-bank':
      return new TermBankStrategy(options, fileData) as unknown as BaseImportStrategy<unknown, unknown>;
    case 'sqlite':
      return new SqliteStrategy(options, fileData) as unknown as BaseImportStrategy<unknown, unknown>;
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
