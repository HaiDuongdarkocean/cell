import { createEncryptedAdapter } from './encrypted';
import type { EncryptedProfile } from './encrypted';
import { tophimEncryptedProfile } from './index';
import type {
  SubtitleDiscoveryContext,
  SubtitleDiscoveryEnvironment,
  NetworkResponseSignal,
} from '../types';

function encryptRc4Hex(plain: string, prefix: string, key: string): string {
  const S = new Array<number>(256);
  for (let i = 0; i < 256; i++) S[i] = i;

  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key.charCodeAt(i % key.length)) & 0xff;
    [S[i], S[j]] = [S[j], S[i]];
  }

  let i = 0;
  j = 0;
  let encoded = '';
  for (let n = 0; n < plain.length; n++) {
    i = (i + 1) & 0xff;
    j = (j + S[i]) & 0xff;
    [S[i], S[j]] = [S[j], S[i]];
    const k = S[(S[i] + S[j]) & 0xff];
    const code = plain.charCodeAt(n) ^ k;
    encoded += code.toString(16).padStart(4, '0');
  }

  return `${prefix}${encoded}`;
}

const makeEnv = (
  fetchText?: SubtitleDiscoveryEnvironment['fetchText'],
): SubtitleDiscoveryEnvironment => ({
  fetchText:
    fetchText ??
    jest.fn().mockResolvedValue({ ok: false, status: 404, content: '', finalUrl: '' }),
  resolveUrl: (base, relative) => new URL(relative, base).href,
  now: () => 0,
});

const makeContext = (
  overrides?: Partial<SubtitleDiscoveryContext>,
): SubtitleDiscoveryContext => ({
  tabId: 1,
  frameId: 0,
  origin: 'https://www.tophim.top',
  initiator: 'https://www.tophim.top/xem/keo-ngot-tinh-yeu',
  tabUrl: 'https://www.tophim.top/xem/keo-ngot-tinh-yeu',
  timestamp: 0,
  ...overrides,
});

const makeSignal = (body: string, url: string): NetworkResponseSignal => ({
  kind: 'network-response',
  url,
  body,
  tabId: 1,
  frameId: 0,
  initiator: 'https://www.tophim.top/xem/keo-ngot-tinh-yeu',
  method: 'GET',
  type: 'xmlhttprequest',
});

describe('createEncryptedAdapter (hubphim)', () => {
  const profile: EncryptedProfile = {
    id: 'test-hubphim',
    priority: 10,
    provider: 'test',
    urlPattern: /\/api\/subtitles\/play\?id=/i,
    decryptor: 'hubphim',
  };

  it('decrypts a HUBPHIM VTT payload and creates a ready candidate', async () => {
    const plain = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello';
    const encrypted = encryptRc4Hex(plain, 'HUBPHIM_ENC:', 'hubphim_sub_secret_key_2026');
    const signal = makeSignal(encrypted, 'https://example.com/api/subtitles/play?id=42');
    const adapter = createEncryptedAdapter(profile);

    const result = await adapter.discover(signal, makeContext(), makeEnv());

    expect(result).toHaveLength(1);
    const c = result[0];
    expect(c.url).toBe(signal.url);
    expect(c.format).toBe('vtt');
    expect(c.language).toBe('unknown');
    expect(c.label).toBe('Subtitle #42');
    expect(c.provider).toBe('test');
    expect(c.status).toBe('ready');
  });

  it('rejects non-matching URLs', () => {
    const adapter = createEncryptedAdapter(profile);
    expect(
      adapter.match({
        kind: 'network-response',
        url: 'https://example.com/other',
        body: 'x',
        tabId: 1,
        frameId: 0,
      }),
    ).toBe(false);
  });

  it('resolves language and label via profile.resolveMetadata', async () => {
    const plain = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello';
    const encrypted = encryptRc4Hex(plain, 'HUBPHIM_ENC:', 'hubphim_sub_secret_key_2026');
    const signal = makeSignal(encrypted, 'https://www.tophim.top/api/subtitles/play?id=799');

    const resolveMetadata: EncryptedProfile['resolveMetadata'] = async () => ({
      label: 'Tiếng Anh',
      language: 'en',
    });

    const adapter = createEncryptedAdapter({
      ...profile,
      resolveMetadata,
    });
    const result = await adapter.discover(signal, makeContext(), makeEnv());

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Tiếng Anh');
    expect(result[0].language).toBe('en');
  });

  it('resolves language and label from tophim page HTML', async () => {
    const plain = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello';
    const encrypted = encryptRc4Hex(plain, 'HUBPHIM_ENC:', 'hubphim_sub_secret_key_2026');
    const signal = makeSignal(encrypted, 'https://www.tophim.top/api/subtitles/play?id=799');

    const html = String.raw`some data,"episode_subtitles":[{"id":797,"label":"Vietnamese","language":"vi"},{"id":799,"episode_id":790220,"label":"Tiếng Anh","language":"en","url":"/subs/x.srt"}]`;
    const fetchText = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      content: html,
      finalUrl: 'https://www.tophim.top/xem/keo-ngot-tinh-yeu',
    });

    const adapter = createEncryptedAdapter(tophimEncryptedProfile);
    const result = await adapter.discover(signal, makeContext(), makeEnv(fetchText));

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Tiếng Anh');
    expect(result[0].language).toBe('en');
  });
});
