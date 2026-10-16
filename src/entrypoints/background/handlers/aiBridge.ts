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
  AiStreamPayloadSchema,
} from '@/entities/message/dictionarySchemas';
import {
  AI_PROVIDERS,
  classifyAskError,
  providerOrderFromSettings,
  resolveProviderOrder,
  type AiAskFailureKind,
  type AiProviderAdapter,
} from '@/features/aiBridge/providers';
import { createTab, getTab, queryTabs, sendTabMessage, updateTab } from '@/shared/lib/chrome-apis/tabs';
import { updateWindow } from '@/shared/lib/chrome-apis/windows';

const BRIDGE_READY_TIMEOUT_MS = 30_000;
const COMPOSER_WAIT_MS = 15_000;
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
/** askId -> the popup's host tab; AI_STREAM partials from provider tabs are
 *  relayed there. Set on AI_ASK entry, cleared in its finally. */
const pendingStreams = new Map<string, number>();

async function ensureBridgeTabId(adapter: AiProviderAdapter): Promise<number> {
  const tabs = await queryTabs({ url: adapter.tabUrlPatterns });
  const usable = tabs.find((t) => t.id !== undefined && !t.discarded) ?? tabs[0];
  if (usable?.id !== undefined) return usable.id;
  const created = await createTab({ url: adapter.url, active: false });
  if (created.id === undefined) throw new Error(`failed to open ${adapter.host} tab`);
  return created.id;
}

/** Surface the provider tab only when the user must act on it (login/challenge). */
async function focusBridgeTab(tabId: number): Promise<void> {
  const tab = await getTab(tabId).catch(() => null);
  if (!tab) return;
  await updateTab(tabId, { active: true }).catch(() => {});
  if (tab.windowId !== undefined) {
    await updateWindow(tab.windowId, { state: 'normal' }).catch(() => {});
    await updateWindow(tab.windowId, { focused: true }).catch(() => {});
  }
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

/** A freshly created background tab answers the ping before its SPA mounts
 *  the composer — keep polling until it appears, the URL proves a login
 *  wall, or the grace window runs out. */
async function awaitComposer(
  tabId: number,
  adapter: AiProviderAdapter,
  seed: BridgePing,
): Promise<BridgePing> {
  const deadline = Date.now() + COMPOSER_WAIT_MS;
  let ping = seed;
  while (!ping.composer) {
    const url = ping.url;
    if (url && adapter.loginUrlPatterns?.some((p) => url.includes(p))) break;
    if (Date.now() >= deadline) break;
    await sleep(750);
    ping = (await pingBridge(tabId)) ?? ping;
  }
  return ping;
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
  askId?: string,
): Promise<{ ok: true; text: string } | { ok: false; error: AiAskFailureKind; loginTabId?: number }> {
  try {
    const tabId = await ensureBridgeTabId(adapter);
    const ping = await awaitComposer(tabId, adapter, await awaitBridgeReady(tabId));
    if (!ping.composer) return { ok: false, error: 'loginRequired', loginTabId: tabId };
    const reply = await withTimeout(
      sendTabMessage<BridgeReply>(tabId, {
        type: MESSAGE_TYPES.AI_ASK,
        payload: { prompt, askId },
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
      const { prompt, askId } = parsed.data;
      const streamTab = parsed.data.tabId;
      if (askId !== undefined && streamTab !== undefined) {
        pendingStreams.set(askId, streamTab);
      }
      try {
        const configured = providerOrderFromSettings(await ctx.loadSettings());
        const order = resolveProviderOrder(configured, parsed.data.provider);
        const attempts: AskAttempt[] = [];
        let loginTabId: number | undefined;
        for (const provider of order) {
          const outcome = await askOnProvider(AI_PROVIDERS[provider], prompt, askId);
          if (outcome.ok) {
            return { success: true, data: { text: outcome.text, provider } };
          }
          if (outcome.error === 'loginRequired' && loginTabId === undefined) {
            loginTabId = outcome.loginTabId;
          }
          attempts.push({ provider, error: outcome.error });
        }
        if (loginTabId !== undefined) void focusBridgeTab(loginTabId);
        return { success: false, error: 'all_failed', data: { attempts } };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      } finally {
        askInFlight = false;
        if (askId !== undefined) pendingStreams.delete(askId);
      }
    },
  );

  ctx.on(
    MESSAGE_TYPES.AI_STREAM,
    async (request): Promise<MessageResponse> => {
      const parsed = AiStreamPayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return { success: false, error: `Invalid AI_STREAM payload: ${parsed.error.message}` };
      }
      const tabId = pendingStreams.get(parsed.data.askId);
      if (tabId !== undefined) {
        await sendTabMessage(tabId, {
          type: MESSAGE_TYPES.AI_STREAM,
          payload: parsed.data,
        }).catch(() => {});
      }
      return { success: true };
    },
  );
}
