/**
 * AI bridge handler — PoC. Relays AI_ASK/AI_PING from extension surfaces
 * to the ChatGPT tab, driving the user's logged-in web session.
 *
 * @source chrome.tabs.query/create/sendMessage —
 *   https://developer.chrome.com/docs/extensions/reference/api/tabs
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import { AiAskPayloadSchema } from '@/entities/message/dictionarySchemas';
import { createTab, queryTabs, sendTabMessage } from '@/shared/lib/chrome-apis/tabs';

const CHATGPT_URL = 'https://chatgpt.com/';
const BRIDGE_READY_TIMEOUT_MS = 30_000;
const ASK_TIMEOUT_MS = 120_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface BridgePing {
  ok?: boolean;
  composer?: boolean;
  streaming?: boolean;
  url?: string;
}

interface BridgeReply {
  success?: boolean;
  text?: string;
  error?: string;
}

let askInFlight = false;
let askSeq = 0;

async function ensureBridgeTabId(): Promise<number> {
  const tabs = await queryTabs({ url: 'https://chatgpt.com/*' });
  const usable = tabs.find((t) => t.id !== undefined && !t.discarded) ?? tabs[0];
  if (usable?.id !== undefined) return usable.id;
  const created = await createTab({ url: CHATGPT_URL, active: false });
  if (created.id === undefined) throw new Error('failed to open chatgpt.com tab');
  return created.id;
}

async function pingBridge(tabId: number): Promise<BridgePing | null> {
  try {
    return await sendTabMessage<BridgePing>(tabId, { type: 'AI_PING' });
  } catch {
    return null;
  }
}

async function awaitBridgeReady(tabId: number): Promise<BridgePing> {
  const deadline = Date.now() + BRIDGE_READY_TIMEOUT_MS;
  for (;;) {
    const ping = await pingBridge(tabId);
    if (ping?.ok) return ping;
    if (Date.now() >= deadline) throw new Error('bridge tab not ready (still loading or script missing)');
    await sleep(1_000);
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    sleep(ms).then(() => {
      throw new Error(`${label} timeout`);
    }),
  ]);
}

export function registerAiBridgeHandlers(ctx: BackgroundContext): void {
  ctx.on(MESSAGE_TYPES.AI_PING, async (): Promise<MessageResponse<BridgePing>> => {
    try {
      const tabId = await ensureBridgeTabId();
      const ping = await awaitBridgeReady(tabId);
      return { success: true, data: ping };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ctx.on(
    MESSAGE_TYPES.AI_ASK,
    async (request): Promise<MessageResponse<{ text: string }>> => {
      const parsed = AiAskPayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return { success: false, error: `Invalid AI_ASK payload: ${parsed.error.message}` };
      }
      const seq = ++askSeq;
      if (askInFlight) return { success: false, error: `AI ask already in flight (seq=${seq})` };
      askInFlight = true;
      try {
        const tabId = await ensureBridgeTabId();
        const ping = await awaitBridgeReady(tabId);
        if (!ping.composer) {
          return { success: false, error: 'chatgpt.com shows no composer — log in first' };
        }
        const reply = await withTimeout(
          sendTabMessage<BridgeReply>(tabId, {
            type: MESSAGE_TYPES.AI_ASK,
            payload: { prompt: parsed.data.prompt },
          }),
          ASK_TIMEOUT_MS,
          'AI_ASK',
        );
        if (reply?.success && reply.text) return { success: true, data: { text: reply.text } };
        return { success: false, error: reply?.error ?? 'no reply from bridge' };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      } finally {
        askInFlight = false;
      }
    },
  );
}
