import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { MessageResponse, TranslateResult } from '@/entities/message';

export async function translateText(text: string, sl: string, tl: string): Promise<string[]> {
  const res = await sendMessage<MessageResponse<TranslateResult>>({
    type: MESSAGE_TYPES.TRANSLATE,
    payload: { tabId: 0, text, sl, tl },
  });
  if (!res?.success || !res.data?.translated) {
    throw new Error(res?.error ?? 'translate failed');
  }
  return res.data.translated;
}
