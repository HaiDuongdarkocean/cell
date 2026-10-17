import { MESSAGE_TYPES } from '@/shared/config/messages';
import { OpenReaderPayloadSchema } from '@/entities/message/schema';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import { openExtensionTab } from '../helpers/broadcast';

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

      const tabId = await openExtensionTab(
        READER_PATH,
        parsed.data?.bookId ? { bookId: parsed.data.bookId } : undefined,
      );
      if (tabId === undefined) {
        return { success: false, error: 'Failed to create tab' };
      }
      return { success: true, data: { tabId } };
    },
  );
}
