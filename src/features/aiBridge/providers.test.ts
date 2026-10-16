import { AI_PROVIDER_IDS } from '@/entities/message/dictionarySchemas';
import {
  AI_PROVIDERS,
  adapterForHost,
  classifyAskError,
  isAiProviderId,
  probeSession,
  providerOrderFromSettings,
  resolveProviderOrder,
} from './providers';

test('every provider id has a complete adapter', () => {
  for (const id of AI_PROVIDER_IDS) {
    const adapter = AI_PROVIDERS[id];
    expect(adapter.id).toBe(id);
    expect(adapter.name).toBeTruthy();
    expect(adapter.tabUrlPatterns.length).toBeGreaterThan(0);
    expect(adapter.composer.selectors.length).toBeGreaterThan(0);
    expect(adapter.assistantUnit).toBeTruthy();
    expect(adapter.answerBody).toBeTruthy();
    expect(['attribute', 'stability']).toContain(adapter.doneSignal.kind);
  }
});

test('adapterForHost matches each provider origin and subdomains', () => {
  expect(adapterForHost('chatgpt.com')?.id).toBe('chatgpt');
  expect(adapterForHost('gemini.google.com')?.id).toBe('gemini');
  expect(adapterForHost('chat.deepseek.com')?.id).toBe('deepseek');
  expect(adapterForHost('claude.ai')?.id).toBe('claude');
  expect(adapterForHost('www.claude.ai')?.id).toBe('claude');
  expect(adapterForHost('example.com')).toBeUndefined();
});

test('resolveProviderOrder falls back to the default order', () => {
  expect(resolveProviderOrder(undefined)).toEqual([...AI_PROVIDER_IDS]);
  expect(resolveProviderOrder([])).toEqual([...AI_PROVIDER_IDS]);
});

test('resolveProviderOrder honors a configured order and drops unknown ids', () => {
  expect(resolveProviderOrder(['claude', 'chatgpt', 'not-a-provider'])).toEqual([
    'claude',
    'chatgpt',
  ]);
});

test('resolveProviderOrder puts the requested provider first without duplicating it', () => {
  expect(resolveProviderOrder(undefined, 'deepseek')).toEqual([
    'deepseek',
    'chatgpt',
    'gemini',
    'claude',
  ]);
  expect(resolveProviderOrder(['gemini', 'deepseek'], 'deepseek')).toEqual([
    'deepseek',
    'gemini',
  ]);
});

test('providerOrderFromSettings reads the aiBridge slice when present', () => {
  expect(providerOrderFromSettings(undefined)).toBeUndefined();
  expect(providerOrderFromSettings({})).toBeUndefined();
  expect(providerOrderFromSettings({ aiBridge: { providerOrder: ['gemini'] } })).toEqual([
    'gemini',
  ]);
  expect(providerOrderFromSettings({ aiBridge: { providerOrder: 'gemini' } })).toBeUndefined();
});

test('isAiProviderId guards the id union', () => {
  expect(isAiProviderId('claude')).toBe(true);
  expect(isAiProviderId('bing')).toBe(false);
  expect(isAiProviderId(42)).toBe(false);
});

test('classifyAskError maps bridge error strings to failure kinds', () => {
  expect(classifyAskError('busy')).toBe('busy');
  expect(classifyAskError('loginRequired')).toBe('loginRequired');
  expect(classifyAskError('noAnswer')).toBe('noAnswer');
  expect(classifyAskError('AI_ASK timeout')).toBe('timeout');
  expect(classifyAskError('bridge tab not ready')).toBe('domError');
  expect(classifyAskError(undefined)).toBe('domError');
});

describe('probeSession — invisible login guard', () => {
  const jsonRes = (body: unknown, status = 200) =>
    ({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) }) as Response;
  const mockFetch = (impl: () => Promise<Response>) => {
    globalThis.fetch = jest.fn(impl) as unknown as typeof fetch;
  };

  it('reports in when the session endpoint returns a user/token', async () => {
    mockFetch(() => Promise.resolve(jsonRes({ accessToken: 'tok', user: { id: 'u' } })));
    expect(await probeSession('chatgpt')).toBe('in');
  });

  it('reports out on 401 or an empty session body', async () => {
    mockFetch(() => Promise.resolve(jsonRes({}, 401)));
    expect(await probeSession('claude')).toBe('out');
    mockFetch(() => Promise.resolve(jsonRes({})));
    expect(await probeSession('chatgpt')).toBe('out');
  });

  it('reports unknown on network errors so the DOM ping decides', async () => {
    mockFetch(() => Promise.reject(new Error('offline')));
    expect(await probeSession('gemini')).toBe('unknown');
    expect(await probeSession('deepseek')).toBe('unknown');
  });
});
