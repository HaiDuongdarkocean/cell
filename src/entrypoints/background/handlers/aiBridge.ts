/**
 * AI bridge handler — relays AI_ASK/AI_PING from extension surfaces to a
 * provider tab, driving the user's logged-in web session. The picked (or
 * configured default) provider is the only one asked — no automatic
 * failover; failure surfaces to the popup where the user retries or
 * switches source manually. 'busy' means that provider's tab is serving
 * another ask.
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
  AiCancelPayloadSchema,
  AiOpenProviderPayloadSchema,
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
import { createTab, getTab, queryTabs, reloadTab, sendTabMessage, updateTab } from '@/shared/lib/chrome-apis/tabs';
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
/** askId of the chain currently holding the askInFlight slot — a new ask
 *  with a different askId supersedes it (cancel + unwind) instead of being
 *  rejected. */
let currentAskId: string | undefined;
/** askIds whose chains must abort — a superseded chain can be stuck in
 *  bridge setup (tab create/composer wait) where the page-side cancel
 *  can't reach; each awaitable step re-checks and exits early. */
const abortedAskIds = new Set<string>();
/** askId -> the popup's host tab; AI_STREAM partials from provider tabs are
 *  relayed there. Set on AI_ASK entry, cleared in its finally. */
const pendingStreams = new Map<string, number>();
/** askIds that produced at least one AI_STREAM partial — the provider page
 *  is alive and generating, so the no-response window does not apply. */
const streamedAsks = new Set<string>();
/** No reply AND no stream partial within this window → page is treated as
 *  wedged and the recovery ladder runs. Streaming extends to the full cap. */
const REPLY_WINDOW_MS = 30_000;

/** Debug ring buffer — read via sw.evaluate(() => globalThis.__aiBridgeLog). */
const g = globalThis as Record<string, unknown>;
g.__aiBridgeLog ??= [];
const DBG = g.__aiBridgeLog as string[];
const dbg = (msg: string): void => {
  DBG.push(`${((Date.now() / 1000) % 1000).toFixed(1)} ${msg}`);
  if (DBG.length > 60) DBG.shift();
};

/** Broadcast AI_CANCEL to every provider bridge tab — the live one resolves
 *  its in-flight wait with 'cancelled' and clicks the page's stop button.
 *  askId scopes the kill so a stale broadcast can't hit a newer ask. */
async function broadcastCancel(askId?: string, provider?: AiProviderId): Promise<void> {
  const adapters = Object.values(AI_PROVIDERS).filter(
    (a) => provider === undefined || a.id === provider,
  );
  for (const adapter of adapters) {
    const tabs = await queryTabs({ url: adapter.tabUrlPatterns }).catch(() => []);
    for (const tab of tabs) {
      if (tab.id === undefined) continue;
      void sendTabMessage(tab.id, {
        type: MESSAGE_TYPES.AI_CANCEL,
        payload: { askId, provider },
      }).catch(() => {});
    }
  }
}

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
    // A dead/stale content script can leave the message pending forever —
    // no rejection, no reply. Without a cap the whole ask chain wedges at
    // awaitBridgeReady before its deadline checks ever run.
    return await Promise.race([
      sendTabMessage<BridgePing>(tabId, { type: MESSAGE_TYPES.AI_PING }),
      sleep(3_000).then(() => null),
    ]);
  } catch {
    return null;
  }
}

async function awaitBridgeReady(tabId: number): Promise<BridgePing> {
  const deadline = Date.now() + BRIDGE_READY_TIMEOUT_MS;
  // 'complete' + no ping must persist briefly before it counts as a stale
  // content script — right after a reload/navigation the status still reads
  // 'complete' for a beat while the new page (and its bridge) come up.
  let staleSince: number | undefined;
  for (;;) {
    const ping = await pingBridge(tabId);
    if (ping?.ok) return ping;
    const tab = await getTab(tabId).catch(() => null);
    if (!tab) throw new Error('bridge tab gone');
    const stale = tab.status === 'complete';
    staleSince = stale ? (staleSince ?? Date.now()) : undefined;
    if (staleSince !== undefined && Date.now() - staleSince > 2_000) {
      throw new Error('bridge script missing (stale page)');
    }
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

type AskOutcome =
  | { ok: true; text: string }
  | { ok: false; error: AiAskFailureKind; loginTabId?: number };

const classifyErr = (e: unknown): AskOutcome => ({
  ok: false,
  error: classifyAskError(e instanceof Error ? e.message : String(e)),
});

async function askOnProvider(
  adapter: AiProviderAdapter,
  prompt: string,
  askId?: string,
): Promise<AskOutcome> {
  const isAborted = () => askId !== undefined && abortedAskIds.has(askId);
  let tabId: number;
  try {
    tabId = await ensureBridgeTabId(adapter);
  } catch (err) {
    return { ok: false, error: classifyAskError(err instanceof Error ? err.message : String(err)) };
  }
  try {
    const sendOnce = async (): Promise<BridgeReply | null> => {
      const t0 = Date.now();
      const settled = sendTabMessage<BridgeReply>(tabId, {
        type: MESSAGE_TYPES.AI_ASK,
        payload: { prompt, askId },
      })
        .then((r) => ({ r }))
        .catch(() => ({ r: null }));
      for (;;) {
        // 30s with zero activity = wedged page; a stream partial means the
        // provider is generating and gets the full cap instead.
        const streaming = askId !== undefined && streamedAsks.has(askId);
        const cap = streaming ? ATTEMPT_TIMEOUT_MS : REPLY_WINDOW_MS;
        const left = cap - (Date.now() - t0);
        if (left <= 0) return null;
        const res = (await Promise.race([settled, sleep(Math.min(left, 500))])) as
          | { r: BridgeReply | null }
          | undefined;
        if (res) return res.r;
      }
    };
    const attempt = async (): Promise<
      { ok: true; text: string } | { ok: false; error: AiAskFailureKind }
    > => {
      const reply = await sendOnce();
      if (reply?.success && reply.text) return { ok: true, text: reply.text };
      return { ok: false, error: classifyAskError(reply?.error ?? 'noAnswer') };
    };
    // Setup lives inside round() — a stale bridge CS (extension reloaded,
    // page not) throws here and still flows through the recovery ladder.
    const round = async (): Promise<AskOutcome> => {
      if (isAborted()) return { ok: false, error: 'cancelled' };
      const ping = await awaitComposer(tabId, adapter, await awaitBridgeReady(tabId));
      if (isAborted()) return { ok: false, error: 'cancelled' };
      if (!ping.composer) return { ok: false, error: 'loginRequired', loginTabId: tabId };
      return attempt();
    };

    let outcome = await round().catch(classifyErr);
    // 'busy' right after a cancelled ask is transient — the provider page is
    // still unwinding its stopped generation. One grace retry absorbs it.
    if (!outcome.ok && outcome.error === 'busy') {
      await sleep(1_500);
      outcome = await round().catch(classifyErr);
    }
    // Recovery ladder — a page that never answered (dead bridge CS, dropped
    // prompt, silent timeout): 1) reload the bridge tab, 2) start a new
    // conversation in it. busy/loginRequired/rateLimit/cancelled mean the
    // page is alive and answerable — no recovery value.
    const recoverable = (e: AiAskFailureKind): boolean =>
      e === 'domError' || e === 'noAnswer' || e === 'timeout';
    for (const step of ['reload', 'newChat'] as const) {
      if (outcome.ok || !recoverable(outcome.error) || isAborted()) break;
      dbg(`ask ${askId} ${step} after ${outcome.error}`);
      if (step === 'reload') {
        await reloadTab(tabId).catch(() => {});
      } else {
        await updateTab(tabId, { url: adapter.url }).catch(() => {});
      }
      outcome = await round().catch(classifyErr);
    }
    if (!outcome.ok && outcome.error === 'loginRequired' && outcome.loginTabId === undefined) {
      // CS-side signed-out detection returns no tab — the bridge tab is
      // still the one the user must log in on.
      outcome.loginTabId = tabId;
    }
    if (!outcome.ok) {
      console.warn(`[aiBridge] ${adapter.id} failed: ${outcome.error}`);
    }
    return outcome;
  } catch (err) {
    return classifyErr(err);
  }
}

type AskPayload = {
  prompt: string;
  provider?: AiProviderId;
  feature?: string;
  askId?: string;
  tabId?: number;
};
type AskResult = MessageResponse<{ text: string; provider: AiProviderId } | { attempts: AskAttempt[] }>;

/** One pending (queued) ask — replaced when a newer askId arrives, so N
 *  rapid asks coalesce into: abort current + run the last one once. */
let pendingAsk: { payload: AskPayload; resolve: (r: AskResult) => void } | null = null;

async function runAskChain(ctx: BackgroundContext, data: AskPayload): Promise<AskResult> {
  const seq = ++askSeq;
  const { prompt, askId } = data;
  askInFlight = true;
  currentAskId = askId;
  if (askId !== undefined && data.tabId !== undefined) {
    pendingStreams.set(askId, data.tabId);
  }
  try {
    const configured = providerOrderFromSettings(await ctx.loadSettings());
    // No failover: the picked/configured provider is the only one asked.
    // On failure the popup shows the terminal state — the user retries or
    // switches source manually.
    const provider = resolveProviderOrder(configured, data.provider)[0];
    const outcome = await askOnProvider(AI_PROVIDERS[provider], prompt, askId);
    dbg(`ask seq=${seq} outcome ok=${outcome.ok} ${outcome.ok ? '' : `err=${outcome.error}`}`);
    if (outcome.ok) {
      return { success: true, data: { text: outcome.text, provider } };
    }
    if (outcome.error === 'cancelled') {
      return { success: false, error: 'cancelled' };
    }
    if (outcome.error === 'loginRequired' && outcome.loginTabId !== undefined) {
      void focusBridgeTab(outcome.loginTabId);
    }
    return {
      success: false,
      error: 'all_failed',
      data: { attempts: [{ provider, error: outcome.error }] },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    askInFlight = false;
    currentAskId = undefined;
    dbg(`ask seq=${seq} slot freed`);
    if (askId !== undefined) {
      // The provider-side tail watch keeps emitting AI_STREAM growth after
      // the chain returns (up to ~45s) — keep the route mapped so those
      // late partials still reach the popup, then reap it.
      setTimeout(() => pendingStreams.delete(askId), 50_000);
      abortedAskIds.delete(askId);
      streamedAsks.delete(askId);
    }
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
    async (request): Promise<AskResult> => {
      const parsed = AiAskPayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return { success: false, error: `Invalid AI_ASK payload: ${parsed.error.message}` };
      }
      const data = parsed.data as AskPayload;
      // MV3 suspends an idle worker mid-ask — the provider reply then never
      // reaches the popup (silent hang until the client timeout). A chrome.*
      // call every 20s counts as activity and keeps the worker alive for the
      // whole chain, queued waits included.
      const keepalive = setInterval(() => {
        void chrome.runtime.getPlatformInfo().catch(() => {});
      }, 20_000);
      dbg(`ask in id=${data.askId} inFlight=${askInFlight} cur=${currentAskId} pending=${pendingAsk?.payload.askId}`);
      if (askInFlight) {
        // Duplicate of the running ask — reject, never queue.
        if (data.askId === undefined || data.askId === currentAskId) {
          clearInterval(keepalive);
          return { success: false, error: 'AI ask already in flight' };
        }
        // New askId supersedes: abort the running chain (setup-phase checks
        // + scoped provider cancel) and coalesce into the pending slot —
        // the newest pending wins, its promise resolves when it finally runs.
        if (currentAskId !== undefined) abortedAskIds.add(currentAskId);
        void broadcastCancel(currentAskId);
        return new Promise<AskResult>((resolve) => {
          pendingAsk?.resolve({ success: false, error: 'cancelled' });
          pendingAsk = {
            payload: data,
            resolve: (r) => { clearInterval(keepalive); resolve(r); },
          };
          dbg(`ask queued id=${data.askId}`);
        });
      }
      const res = await runAskChain(ctx, data);
      while (pendingAsk) {
        const next = pendingAsk;
        pendingAsk = null;
        next.resolve(await runAskChain(ctx, next.payload));
      }
      clearInterval(keepalive);
      return res;
    },
  );

  ctx.on(
    MESSAGE_TYPES.AI_CANCEL,
    async (request): Promise<MessageResponse> => {
      const parsed = AiCancelPayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return { success: false, error: `Invalid AI_CANCEL payload: ${parsed.error.message}` };
      }
      const { askId, provider } = parsed.data ?? {};
      if (askId !== undefined && pendingAsk?.payload.askId === askId) {
        pendingAsk.resolve({ success: false, error: 'cancelled' });
        pendingAsk = null;
      }
      await broadcastCancel(askId, provider);
      return { success: true };
    },
  );

  ctx.on(
    MESSAGE_TYPES.AI_OPEN_PROVIDER,
    async (request): Promise<MessageResponse> => {
      const parsed = AiOpenProviderPayloadSchema.safeParse(request.payload);
      if (!parsed.success) {
        return { success: false, error: `Invalid AI_OPEN_PROVIDER payload: ${parsed.error.message}` };
      }
      try {
        const adapter = AI_PROVIDERS[parsed.data.provider];
        const tabId = await ensureBridgeTabId(adapter);
        await focusBridgeTab(tabId);
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
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
      streamedAsks.add(parsed.data.askId);
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
