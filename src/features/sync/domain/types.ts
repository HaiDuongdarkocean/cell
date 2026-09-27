export type ProviderId = string;

export type AccountKey = string;

export type ConnectionId = `${ProviderId}:${AccountKey}`;

export type Scope = 'global' | `profile:${string}`;

export type ProfileId = `profile-${string}`;

export type RecordKey = string;

export type DataClass =
  | 'settings'
  | 'secondaryKey'
  | 'syncDirectory'
  | 'profileConfig'
  | 'studyConfig'
  | 'srsCollection'
  | 'srsDeck'
  | 'srsNotetype'
  | 'srsNote'
  | 'srsCard'
  | 'srsReviewEvent'
  | 'srsAudioAsset'
  | 'srsImageAsset'
  | 'dictResource'
  | 'wordStatus'
  | 'readerBook'
  | 'readerProgress';

export interface Hlc {
  wall: number;
  counter: number;
  node: string;
}

export type ChangeOp = 'put' | 'delete';

export interface ChangeRecord {
  scope: Scope;
  dataClass: DataClass;
  key: RecordKey;
  op: ChangeOp;
  value?: unknown;
  hlc: Hlc;
  firstHlc?: Hlc;
}

export interface PendingKey {
  scope: Scope;
  dataClass: DataClass;
  key: RecordKey;
  op: ChangeOp;
}

export interface RecordMeta {
  hlc: Hlc;
  firstHlc?: Hlc;
  op: ChangeOp;
  valueHash?: string;
}

export interface Connection {
  connectionId: ConnectionId;
  providerId: ProviderId;
  accountKey: AccountKey;
  displayName: string;
}

export interface Cursor {
  snapshotN: number;
  seq: number;
}
