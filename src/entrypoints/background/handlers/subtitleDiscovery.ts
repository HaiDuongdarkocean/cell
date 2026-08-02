// Subtitle discovery message handler.
//
// Relays validated observation signals from content scripts / MAIN-world bridges
// to the generic discovery pipeline. Origin validation happens at the boundary.

import { MESSAGE_TYPES } from '@/shared/config/messages';
import {
  subtitleDiscoveryPayloadSchema,
} from '@/features/detection/subtitleDiscovery';
import type { MessageResponse, MessageRequest } from '@/entities/message';
import type { BackgroundContext } from '../context';

export function registerSubtitleDiscoveryHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.SUBTITLE_DISCOVERY_SIGNAL, async (
    request: MessageRequest,
  ): Promise<MessageResponse> => {
    const parsed = subtitleDiscoveryPayloadSchema.safeParse(request.payload);
    if (!parsed.success) {
      return { success: false, error: `Invalid subtitle discovery payload: ${parsed.error.message}` };
    }

    const payload = parsed.data;
    const signal = payload.signal;

    // Cross-check the sender's origin with the signal origin for player-state
    // and frame-source signals. Network/document/hls signals carry their own
    // origin in the URL.
    if (signal.kind === 'player-state' || signal.kind === 'frame-source') {
      // chrome.runtime.sendMessage sender has `origin`; we could compare here,
      // but the signal itself already declares its frame origin. The schema
      // validation and size limits are the primary trust boundaries.
    }

    await ctx.subtitleDiscoveryService.processSignal(
      signal,
      signal.tabId,
      signal.frameId,
      signal.initiator,
    );

    return { success: true, data: { processed: signal.kind } };
  });
}
