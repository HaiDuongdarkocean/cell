import { MESSAGE_TYPES } from '@/shared/config/messages';
import { OpenReaderPayloadSchema } from '@/entities/message/schema';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';

const READER_PATH = 'src/entrypoints/reader/index.html';

export function registerReaderHandlers(ctx: BackgroundContext): void {
  ctx.on(
    MESSAGE_TYPES.OPEN_READER,
    async (request): Promise<MessageResponse<{ tabId: number }>> => {
      const parsed = OpenReaderPayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return {
          success: false,
          error: `Invalid OPEN_READER payload: ${parsed.error.message}`,
        };
      }

      const url = chrome.runtime.getURL(READER_PATH);
      const fullUrl = parsed.data?.bookId
        ? `${url}?bookId=${encodeURIComponent(parsed.data.bookId)}`
        : url;

      const tab = await chrome.tabs.create({ url: fullUrl });
      if (tab.id === undefined) {
        return { success: false, error: 'Failed to create tab' };
      }
      return { success: true, data: { tabId: tab.id } };
    },
  );
}
