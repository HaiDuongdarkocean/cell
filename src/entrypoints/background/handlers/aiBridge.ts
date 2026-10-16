/**
 * AI bridge handler — relays AI_ASK/AI_PING from extension surfaces to a
 * provider tab, driving the user's logged-in web session. On failure the
 * configured provider order is walked (REQ-8): each attempt gets its own
 * ≤90s timeout, a provider is never retried inside one chain, and 'busy'
 * means that provider's tab is serving another ask — skip, never queue.
 *
 * @source chrome.tabs.query/create/sendMessage —
 *   https://developer.chrome.com/docs/extensions/reference/api/tabs
 */
import { MESSAGE_TYPES } from '@/shared/config/messages';
import type { BackgroundContext } from '../context';
import type { MessageResponse } from '@/entities/message';
import type { AiProviderId } from '@/entities/message/dictionarySchemas';
import {
  AiAskPayloadSchema,
  AiPingPayloadSchema,
} from '@/entities/message/dictionarySchemas';
import {
  AI_PROVIDERS,
  classifyAskError,
  providerOrderFromSettings,
  resolveProviderOrder,
  type AiAskFailureKind,
  type AiProviderAdapter,
} from '@/features/aiBridge/providers';
import { createTab, queryTabs, sendTabMessage } from '@/shared/lib/chrome-apis/tabs';

const BRIDGE_READY_TIMEOUT_MS = 30_000;
const ATTEMPT_TIMEOUT_MS = 90_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface BridgePing {
  ok?: boolean;
  composer?: boolean;
  streaming?: boolean;
  url?: string;
  provider?: AiProviderId;
}

interface BridgeReply {
  success?: boolean;
  text?: string;
  error?: string;
  provider?: AiProviderId;
}

interface AskAttempt {
  provider: AiProviderId;
  error: AiAskFailureKind;
}

let askInFlight = false;
let askSeq = 0;

async function ensureBridgeTabId(adapter: AiProviderAdapter): Promise<number> {
  const tabs = await queryTabs({ url: adapter.tabUrlPatterns });
  const usable = tabs.find((t) => t.id !== undefined && !t.discarded) ?? tabs[0];
  if (usable?.id !== undefined) return usable.id;
  const created = await createTab({ url: adapter.url, active: false });
  if (created.id === undefined) throw new Error(`failed to open ${adapter.host} tab`);
  return created.id;
}

async function pingBridge(tabId: number): Promise<BridgePing | null> {
  try {
    return await sendTabMessage<BridgePing>(tabId, { type: MESSAGE_TYPES.AI_PING });
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

async function askOnProvider(
  adapter: AiProviderAdapter,
  prompt: string,
): Promise<{ ok: true; text: string } | { ok: false; error: AiAskFailureKind }> {
  try {
    const tabId = await ensureBridgeTabId(adapter);
    const ping = await awaitBridgeReady(tabId);
    if (!ping.composer) return { ok: false, error: 'loginRequired' };
    const reply = await withTimeout(
      sendTabMessage<BridgeReply>(tabId, {
        type: MESSAGE_TYPES.AI_ASK,
        payload: { prompt },
      }),
      ATTEMPT_TIMEOUT_MS,
      'AI_ASK',
    );
    if (reply?.success && reply.text) return { ok: true, text: reply.text };
    return { ok: false, error: classifyAskError(reply?.error ?? 'noAnswer') };
  } catch (err) {
    return {
      ok: false,
      error: classifyAskError(err instanceof Error ? err.message : String(err)),
    };
  }
}

export function registerAiBridgeHandlers(ctx: BackgroundContext): void {
  ctx.on(
    MESSAGE_TYPES.AI_PING,
    async (request): Promise<MessageResponse<BridgePing>> => {
      const parsed = AiPingPayloadSchema.safeParse(request.payload);
      const requested = parsed.success ? parsed.data?.provider : undefined;
      try {
        const configured = providerOrderFromSettings(await ctx.loadSettings());
        const adapter = AI_PROVIDERS[resolveProviderOrder(configured, requested)[0]];
        const tabId = await ensureBridgeTabId(adapter);
        const ping = await awaitBridgeReady(tabId);
        return { success: true, data: { ...ping, provider: adapter.id } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  );

  ctx.on(
    MESSAGE_TYPES.AI_ASK,
    async (
      request,
    ): Promise<MessageResponse<{ text: string; provider: AiProviderId } | { attempts: AskAttempt[] }>> => {
      const parsed = AiAskPayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return { success: false, error: `Invalid AI_ASK payload: ${parsed.error.message}` };
      }
      const seq = ++askSeq;
      if (askInFlight) return { success: false, error: `AI ask already in flight (seq=${seq})` };
      askInFlight = true;
      try {
        const configured = providerOrderFromSettings(await ctx.loadSettings());
        const order = resolveProviderOrder(configured, parsed.data.provider);
        const attempts: AskAttempt[] = [];
        for (const provider of order) {
          const outcome = await askOnProvider(AI_PROVIDERS[provider], parsed.data.prompt);
          if (outcome.ok) {
            return { success: true, data: { text: outcome.text, provider } };
          }
          attempts.push({ provider, error: outcome.error });
        }
        return { success: false, error: 'all_failed', data: { attempts } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      } finally {
        askInFlight = false;
      }
    },
  );
}
