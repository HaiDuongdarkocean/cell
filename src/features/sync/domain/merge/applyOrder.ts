import { compareHlc } from '../hlc';
import type { ChangeRecord, DataClass } from '../types';

export const DATA_CLASS_APPLY_ORDER: readonly DataClass[] = [
  'syncDirectory',
  'settings',
  'secondaryKey',
  'profileConfig',
  'studyConfig',
  'srsCollection',
  'srsVariantPreset',
  'srsNotetype',
  'srsDeck',
  'srsNote',
  'srsAudioAsset',
  'srsImageAsset',
  'srsCard',
  'srsReviewEvent',
  'dictResource',
  'wordStatus',
  'readerBook',
  'readerProgress',
];

const CLASS_RANK = new Map<DataClass, number>(
  DATA_CLASS_APPLY_ORDER.map((dataClass, index) => [dataClass, index]),
);

function classRank(dataClass: DataClass): number {
  return CLASS_RANK.get(dataClass) ?? DATA_CLASS_APPLY_ORDER.length;
}

function recordRank(record: ChangeRecord): number {
  return record.key.includes('/') ? 1 : 0;
}

export function compareApplyOrder(a: ChangeRecord, b: ChangeRecord): number {
  const byClass = classRank(a.dataClass) - classRank(b.dataClass);
  if (byClass !== 0) return byClass;
  const byKey = recordRank(a) - recordRank(b);
  if (byKey !== 0) return byKey;
  if (a.key !== b.key) return a.key < b.key ? -1 : 1;
  return compareHlc(a.hlc, b.hlc);
}

export function sortRecordsForApply(records: readonly ChangeRecord[]): ChangeRecord[] {
  return [...records].sort(compareApplyOrder);
}
