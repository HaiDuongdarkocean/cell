export type CondensedAudioSourceKind = 'library' | 'opfs' | 'stream';

export type CondensedAudioSource =
  | { readonly kind: 'library'; readonly videoId: string }
  | { readonly kind: 'opfs'; readonly downloadId: string }
  | { readonly kind: 'stream'; readonly tabId?: number; readonly pageKey: string };

export type CondensedAudioLeg = 'file' | 'record';

export type CondensedAudioStatus =
  | 'processing'
  | 'recording'
  | 'finalizing'
  | 'ready'
  | 'failed'
  | 'missing';

export type CondensedAudioExportState = 'none' | 'done' | 'failed';

export type CondensedAudioErrorReason =
  | 'no-cues'
  | 'no-source'
  | 'capture-blocked'
  | 'encode-failed'
  | 'export-failed'
  | 'drive-failed'
  | 'cancelled'
  | 'interrupted'
  | 'input-missing'
  | 'io-failed';

export interface CondensedAudioRecord {
  readonly id: string;
  readonly title: string;
  readonly source: CondensedAudioSource;
  readonly leg: CondensedAudioLeg;
  readonly durationMs: number;
  readonly sizeBytes: number;
  readonly mimeType: string;
  readonly opfsPath: string;
  readonly exportFilename: string | null;
  readonly exportState: CondensedAudioExportState;
  readonly driveFileId: string | null;
  readonly driveSyncedAt: number | null;
  readonly status: CondensedAudioStatus;
  readonly error: CondensedAudioErrorReason | null;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface CueRange {
  readonly startMs: number;
  readonly endMs: number;
}
