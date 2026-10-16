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
import type { ImportSourceInput } from '../logic/importStreams';
import type { BaseImportStrategy } from './baseImportStrategy';

/** What a strategy receives: a streamable `file`/`data` source plus the
 *  orchestrator's pass-1 zip manifest when the source is a zip. `zipFiles`
 *  stays supported for callers that already inflated the container. */
export interface StrategyFileData extends ImportSourceInput {
  readonly zipFiles?: Record<string, Uint8Array>;
}

/** Create a strategy for a detected format. */
export function createStrategy(
  format: ImportFormat,
  options: StrategyOptions,
  fileData: StrategyFileData,
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
