/**
 * Community audio service — aggregate free pronunciation audio from
 * Wikimedia Commons sources (Wiktionary + Lingua Libre).
 *
 * Unlike Forvo, these sources are not behind Cloudflare bot protection and are
 * reachable from a Chrome MV3 service worker.
 */
import type { AudioItem } from '../types';
import { scoreAudioByAccent } from './forvoAudioService';

interface CommonsSearchResult {
  title: string;
}

interface CommonsSearchResponse {
  query?: {
    search?: CommonsSearchResult[];
  };
}

interface CommonsFileInfo {
  url: string;
  user: string;
}

interface CommonsFilePage {
  imageinfo?: CommonsFileInfo[];
}

interface CommonsFileResponse {
  query?: {
    pages?: Record<string, CommonsFilePage>;
  };
}

const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php';

/** Build a Wikimedia Commons API search URL for Wiktionary audio files.
 *  Pattern: {lang}(-{region})?-{term}{digits}.ogg  (e.g. en-us-hello.ogg) */
export function buildWiktionarySearchUrl(term: string, langCode: string): string {
  const pattern = `${langCode}(-[a-zA-Z]{2})?-${term}[0-9]*.ogg`;
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    list: 'search',
    srsearch: `intitle:/${pattern}/i`,
    srnamespace: '6',
    origin: '*',
  });
  return `${COMMONS_API_URL}?${params.toString()}`;
}

/** Build a Wikimedia Commons API search URL for Lingua Libre audio files.
 *  Pattern: LL-Q{langId} ({iso639_3})-{user}-{term}.wav */
export function buildLinguaLibreSearchUrl(term: string, iso639_3: string): string {
  const search = `-${term}.wav`;
  const category = `incategory:"Lingua_Libre_pronunciation-${iso639_3}"`;
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    list: 'search',
    srsearch: `intitle:/${search}/i ${category}`,
    srnamespace: '6',
    origin: '*',
  });
  return `${COMMONS_API_URL}?${params.toString()}`;
}

/** Build a Wikimedia Commons API file info URL for a given File: title. */
export function buildCommonsFileInfoUrl(title: string): string {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    titles: title,
    prop: 'imageinfo',
    iiprop: 'user|url',
    origin: '*',
  });
  return `${COMMONS_API_URL}?${params.toString()}`;
}

/** Detect accent from a Wikimedia filename like "En-uk-hello.ogg". */
export function detectAccentFromFilename(filename: string): 'US' | 'UK' | 'AU' | 'CA' | undefined {
  const base = filename.replace(/^File:/i, '').toLowerCase();
  if (base.includes('en-us') || base.includes('en-usa')) return 'US';
  if (base.includes('en-uk') || base.includes('en-gb')) return 'UK';
  if (base.includes('en-au')) return 'AU';
  if (base.includes('en-ca')) return 'CA';
  return undefined;
}

/** Validate that a filename is a Wiktionary audio file for a term. */
export function isWiktionaryAudioFilename(filename: string, term: string, langCode: string): boolean {
  const name = filename.replace(/^File:/i, '');
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${langCode}(-\\w\\w)?-${escapedTerm}(-\\d+)?\\.ogg$`, 'i');
  return regex.test(name);
}

/** Validate that a filename is a Lingua Libre audio file for a term. */
export function isLinguaLibreAudioFilename(filename: string, term: string, iso639_3: string): boolean {
  const name = filename.replace(/^File:/i, '');
  const regex = new RegExp(`^LL-Q\\d+\\s\\(${iso639_3}\\)-[^-]+-${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.wav$`, 'i');
  return regex.test(name);
}

/** Fetch file info (direct URL + user) for a Commons search result. */
async function fetchCommonsFileInfo(title: string): Promise<{ url: string; user: string; title: string } | null> {
  const response = await fetch(buildCommonsFileInfoUrl(title), {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as CommonsFileResponse;
  const pages = data.query?.pages ?? {};
  for (const page of Object.values(pages)) {
    const info = page.imageinfo?.[0];
    if (info) return { url: info.url, user: info.user, title };
  }
  return null;
}

/** Search Commons and return audio items passing validation. */
async function searchCommonsAudio(
  searchUrl: string,
  validate: (filename: string, user: string) => boolean,
  labelFn: (filename: string, user: string) => string,
  sourcePrefix: string,
): Promise<AudioItem[]> {
  const response = await fetch(searchUrl, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return [];
  const data = (await response.json()) as CommonsSearchResponse;
  const results = data.query?.search ?? [];
  if (results.length === 0) return [];

  const items: AudioItem[] = [];
  let idx = 0;
  for (const result of results.slice(0, 10)) {
    const info = await fetchCommonsFileInfo(result.title);
    if (!info) continue;
    if (!validate(info.title, info.user)) continue;

    const accentId = detectAccentFromFilename(info.title);
    items.push({
      id: `${sourcePrefix}-${accentId ?? 'XX'}-${idx}`,
      kind: 'word',
      source: 'community',
      label: labelFn(info.title, info.user),
      accentId,
      state: 'idle',
      url: info.url,
      defaultSelected: false,
    });
    idx += 1;
  }
  return items;
}

/** Fetch Wiktionary audio files from Wikimedia Commons. */
export async function fetchWiktionaryAudioItems(term: string, langCode: string): Promise<AudioItem[]> {
  const searchUrl = buildWiktionarySearchUrl(term, langCode);
  return searchCommonsAudio(
    searchUrl,
    (filename) => isWiktionaryAudioFilename(filename, term, langCode),
    (filename, user) => {
      const accentId = detectAccentFromFilename(filename);
      return accentId ? `${accentId} pronunciation · Wiktionary` : `Wiktionary · ${user}`;
    },
    'wiktionary',
  );
}

/** Fetch Lingua Libre audio files from Wikimedia Commons. */
export async function fetchLinguaLibreAudioItems(term: string, iso639_3: string): Promise<AudioItem[]> {
  const searchUrl = buildLinguaLibreSearchUrl(term, iso639_3);
  return searchCommonsAudio(
    searchUrl,
    (filename) => isLinguaLibreAudioFilename(filename, term, iso639_3),
    (_filename, user) => `Community · ${user}`,
    'lingualibre',
  );
}

/** Map ISO 639-1 (2-letter) to ISO 639-3 (3-letter) for a few languages. */
function iso639_1To3(langCode: string): string | undefined {
  const map: Record<string, string> = {
    en: 'eng',
    fr: 'fra',
    de: 'deu',
    es: 'spa',
    it: 'ita',
    ja: 'jpn',
    zh: 'cmn',
    ko: 'kor',
    ru: 'rus',
    pt: 'por',
  };
  return map[langCode.toLowerCase()];
}

/** Aggregate community audio from all supported sources. */
export async function fetchCommunityAudioItems(term: string, langCode: string): Promise<AudioItem[]> {
  const promises: Promise<AudioItem[]>[] = [fetchWiktionaryAudioItems(term, langCode)];
  const iso3 = iso639_1To3(langCode);
  if (iso3) {
    promises.push(fetchLinguaLibreAudioItems(term, iso3));
  }
  const results = await Promise.all(promises);
  return results.flat();
}

/** Fetch + score by accent preference. */
export async function fetchScoredCommunityAudioItems(
  term: string,
  langCode: string,
  preferredAccent: 'US' | 'UK' | 'AU' | 'CA' = 'US',
): Promise<AudioItem[]> {
  const items = await fetchCommunityAudioItems(term, langCode);
  return scoreAudioByAccent(items, preferredAccent);
}
