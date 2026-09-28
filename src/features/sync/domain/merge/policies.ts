import { compareHlc } from '../hlc';
import type { ChangeRecord, Hlc } from '../types';
import {
  compareJson,
  compareRecords,
  finiteNumber,
  isObject,
  pickWinner,
} from './compare';

export const PROFILE_EXISTENCE_KEY = 'profile';

export interface ProfileRecords {
  readonly put?: ChangeRecord | null;
  readonly tombstone?: ChangeRecord | null;
}

export interface LivePair {
  readonly local: ChangeRecord | null;
  readonly remote: ChangeRecord | null;
}

export function isDeadPut(record: ChangeRecord, tombstone: ChangeRecord | null): boolean {
  return (
    record.op === 'put' &&
    tombstone !== null &&
    compareHlc(record.hlc, tombstone.hlc) < 0
  );
}

export function suppressDeadPuts(
  local: ChangeRecord | null,
  remote: ChangeRecord,
  tombstone: ChangeRecord | null,
): LivePair {
  return {
    local: local !== null && !isDeadPut(local, tombstone) ? local : null,
    remote: isDeadPut(remote, tombstone) ? null : remote,
  };
}

export function mergeLww(local: ChangeRecord | null, remote: ChangeRecord): ChangeRecord {
  return local === null ? remote : pickWinner(local, remote);
}

export function profileRecordsOf(latestExistence: ChangeRecord | null): ProfileRecords {
  if (latestExistence === null) return {};
  return latestExistence.op === 'put' ? { put: latestExistence } : { tombstone: latestExistence };
}

export function profileExists(records: ProfileRecords | undefined): boolean {
  const put = records?.put ?? null;
  const tombstone = records?.tombstone ?? null;
  return put !== null && (tombstone === null || compareHlc(put.hlc, tombstone.hlc) > 0);
}

export function profileFieldMaterializable(
  field: ChangeRecord,
  records: ProfileRecords | undefined,
): boolean {
  if (field.op !== 'put') return false;
  const tombstone = records?.tombstone ?? null;
  if (tombstone !== null && compareHlc(field.hlc, tombstone.hlc) < 0) return false;
  return profileExists(records);
}

export function mergeProfileConfig(
  local: ChangeRecord | null,
  remote: ChangeRecord,
  records: ProfileRecords | undefined = {},
): ChangeRecord | null {
  if (remote.key === PROFILE_EXISTENCE_KEY) return mergeLww(local, remote);
  const tombstone = records?.tombstone ?? null;
  const localAlive = local !== null && !isDeadPut(local, tombstone) ? local : null;
  if (isDeadPut(remote, tombstone)) return localAlive;
  return mergeLww(localAlive, remote);
}

function bornOf(record: ChangeRecord): Hlc {
  return record.firstHlc ?? record.hlc;
}

function compareLifetime(a: ChangeRecord, b: ChangeRecord): number {
  return compareHlc(bornOf(a), bornOf(b));
}

function componentLastReviewMs(component: Record<string, unknown>): number {
  const state = component.fsrsState;
  if (!isObject(state)) return Number.NEGATIVE_INFINITY;
  const lastReview = state.lastReview;
  if (typeof lastReview !== 'string') return Number.NEGATIVE_INFINITY;
  const ms = Date.parse(lastReview);
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
}

function compareCardComponent(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): number {
  const la = componentLastReviewMs(a);
  const lb = componentLastReviewMs(b);
  if (la !== lb) return la < lb ? -1 : 1;
  const ra = finiteNumber(a.reviewCount);
  const rb = finiteNumber(b.reviewCount);
  if (ra !== rb) return ra < rb ? -1 : 1;
  return compareJson({ ...a, exploreCount: 0 }, { ...b, exploreCount: 0 });
}

function minField(a: unknown, b: unknown): unknown {
  return compareJson(a, b) <= 0 ? a : b;
}

export function mergeSrsCard(
  local: ChangeRecord | null,
  remote: ChangeRecord,
  keyTombstone: ChangeRecord | null = null,
): ChangeRecord | null {
  const pair = suppressDeadPuts(local, remote, keyTombstone);
  if (pair.remote === null) return pair.local;
  if (pair.local === null) return pair.remote;
  const aliveLocal = pair.local;
  const aliveRemote = pair.remote;
  if (aliveLocal.op !== 'put' || aliveRemote.op !== 'put') {
    return pickWinner(aliveLocal, aliveRemote);
  }
  const lifetimeOrder = compareLifetime(aliveLocal, aliveRemote);
  if (lifetimeOrder !== 0) return lifetimeOrder < 0 ? aliveRemote : aliveLocal;
  const localCard = aliveLocal.value;
  const remoteCard = aliveRemote.value;
  if (!isObject(localCard) || !isObject(remoteCard)) return pickWinner(aliveLocal, aliveRemote);
  const localComponents = isObject(localCard.components) ? localCard.components : null;
  const remoteComponents = isObject(remoteCard.components) ? remoteCard.components : null;
  if (localComponents === null || remoteComponents === null) {
    return pickWinner(aliveLocal, aliveRemote);
  }
  const carrier = pickWinner(aliveLocal, aliveRemote);
  const carrierCard = carrier === aliveLocal ? localCard : remoteCard;
  const localDue = isObject(localCard.studyAgainDue) ? localCard.studyAgainDue : {};
  const remoteDue = isObject(remoteCard.studyAgainDue) ? remoteCard.studyAgainDue : {};
  const components: Record<string, unknown> = {};
  const studyAgainDue: Record<string, unknown> = {};
  const keys = [
    ...new Set([...Object.keys(localComponents), ...Object.keys(remoteComponents)]),
  ].sort();
  for (const key of keys) {
    const rawLocal = localComponents[key];
    const rawRemote = remoteComponents[key];
    const compLocal = isObject(rawLocal) ? rawLocal : undefined;
    const compRemote = isObject(rawRemote) ? rawRemote : undefined;
    if (compLocal !== undefined && compRemote !== undefined) {
      const order = compareCardComponent(compLocal, compRemote);
      const localWins =
        order > 0 || (order === 0 && compareRecords(aliveLocal, aliveRemote) >= 0);
      const winnerComponent = localWins ? compLocal : compRemote;
      components[key] = {
        ...winnerComponent,
        exploreCount: Math.max(
          finiteNumber(compLocal.exploreCount),
          finiteNumber(compRemote.exploreCount),
        ),
      };
      studyAgainDue[key] = (localWins ? localDue : remoteDue)[key] ?? null;
    } else if (compLocal !== undefined) {
      components[key] = rawLocal;
      studyAgainDue[key] = localDue[key] ?? null;
    } else if (compRemote !== undefined) {
      components[key] = rawRemote;
      studyAgainDue[key] = remoteDue[key] ?? null;
    }
  }
  const merged = {
    ...carrierCard,
    noteId: minField(localCard.noteId, remoteCard.noteId),
    createdAt: minField(localCard.createdAt, remoteCard.createdAt),
    components,
    studyAgainDue,
  };
  return { ...carrier, value: merged };
}

export function mergeSrsReviewEvent(
  local: ChangeRecord | null,
  remote: ChangeRecord,
  keyTombstone: ChangeRecord | null = null,
): ChangeRecord | null {
  const pair = suppressDeadPuts(local, remote, keyTombstone);
  if (pair.remote === null) return pair.local;
  if (pair.local === null) return pair.remote;
  return mergeLww(pair.local, pair.remote);
}

const READ_TIME_INFIX = '/readTime/';

export function mergeReaderProgress(
  local: ChangeRecord | null,
  remote: ChangeRecord,
  keyTombstone: ChangeRecord | null = null,
): ChangeRecord | null {
  const pair = suppressDeadPuts(local, remote, keyTombstone);
  if (pair.remote === null) return pair.local;
  if (pair.local === null) return pair.remote;
  const aliveLocal = pair.local;
  const aliveRemote = pair.remote;
  if (!aliveRemote.key.includes(READ_TIME_INFIX)) return mergeLww(aliveLocal, aliveRemote);
  if (aliveLocal.op !== 'put' || aliveRemote.op !== 'put') {
    return mergeLww(aliveLocal, aliveRemote);
  }
  const lifetimeOrder = compareLifetime(aliveLocal, aliveRemote);
  if (lifetimeOrder !== 0) return lifetimeOrder < 0 ? aliveRemote : aliveLocal;
  const localMs = finiteNumber(aliveLocal.value);
  const remoteMs = finiteNumber(aliveRemote.value);
  if (localMs === remoteMs) return pickWinner(aliveLocal, aliveRemote);
  return localMs > remoteMs ? aliveLocal : aliveRemote;
}
