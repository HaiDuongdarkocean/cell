/**
 * Screenshot handler — CAPTURE_TAB_SCREENSHOT.
 *
 * Content-script asks background to capture the visible tab via
 * `chrome.tabs.captureVisibleTab`. This bypasses canvas taint on cross-origin
 * videos (e.g. kisskh.co CDN) where `canvas.drawImage(video)` + `toBlob`
 * returns null because the video lacks CORS headers.
 *
 * Returns a PNG data URL (base64). The caller converts it to an ArrayBuffer.
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import { t } from '@/shared/i18n';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import { EmptyPayloadSchema } from '@/entities/message/schema';

/** Response: PNG data URL from captureVisibleTab. */
export interface CaptureTabScreenshotResult {
  readonly dataUrl: string;
}

/** Register the screenshot handler. */
export function registerScreenshotHandlers(ctx: BackgroundContext): void {
  ctx.on(
    MESSAGE_TYPES.CAPTURE_TAB_SCREENSHOT,
    async (request): Promise<MessageResponse<CaptureTabScreenshotResult>> => {
      const parsed = EmptyPayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return { success: false, error: `Invalid CAPTURE_TAB_SCREENSHOT payload: ${parsed.error.message}` };
      }
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(chrome.windows.WINDOW_ID_CURRENT, { format: 'png' });
        return { success: true, data: { dataUrl } };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: t('media.error.capture', [msg]) };
      }
    },
  );
}
