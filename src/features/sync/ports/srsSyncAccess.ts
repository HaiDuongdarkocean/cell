import type { SrsCollection } from '@/entities/srs/types';

export interface SrsCollectionSummary {
  readonly collection: SrsCollection;
  readonly deckIds: readonly string[];
  readonly noteCount: number;
}

export interface SrsSyncAccess {
  listCollectionSummaries(): Promise<SrsCollectionSummary[]>;
  rewriteCollectionProfileIds(remap: ReadonlyMap<string, string>): Promise<number>;
}
