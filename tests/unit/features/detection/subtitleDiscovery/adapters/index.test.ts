// Adapter tests using sanitized fixtures for each site family.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createDefaultAdapters } from '@/features/detection/subtitleDiscovery';
import type { SubtitleDiscoveryContext, SubtitleDiscoveryEnvironment, SubtitleSignal } from '@/features/detection/subtitleDiscovery';

function fixture(name: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), 'tests/fixtures/subtitleDiscovery', name), 'utf-8').trim();
}

function makeContext(overrides?: Partial<SubtitleDiscoveryContext>): SubtitleDiscoveryContext {
  return {
    tabId: 1,
    frameId: 0,
    origin: 'https://example.com',
    tabUrl: 'https://example.com/video',
    initiator: 'https://example.com',
    timestamp: 1700000000000,
    ...overrides,
  };
}

function makeEnv(): SubtitleDiscoveryEnvironment {
  return {
    fetchText: async () => ({ ok: false, status: 404, content: '', finalUrl: '' }),
    resolveUrl: (base, relative) => new URL(relative, base).href,
    now: () => 1700000000000,
  };
}

describe('Subtitle discovery adapters', () => {
  const adapters = createDefaultAdapters();

  it('cinesrc JSON-array adapter parses 3 candidates', async () => {
    const adapter = adapters.find((a) => a.id === 'cinesrc-listing')!;
    const body = fixture('cinesrc-listing.json');
    const signal: SubtitleSignal = { kind: 'network-response', url: 'https://subs.example-cdn.st/search?id=123', body, tabId: 1, frameId: 0 };
    const candidates = await adapter.discover(signal, makeContext({ origin: 'https://subs.example-cdn.st' }), makeEnv());
    expect(candidates).toHaveLength(3);
    expect(candidates[0].label).toBe('English');
    expect(candidates[0].language).toBe('en');
    expect(candidates[1].language).toBe('pt');
    expect(candidates[2].language).toBe('vi');
  });

  it('kisskh JSON-array adapter parses 6 candidates', async () => {
    const adapter = adapters.find((a) => a.id === 'kisskh-listing')!;
    const body = fixture('kisskh-listing.json');
    const signal: SubtitleSignal = { kind: 'network-response', url: 'https://kisskh.co/api/Sub/12345?kkey=abc', body, tabId: 1, frameId: 0 };
    const candidates = await adapter.discover(signal, makeContext({ origin: 'https://kisskh.co' }), makeEnv());
    expect(candidates).toHaveLength(6);
    expect(candidates[0].label).toBe('English');
    expect(candidates.every((c) => c.format === 'srt')).toBe(true);
  });

  it('lookmovie JSON-object adapter produces 3 ready + 2 unresolved', async () => {
    const adapter = adapters.find((a) => a.id === 'lookmovie-listing')!;
    const body = fixture('lookmovie-listing.json');
    const signal: SubtitleSignal = {
      kind: 'network-response',
      url: 'https://www.lookmovie2.to/api/v1/security/episode-access?id_episode=123&hash=abc',
      body,
      tabId: 1,
      frameId: 0,
    };
    const candidates = await adapter.discover(signal, makeContext({ origin: 'https://www.lookmovie2.to' }), makeEnv());
    expect(candidates).toHaveLength(5);
    const ready = candidates.filter((c) => c.status === 'ready');
    const unresolved = candidates.filter((c) => c.status === 'unresolved');
    expect(ready).toHaveLength(3);
    expect(unresolved).toHaveLength(2);
    expect(ready[0].url).toContain('en.vtt');
  });

  it('broodingmovies JSON-object adapter parses 4 candidates', async () => {
    const adapter = adapters.find((a) => a.id === 'broodingmovies-listing')!;
    const body = fixture('brooding-listing.json');
    const signal: SubtitleSignal = { kind: 'network-response', url: 'https://streamdata.vaplayer.ru/api.php?tmdb=123&type=tv&season=1&episode=1', body, tabId: 1, frameId: 0 };
    const candidates = await adapter.discover(signal, makeContext({ origin: 'https://streamdata.vaplayer.ru' }), makeEnv());
    expect(candidates).toHaveLength(4);
    expect(candidates[0].language).toBe('en');
  });

  it('lunastream iframe-hash adapter parses 3 candidates', async () => {
    const adapter = adapters.find((a) => a.id === 'lunastream-iframe-hash')!;
    const url = fixture('lunastream-iframe-hash.txt');
    const signal: SubtitleSignal = { kind: 'frame-source', frameUrl: url, ownerUrl: 'https://ww2.moviesapi.to/tv/123/1/1', tabId: 1, frameId: 2 };
    const candidates = await adapter.discover(signal, makeContext({ origin: 'https://flixcdn.cyou', frameUrl: url }), makeEnv());
    expect(candidates).toHaveLength(3);
    expect(candidates[0].label).toBe('English');
    expect(candidates[0].url).toContain('opensubtitles');
  });

  it('myasiantv html-variable adapter parses 3 candidates', async () => {
    const adapter = adapters.find((a) => a.id === 'myasiantv-html-variable')!;
    const html = fixture('myasiantv-html.html');
    const signal: SubtitleSignal = { kind: 'document-html', url: 'https://kisscloud.online/video/abc123', html, tabId: 1, frameId: 2 };
    const candidates = await adapter.discover(signal, makeContext({ origin: 'https://kisscloud.online' }), makeEnv());
    expect(candidates).toHaveLength(3);
    expect(candidates[0].language).toBe('en');
    expect(candidates.every((c) => c.format === 'vtt')).toBe(true);
  });

  it('vidrift html-variable adapter parses object-array candidates from HTML', async () => {
    const adapter = adapters.find((a) => a.id === 'vidrift-html-variable')!;
    const html = fixture('vidrift-html.html');
    const signal: SubtitleSignal = {
      kind: 'document-html',
      url: 'https://embed.vidrift.in/embed/movie/1108427',
      html,
      tabId: 1,
      frameId: 2,
    };
    const candidates = await adapter.discover(
      signal,
      makeContext({ origin: 'https://embed.vidrift.in', frameUrl: 'https://embed.vidrift.in/embed/movie/1108427' }),
      makeEnv(),
    );
    expect(candidates).toHaveLength(10);
    expect(candidates[0].label).toBe('English');
    expect(candidates[0].language).toBe('en');
    expect(candidates[0].format).toBe('vtt');
    expect(candidates[0].url).toContain('/api/subtitles/movie/1108427/English');
    expect(candidates[1].language).toBe('es');
    expect(candidates[2].language).toBe('fr');
    expect(candidates[3].language).toBe('de');
    expect(candidates[4].language).toBe('it');
    expect(candidates[5].language).toBe('pt');
    expect(candidates[6].language).toBe('cs');
    expect(candidates[7].language).toBe('sk');
    expect(candidates[8].language).toBe('pl');
    expect(candidates[9].language).toBe('tr');
    expect(candidates.every((c) => c.format === 'vtt')).toBe(true);
    expect(candidates.every((c) => c.provider === 'vidrift')).toBe(true);
  });

  it('noxx player-state adapter parses 4 candidates', async () => {
    const adapter = adapters.find((a) => a.id === 'noxx-player-state')!;
    const payload = JSON.parse(fixture('noxx-player-state.json'));
    const signal: SubtitleSignal = {
      kind: 'player-state',
      origin: 'https://cloudorchestranova.com',
      payload,
      playerKey: 'the_subtitles',
      tabId: 1,
      frameId: 2,
    };
    const candidates = await adapter.discover(signal, makeContext({ origin: 'https://cloudorchestranova.com', frameUrl: 'https://cloudorchestranova.com/prorcp/token' }), makeEnv());
    expect(candidates).toHaveLength(4);
    expect(candidates[0].url).toContain('en.vtt');
    expect(candidates[1].label).toBe('English - SDH');
  });

  it('vidrift player-state adapter parses object-array candidates', async () => {
    const adapter = adapters.find((a) => a.id === 'vidrift-player-state')!;
    const payload = JSON.parse(fixture('vidrift-player-state.json'));
    const signal: SubtitleSignal = {
      kind: 'player-state',
      origin: 'https://embed.vidrift.in',
      payload,
      playerKey: 'subtitleTracks',
      tabId: 1,
      frameId: 2,
    };
    const candidates = await adapter.discover(
      signal,
      makeContext({ origin: 'https://embed.vidrift.in', frameUrl: 'https://embed.vidrift.in/embed/movie/1108427' }),
      makeEnv(),
    );
    expect(candidates).toHaveLength(3);
    expect(candidates[0].label).toBe('English');
    expect(candidates[0].language).toBe('en');
    expect(candidates[0].format).toBe('vtt');
    expect(candidates[0].url).toContain('/api/subtitles/movie/1108427/English');
    expect(candidates[1].language).toBe('es');
    expect(candidates[2].language).toBe('fr');
  });

  it('onflix playembed player-state adapter parses 2 candidates', async () => {
    const adapter = adapters.find((a) => a.id === 'onflix-playembed-player-state')!;
    const payload = JSON.parse(fixture('playembed-player-state.json'));
    const signal: SubtitleSignal = {
      kind: 'player-state',
      origin: 'https://playembed.vip',
      payload,
      playerKey: 'subtitleTracks',
      tabId: 1,
      frameId: 2,
    };
    const candidates = await adapter.discover(
      signal,
      makeContext({ origin: 'https://playembed.vip', frameUrl: 'https://playembed.vip/player?ep_id=abc123&src=sn' }),
      makeEnv(),
    );
    expect(candidates).toHaveLength(2);
    expect(candidates[0].label).toBe('Tiếng Việt');
    expect(candidates[0].language).toBe('vi');
    expect(candidates[0].format).toBe('vtt');
    expect(candidates[0].url).toBe('https://m-center.onflixcdn.com/content/26062026/c8c22898-f969-4a6b-8ee5-a27d631bf4c4.vtt');
    expect(candidates[1].label).toBe('English');
    expect(candidates[1].language).toBe('en');
  });

  it('onflix hls adapter parses 2 subtitle tracks', async () => {
    const adapter = adapters.find((a) => a.id === 'onflix-hls')!;
    const body = fixture('onflix-master.m3u8');
    const signal: SubtitleSignal = { kind: 'hls-playlist', url: 'https://example-cdn.onflix/vid/master.m3u8', body, tabId: 1, frameId: 0, playlistType: 'master' };
    const candidates = await adapter.discover(signal, makeContext({ origin: 'https://example-cdn.onflix' }), makeEnv());
    expect(candidates).toHaveLength(2);
    expect(candidates[0].label).toBe('English');
    expect(candidates[0].default).toBe(true);
  });

  it('videasy encrypted adapter decrypts m4uhd source', async () => {
    const adapter = adapters.find((a) => a.id === 'videasy-encrypted')!;
    const body = fixture('videasy-m4uhd-encrypted.bin');
    const signal: SubtitleSignal = {
      kind: 'network-response',
      url: 'https://api.speedracelight.com/m4uhd/sources-with-title?title=Silo&mediaType=TV&year=2023&totalSeasons=4&episodeId=1&seasonId=1&tmdbId=125988&imdbId=tt14688458&enc=2&seed=59523314.KnuAYJu6hrSfrh9q8Aa4vT',
      body,
      tabId: 1,
      frameId: 0,
    };
    const candidates = await adapter.discover(signal, makeContext({ origin: 'https://player.videasy.to' }), makeEnv());
    expect(candidates).toHaveLength(1);
    expect(candidates[0].status).toBe('ready');
    expect(candidates[0].language).toBe('en');
    expect(candidates[0].format).toBe('srt');
    expect(candidates[0].provider).toBe('m4uhd');
    expect(candidates[0].url).toContain('api.playhq.net/sub');
  });

  it('videasy encrypted adapter decrypts cdn source with 67 subtitles', async () => {
    const adapter = adapters.find((a) => a.id === 'videasy-encrypted')!;
    const body = fixture('videasy-cdn-encrypted.bin');
    const signal: SubtitleSignal = {
      kind: 'network-response',
      url: 'https://api.speedracelight.com/cdn/sources-with-title?title=Silo&mediaType=tv&year=2023&episodeId=2&seasonId=1&tmdbId=125988&imdbId=tt14688458&enc=2&seed=59523338.yaF0Hex5Jfvd6cttjhxEGy',
      body,
      tabId: 1,
      frameId: 0,
    };
    const candidates = await adapter.discover(signal, makeContext({ origin: 'https://player.videasy.to' }), makeEnv());
    expect(candidates).toHaveLength(67);
    expect(candidates[0].status).toBe('ready');
    expect(candidates[0].language).toBe('en');
    expect(candidates[0].format).toBe('vtt');
    expect(candidates[0].provider).toBe('cdn');
    expect(candidates[0].url).toContain('.vtt');
  });

  it('onzload JSON-object adapter parses 4 unresolved metadata candidates', async () => {
    const adapter = adapters.find((a) => a.id === 'onzload-listing')!;
    const body = fixture('onzload-listing.json');
    const signal: SubtitleSignal = {
      kind: 'network-response',
      url: 'https://onzload.com/api/embed/535e4c58-15f5-40ce-a66c-6748e13990af/subtitles',
      body,
      tabId: 1,
      frameId: 0,
    };
    const candidates = await adapter.discover(
      signal,
      makeContext({ origin: 'https://onzload.com/embed/535e4c58-15f5-40ce-a66c-6748e13990af?autoplay=1' }),
      makeEnv(),
    );
    expect(candidates).toHaveLength(4);
    expect(candidates[0].label).toBe('Tiếng Việt');
    expect(candidates[0].language).toBe('vi');
    expect(candidates[0].format).toBe('vtt');
    expect(candidates[0].default).toBe(true);
    expect(candidates[0].status).toBe('unresolved');
    expect(candidates[0].url).toContain('/api/embed/535e4c58-15f5-40ce-a66c-6748e13990af/subtitle/c3389127-c0fc-44f2-ba20-4f624407fb76?v=mtjvldjn');
    expect(candidates[1].language).toBe('en');
    expect(candidates[2].language).toBe('zh');
    expect(candidates[3].language).toBe('zh');
  });

  it('opensubtitles JSON-array adapter parses ready candidates with download URLs', async () => {
    const adapter = adapters.find((a) => a.id === 'opensubtitles-listing')!;
    const body = JSON.stringify([
      {
        SubFileName: 'Her.Private.Hell.2026.1080p.WEB-DL.DDP5.1.H.264-English.srt',
        SubDownloadLink: 'https://dl.opensubtitles.org/en/download/vrf-c21ed2a1/filead/1962534192.gz',
        SubFormat: 'srt',
        SubLanguageID: 'eng',
        ISO639: 'en',
        LanguageName: 'English',
        SubHearingImpaired: '0',
        SubForeignPartsOnly: '0',
        SubFromTrusted: '1',
        SubSize: '22561',
      },
      {
        SubFileName: 'Her.Private.Hell.2026.Vietnamese.srt',
        SubDownloadLink: 'https://dl.opensubtitles.org/en/download/vrf-11223344/filead/1962534200.gz',
        SubFormat: 'srt',
        SubLanguageID: 'vie',
        ISO639: 'vi',
        LanguageName: 'Vietnamese',
        SubHearingImpaired: '0',
        SubForeignPartsOnly: '0',
        SubFromTrusted: '0',
        SubSize: '18432',
      },
    ]);
    const signal: SubtitleSignal = {
      kind: 'network-response',
      url: 'https://rest.opensubtitles.org/search/imdb-tt36629665/sublanguageid-eng,vie',
      body,
      tabId: 1,
      frameId: 0,
    };
    const candidates = await adapter.discover(signal, makeContext({ origin: 'https://rest.opensubtitles.org' }), makeEnv());
    expect(candidates).toHaveLength(2);
    expect(candidates[0].language).toBe('en');
    expect(candidates[0].format).toBe('srt');
    expect(candidates[0].provider).toBe('opensubtitles');
    expect(candidates[0].url).toContain('filead/1962534192.gz');
    expect(candidates[1].language).toBe('vi');
    expect(candidates[1].label).toBe('Vietnamese');
  });

  it('videasy encrypted adapter falls back to unresolved on bad seed', async () => {
    const adapter = adapters.find((a) => a.id === 'videasy-encrypted')!;
    const body = fixture('videasy-m4uhd-encrypted.bin');
    const signal: SubtitleSignal = {
      kind: 'network-response',
      url: 'https://api.speedracelight.com/cdn/sources-with-title?title=X&enc=2&seed=abc&tmdbId=123',
      body,
      tabId: 1,
      frameId: 0,
    };
    const candidates = await adapter.discover(signal, makeContext({ origin: 'https://player.videasy.to' }), makeEnv());
    expect(candidates).toHaveLength(1);
    expect(candidates[0].status).toBe('unresolved');
    expect(candidates[0].provider).toBe('cdn');
  });
});
