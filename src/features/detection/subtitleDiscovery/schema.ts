// Zod schemas for subtitle discovery signals and message payloads.
//
// Every external observation enters as `unknown` and is validated before it becomes
// a typed signal. Size limits prevent oversized/buggy payloads from reaching the pipeline.

import { z } from 'zod';

const MAX_NETWORK_BODY = 2_000_000; // 2 MB
const MAX_HTML_BODY = 1_000_000; // 1 MB
const MAX_HLS_BODY = 500_000; // 500 KB

const tabIdSchema = z.number().int().min(0);
const frameIdSchema = z.number().int().min(0);

const originSchema = z
  .string()
  .min(1)
  .refine((val) => {
    try {
      const u = new URL(val);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'origin must be a valid http(s) URL');

export const networkResponseSignalSchema = z.object({
  kind: z.literal('network-response'),
  url: z.string().min(1).max(8192),
  body: z.string().max(MAX_NETWORK_BODY),
  tabId: tabIdSchema,
  frameId: frameIdSchema,
  initiator: z.string().optional(),
  method: z.string().max(16).optional(),
  type: z.string().max(32).optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

export const frameSourceSignalSchema = z.object({
  kind: z.literal('frame-source'),
  frameUrl: z.string().min(1).max(8192),
  ownerUrl: z.string().min(1).max(8192),
  tabId: tabIdSchema,
  frameId: frameIdSchema,
  initiator: z.string().optional(),
});

export const playerStateSignalSchema = z.object({
  kind: z.literal('player-state'),
  origin: originSchema,
  payload: z.unknown(),
  tabId: tabIdSchema,
  frameId: frameIdSchema,
  initiator: z.string().optional(),
  playerKey: z.string().min(1).max(256),
});

export const documentHtmlSignalSchema = z.object({
  kind: z.literal('document-html'),
  url: z.string().min(1).max(8192),
  html: z.string().max(MAX_HTML_BODY),
  tabId: tabIdSchema,
  frameId: frameIdSchema,
  initiator: z.string().optional(),
});

export const hlsPlaylistSignalSchema = z.object({
  kind: z.literal('hls-playlist'),
  url: z.string().min(1).max(8192),
  body: z.string().max(MAX_HLS_BODY),
  tabId: tabIdSchema,
  frameId: frameIdSchema,
  initiator: z.string().optional(),
  playlistType: z.enum(['master', 'media']),
});

export const subtitleSignalSchema = z.union([
  networkResponseSignalSchema,
  frameSourceSignalSchema,
  playerStateSignalSchema,
  documentHtmlSignalSchema,
  hlsPlaylistSignalSchema,
]);

export const subtitleDiscoveryPayloadSchema = z.object({
  nonce: z.string().min(16).max(256),
  origin: originSchema,
  signal: subtitleSignalSchema,
});

export const subtitleDiscoveryBridgePayloadSchema = z.object({
  type: z.literal('__CELL_SUBTITLE_DISCOVERY'),
  nonce: z.string().min(16).max(256),
  signal: subtitleSignalSchema,
});

export type ValidatedNetworkResponseSignal = z.infer<typeof networkResponseSignalSchema>;
export type ValidatedFrameSourceSignal = z.infer<typeof frameSourceSignalSchema>;
export type ValidatedPlayerStateSignal = z.infer<typeof playerStateSignalSchema>;
export type ValidatedDocumentHtmlSignal = z.infer<typeof documentHtmlSignalSchema>;
export type ValidatedHlsPlaylistSignal = z.infer<typeof hlsPlaylistSignalSchema>;
export type ValidatedSubtitleSignal = z.infer<typeof subtitleSignalSchema>;
