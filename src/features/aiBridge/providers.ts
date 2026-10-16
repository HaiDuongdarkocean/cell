/**
 * AI provider adapters — SSOT for every provider DOM contract (REQ-11).
 * Data + pure helpers only; DOM observation lives in ./dom.ts, tab
 * orchestration in background/handlers/aiBridge.ts.
 *
 * Selector fragility is contained here: a provider DOM change is a patch
 * to one entry in AI_PROVIDERS.
 */
import { AI_PROVIDER_IDS, type AiProviderId } from '@/entities/message/dictionarySchemas';

export type { AiProviderId };

export type AiDoneSignal =
  | {
      kind: 'attribute';
      attr: string;
      /** Where the attr lives relative to the assistant unit; unit itself when absent. */
      scopeSelector?: string;
      streamingValue: string;
      completeValue: string;
    }
  | { kind: 'stability'; silenceMs: number };

export interface AiProviderAdapter {
  id: AiProviderId;
  name: string;
  /** New-tab URL for the provider (lands on its new-chat surface). */
  url: string;
  /** chrome.tabs.query url patterns used to locate an existing provider tab. */
  tabUrlPatterns: string[];
  /** location.host suffix the content script uses to pick its adapter. */
  host: string;
  /** URL substrings proving the tab landed on a login wall — lets the
   *  handler fast-fail loginRequired instead of waiting out the composer
   *  grace window on a logged-out session. */
  loginUrlPatterns?: string[];
  composer: {
    selectors: string[];
    isTextarea?: boolean;
  };
  assistantUnit: string;
  answerBody: string;
  doneSignal: AiDoneSignal;
  streamingIndicators: string[];
  sendButtonSelectors: string[];
  /** Virtualized transcripts (DeepSeek) unmount offscreen rows — keep the
   *  newest unit scrolled into view so mutations keep flowing. */
  scrollIntoViewWhileObserving?: boolean;
}

export const AI_PROVIDERS: Record<AiProviderId, AiProviderAdapter> = {
  chatgpt: {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com/',
    tabUrlPatterns: ['https://chatgpt.com/*'],
    host: 'chatgpt.com',
    loginUrlPatterns: ['auth.openai.com', 'chatgpt.com/auth/login'],
    composer: {
      selectors: [
        '#prompt-textarea',
        'div.ProseMirror[contenteditable="true"][aria-label="Ask ChatGPT"]',
        'form div[contenteditable="true"]',
        'div[contenteditable="true"]',
        'form textarea',
      ],
    },
    assistantUnit:
      '[data-content-search-unit-key$=":assistant"], [data-message-author-role="assistant"]',
    answerBody: '[data-markdown-text-style="assistant-message"], .markdown',
    doneSignal: {
      kind: 'attribute',
      attr: 'data-talvt-turn-state',
      scopeSelector: '[data-talvt-turn-state]',
      streamingValue: 'in_progress',
      completeValue: 'complete',
    },
    streamingIndicators: ['button[aria-label*="Stop" i]', '.result-streaming'],
    sendButtonSelectors: ['button[aria-label*="Send" i]'],
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com/app',
    tabUrlPatterns: ['https://gemini.google.com/*'],
    host: 'gemini.google.com',
    loginUrlPatterns: ['accounts.google.com'],
    composer: {
      selectors: [
        'div.ql-editor[contenteditable="true"][aria-label="Enter a prompt for Gemini"]',
        'div.ql-editor[contenteditable="true"]',
        'div[contenteditable="true"]',
      ],
    },
    assistantUnit: 'model-response',
    answerBody: 'message-content, .markdown',
    doneSignal: { kind: 'stability', silenceMs: 1500 },
    streamingIndicators: [],
    sendButtonSelectors: ['button[aria-label*="Send" i]'],
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com/',
    tabUrlPatterns: ['https://chat.deepseek.com/*'],
    host: 'chat.deepseek.com',
    loginUrlPatterns: ['/sign_in', '/login'],
    composer: {
      selectors: ['textarea[placeholder="Message DeepSeek"]', 'textarea'],
      isTextarea: true,
    },
    assistantUnit: '.ds-message',
    answerBody: '.ds-markdown',
    doneSignal: { kind: 'stability', silenceMs: 1500 },
    streamingIndicators: [],
    sendButtonSelectors: [],
    scrollIntoViewWhileObserving: true,
  },
  claude: {
    id: 'claude',
    name: 'Claude',
    url: 'https://claude.ai/new',
    tabUrlPatterns: ['https://claude.ai/*'],
    host: 'claude.ai',
    loginUrlPatterns: ['claude.ai/login', 'claude.ai/signup'],
    composer: {
      selectors: [
        'div.tiptap.ProseMirror[contenteditable="true"][aria-label="Write your prompt to Claude"]',
        'div.ProseMirror[contenteditable="true"]',
        'div[contenteditable="true"]',
      ],
    },
    assistantUnit: '[data-testid="transcript-row"][data-perf-row="assistant"]',
    answerBody: '.standard-markdown',
    doneSignal: {
      kind: 'attribute',
      attr: 'data-perf-row-streaming',
      streamingValue: 'true',
      completeValue: 'false',
    },
    streamingIndicators: [],
    sendButtonSelectors: ['button[aria-label*="Send" i]'],
  },
};

export const DEFAULT_PROVIDER_ORDER: readonly AiProviderId[] = AI_PROVIDER_IDS;

export function isAiProviderId(value: unknown): value is AiProviderId {
  return typeof value === 'string' && (AI_PROVIDER_IDS as readonly string[]).includes(value);
}

export function adapterForHost(host: string): AiProviderAdapter | undefined {
  return Object.values(AI_PROVIDERS).find(
    (adapter) => host === adapter.host || host.endsWith(`.${adapter.host}`),
  );
}

/** Settings slice is owned by another lane — reads `settings.aiBridge.providerOrder`
 *  when it exists, undefined otherwise. Unknown entries are filtered downstream. */
export function providerOrderFromSettings(settings: unknown): unknown[] | undefined {
  const order = (settings as { aiBridge?: { providerOrder?: unknown } } | undefined)?.aiBridge
    ?.providerOrder;
  return Array.isArray(order) ? order : undefined;
}

/** Failover walk order: `requested` (explicit pick) first, then the configured
 *  order — never the same provider twice in one chain. */
export function resolveProviderOrder(
  configured: readonly unknown[] | undefined,
  requested?: AiProviderId,
): AiProviderId[] {
  const cleaned = [...new Set((configured ?? []).filter(isAiProviderId))];
  const order = cleaned.length ? cleaned : [...DEFAULT_PROVIDER_ORDER];
  if (!requested) return order;
  return [requested, ...order.filter((id) => id !== requested)];
}

export type SessionProbe = 'in' | 'out' | 'unknown';

async function probeJsonSession(
  url: string,
  hasSession: (body: unknown) => boolean,
): Promise<SessionProbe> {
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (res.status === 401 || res.status === 403) return 'out';
    if (!res.ok) return 'unknown';
    return hasSession(await res.json()) ? 'in' : 'out';
  } catch {
    return 'unknown';
  }
}

async function probeGeminiSession(): Promise<SessionProbe> {
  try {
    const res = await fetch('https://gemini.google.com/app', { credentials: 'include' });
    if (!res.ok) return 'unknown';
    if (res.redirected && res.url.includes('accounts.google')) return 'out';
    return (await res.text()).includes('SNlM0e') ? 'in' : 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Login guard run from the service worker — no tab needed. 'unknown'
 *  defers to the DOM ping in the provider tab (DeepSeek keeps its token in
 *  localStorage, invisible to a fetch probe). */
export function probeSession(provider: AiProviderId): Promise<SessionProbe> {
  switch (provider) {
    case 'chatgpt':
      return probeJsonSession('https://chatgpt.com/api/auth/session', (j) => {
        const s = j as { user?: unknown; accessToken?: unknown };
        return Boolean(s?.accessToken ?? s?.user);
      });
    case 'gemini':
      return probeGeminiSession();
    case 'claude':
      return probeJsonSession('https://claude.ai/api/organizations', (j) => {
        return Array.isArray(j) && j.length > 0;
      });
    case 'deepseek':
      return Promise.resolve('unknown');
  }
}

export const AI_ASK_FAILURE_KINDS = [
  'timeout',
  'rateLimit',
  'noAnswer',
  'busy',
  'loginRequired',
  'domError',
] as const;
export type AiAskFailureKind = (typeof AI_ASK_FAILURE_KINDS)[number];

/** The bridge emits kind strings directly; anything else (tab errors,
 *  timeouts thrown bg-side) is mapped heuristically. */
export function classifyAskError(error: string | undefined): AiAskFailureKind {
  const e = (error ?? '').toLowerCase();
  if (e.includes('busy')) return 'busy';
  if (e.includes('rate')) return 'rateLimit';
  if (e.includes('log')) return 'loginRequired';
  if (e.includes('noanswer') || e.includes('no answer') || e.includes('no reply')) {
    return 'noAnswer';
  }
  if (e.includes('timeout') || e.includes('timed out')) return 'timeout';
  return 'domError';
}
