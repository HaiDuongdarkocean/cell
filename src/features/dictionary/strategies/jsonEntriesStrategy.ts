// jsonEntriesStrategy — entry-object JSON dictionary (ADR-023 D3, spec F9).
//
// JSON array [{term, altterm, pronunciation, definition, pos, examples, audio}, ...].
// Two streamed passes — count objects, then parse + yield — so a 170MB file
// keeps memory at one chunk + one entry instead of a decoded string + graph.

import { BaseDictionaryStrategy } from './baseImportStrategy';
import type { StrategyOptions, StrategyResult, RawDictionaryEntry } from './baseImportStrategy';
import { pickDataJsonPath } from '../logic/formatDetector';
import {
  readAllText,
  resolveImportSource,
  streamByteSource,
  streamTextChunks,
  zipEntryBytes,
  type ImportSourceInput,
} from '../logic/importStreams';
import { iterJsonArrayElements } from '../logic/jsonElementScanner';
import { MalformedJsonArrayError } from '../logic/jsonObjectScanner';
import type { ScannedElement } from '../logic/jsonElementScanner';
import type { ReadableFile } from '../logic/fileDetector';
import { ParseError } from '../logic/importErrors';
import { bulkInsertDictionaryEntries } from '../repositories/resourceEntryRepository';
import type { DictionaryEntry, SenseBlock, RelatedEntry, InflectionGroup, EtymologyBlock, WordFamily, WordNetInfo, PronunciationAccent } from '@/entities/dictionary';

/** Entry-object JSON shape. `senses` is present on pre-normalized files
 *  (tihoka-convert-dictionary script output) and passes through verbatim —
 *  same for the canonical entry-level fields below. */
interface JsonEntry {
  readonly term: string;
  readonly altterm?: string;
  readonly pronunciation?: string;
  readonly definition?: string;
  readonly senses?: SenseBlock[];
  readonly pos?: string;
  readonly prons?: PronunciationAccent[];
  readonly examples?: string;
  readonly audio?: string;
  readonly related?: RelatedEntry[];
  readonly inflections?: InflectionGroup[];
  readonly level?: string;
  readonly frequencyStars?: number;
  readonly etymology?: EtymologyBlock;
  readonly wordFamily?: WordFamily;
  readonly wordNet?: WordNetInfo;
  readonly derivedTerms?: string[];
  readonly anagrams?: string[];
}

const MULTIWORD_RE = /\s/;

/** Kept for the existing import surface. */
export type JsonEntriesStrategyOptions = ImportSourceInput;

/** entry-object JSON dictionary strategy. */
export class JsonEntriesStrategy extends BaseDictionaryStrategy {
  readonly format = 'json-entries' as const;
  private readonly fileData: ImportSourceInput;
  private readonly phraseTermSet = new Set<string>();

  constructor(options: StrategyOptions, fileData: ImportSourceInput) {
    super(options);
    this.fileData = fileData;
  }

  protected override transformEntry(raw: RawDictionaryEntry, _index: number): Omit<DictionaryEntry, 'id'> | null {
    const stored = super.transformEntry(raw, _index);
    if (stored !== null && MULTIWORD_RE.test(stored.term)) {
      this.phraseTermSet.add(stored.term);
    }
    return stored;
  }

  protected override resultExtras(): Partial<StrategyResult> {
    return { phraseTerms: [...this.phraseTermSet] };
  }

  protected async *parse(): AsyncGenerator<RawDictionaryEntry> {
    const { file, manifest } = await resolveImportSource(this.fileData);
    // Pass 1: count top-level objects (exact total upfront, same as the old
    // range-collecting scan). Top-level array elements stay rejected as before.
    let total = 0;
    try {
      for await (const el of this.elements(file, manifest)) {
        if (el.kind === 'array') {
          throw new ParseError('entry-object JSON: invalid JSON.');
        }
        if (el.kind === 'object') total++;
      }
    } catch (e) {
      if (e instanceof ParseError) throw e;
      if (e instanceof MalformedJsonArrayError) {
        throw await this.classifyMalformed(file, manifest, e);
      }
      throw e;
    }
    this.reportTotal(total);

    for await (const el of this.elements(file, manifest)) {
      if (el.kind !== 'object') continue;
      let entry: JsonEntry;
      try {
        entry = JSON.parse(el.text) as JsonEntry;
      } catch (e) {
        throw new ParseError('entry-object JSON: invalid JSON.', e);
      }
      if (!entry || typeof entry !== 'object' || !entry.term) continue;
      yield {
        term: entry.term,
        altterm: entry.altterm ?? '',
        pronunciation: entry.pronunciation ?? '',
        definition: entry.definition ?? '',
        senses: Array.isArray(entry.senses) ? entry.senses : undefined,
        pos: entry.pos ?? '',
        prons: Array.isArray(entry.prons) ? entry.prons : undefined,
        examples: entry.examples ?? '',
        audio: entry.audio ?? '',
        related: Array.isArray(entry.related) ? entry.related : undefined,
        inflections: Array.isArray(entry.inflections) ? entry.inflections : undefined,
        level: entry.level,
        frequencyStars: entry.frequencyStars,
        etymology: entry.etymology,
        wordFamily: entry.wordFamily,
        wordNet: entry.wordNet,
        derivedTerms: Array.isArray(entry.derivedTerms) ? entry.derivedTerms : undefined,
        anagrams: Array.isArray(entry.anagrams) ? entry.anagrams : undefined,
      };
    }
  }

  private byteSource(
    file: ReadableFile,
    manifest: Record<string, Uint8Array> | null,
  ): AsyncGenerator<Uint8Array> {
    return manifest === null
      ? streamByteSource(file)
      : zipEntryBytes(file, pickDataJsonPath(manifest, 'entry-object JSON'));
  }

  private elements(
    file: ReadableFile,
    manifest: Record<string, Uint8Array> | null,
  ): AsyncGenerator<ScannedElement> {
    return iterJsonArrayElements(streamTextChunks(this.byteSource(file, manifest)));
  }

  /** Malformed input parity with the old whole-text path: a doc that parses
   *  as JSON but isn't an array gets "expected array"; anything else gets
   *  "invalid JSON". Error path only — safe to re-read the source. */
  private async classifyMalformed(
    file: ReadableFile,
    manifest: Record<string, Uint8Array> | null,
    cause: MalformedJsonArrayError,
  ): Promise<ParseError> {
    if (!cause.message.startsWith("expected '['")) {
      return new ParseError('entry-object JSON: invalid JSON.', cause);
    }
    try {
      JSON.parse(await readAllText(this.byteSource(file, manifest)));
    } catch (e) {
      return new ParseError('entry-object JSON: invalid JSON.', e);
    }
    return new ParseError('entry-object JSON: expected array of entries.', cause);
  }

  protected async flushBatch(batch: ReadonlyArray<Omit<DictionaryEntry, 'id'>>): Promise<void> {
    await bulkInsertDictionaryEntries(this.options.langCode, batch);
  }
}
