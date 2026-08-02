// Generic subtitle-list discovery contracts (ADR-NNN: protocol-oriented pipeline).
//
// Separates observation signals, candidate states, adapter contracts, and replay context.
// Candidates carry enough metadata to be replayed through the extension without losing
// language, format, frame, initiator, or auth context.

import type { DetectedSubtitle, SubtitleFormat } from '@/entities/media';

export type SubtitleSignalKind =
  | 'network-response'
  | 'frame-source'
  | 'player-state'
  | 'document-html'
  | 'hls-playlist';

export type SubtitleSignal =
  | NetworkResponseSignal
  | FrameSourceSignal
  | PlayerStateSignal
  | DocumentHtmlSignal
  | HlsPlaylistSignal;

export interface NetworkResponseSignal {
  readonly kind: 'network-response';
  readonly url: string;
  readonly body: string;
  readonly tabId: number;
  readonly frameId: number;
  readonly initiator?: string;
  readonly method?: string;
  readonly type?: string;
  readonly headers?: Record<string, string>;
}

export interface FrameSourceSignal {
  readonly kind: 'frame-source';
  readonly frameUrl: string;
  readonly ownerUrl: string;
  readonly tabId: number;
  readonly frameId: number;
  readonly initiator?: string;
}

export interface PlayerStateSignal {
  readonly kind: 'player-state';
  readonly origin: string;
  readonly payload: unknown;
  readonly tabId: number;
  readonly frameId: number;
  readonly initiator?: string;
  readonly playerKey: string;
}

export interface DocumentHtmlSignal {
  readonly kind: 'document-html';
  readonly url: string;
  readonly html: string;
  readonly tabId: number;
  readonly frameId: number;
  readonly initiator?: string;
}

export interface HlsPlaylistSignal {
  readonly kind: 'hls-playlist';
  readonly url: string;
  readonly body: string;
  readonly tabId: number;
  readonly frameId: number;
  readonly initiator?: string;
  readonly playlistType: 'master' | 'media';
}

export type SubtitleCandidateStatus = 'ready' | 'unresolved' | 'expired' | 'rejected';

export type SubtitleSourceKind = 'direct' | 'relative' | 'metadata';

export interface SubtitleReplayContext {
  readonly origin: string;
  readonly referer?: string;
  readonly initiator?: string;
  readonly credentials?: RequestCredentials;
  readonly tabUrl?: string;
  readonly frameUrl?: string;
  readonly token?: string;
}

export interface SubtitleDiscoveryContext {
  readonly tabId: number;
  readonly frameId: number;
  readonly origin: string;
  readonly initiator?: string;
  readonly tabUrl?: string;
  readonly frameUrl?: string;
  readonly timestamp: number;
}

export interface SubtitleMetadataHandle {
  readonly provider: string;
  readonly providerId: string;
  readonly language: string;
  readonly label: string;
  readonly extra?: Record<string, unknown>;
}

export interface SubtitleCandidate {
  readonly id: string;
  readonly label: string;
  readonly language: string;
  readonly format: SubtitleFormat;
  readonly source: SubtitleSourceKind;
  readonly url?: string;
  readonly baseUrl?: string;
  readonly metadata?: SubtitleMetadataHandle;
  readonly status: SubtitleCandidateStatus;
  readonly identity: string;
  readonly provider?: string;
  readonly default?: boolean;
  readonly forced?: boolean;
  readonly sdh?: boolean;
  readonly asr?: boolean;
  readonly tabId: number;
  readonly frameId: number;
  readonly initiator?: string;
  readonly replayContext: SubtitleReplayContext;
  readonly rejectReason?: string;
}

export interface SubtitleDiscoveryResult {
  readonly ready: readonly SubtitleCandidate[];
  readonly unresolved: readonly SubtitleCandidate[];
  readonly rejected: readonly SubtitleCandidate[];
}

export interface SubtitleDiscoveryAdapter {
  readonly id: string;
  readonly priority: number;
  match(signal: SubtitleSignal): boolean;
  discover(
    signal: SubtitleSignal,
    context: SubtitleDiscoveryContext,
    env: SubtitleDiscoveryEnvironment,
  ): Promise<readonly SubtitleCandidate[]>;
}

export interface SubtitleDiscoveryEnvironment {
  readonly fetchText: (url: string, context: SubtitleReplayContext) => Promise<FetchTextResult>;
  readonly resolveUrl: (base: string, relative: string) => string;
  readonly now: () => number;
}

export interface FetchTextResult {
  readonly ok: boolean;
  readonly status: number;
  readonly content: string;
  readonly finalUrl: string;
}

export interface SubtitleInventorySink {
  add(subtitles: readonly DetectedSubtitle[]): number;
  addUnresolved?(candidates: readonly SubtitleCandidate[]): void;
}

export interface SubtitlePipelineStats {
  readonly processed: number;
  readonly ready: number;
  readonly unresolved: number;
  readonly rejected: number;
  readonly duplicate: number;
}
