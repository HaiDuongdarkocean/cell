// Site profiles for the generic subtitle-list discovery adapters.
//
// These profiles are pure data + small mapping functions. The adapter itself has
// no site-specific branches — it reads the profile to match, extract, and map.

import { resolveLanguage, languageFromLabel, languageFromPath } from '../candidate';
import type { CandidateInit } from '../candidate';
import type { JsonListingProfile } from './jsonListing';

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const cinesrcProfile: JsonListingProfile = {
  id: 'cinesrc-listing',
  priority: 10,
  urlPattern: /\/search\?id=/i,
  responseType: 'array',
  extractList: (parsed) => (Array.isArray(parsed) ? parsed : []),
  mapEntry: (entry) => {
    if (!isRecord(entry)) return null;
    const url = (entry.url as string) || (entry.r2Url as string);
    if (!isString(url)) return null;
    const display = isString(entry.display) ? entry.display : (isString(entry.language) ? entry.language : 'Unknown');
    let language = isString(entry.language) ? resolveLanguage(entry.language) : 'unknown';
    if (language === 'unknown' && display) {
      language = languageFromLabel(display);
    }
    const format = isString(entry.format) ? (entry.format.toLowerCase() as CandidateInit['format']) : null;
    return {
      label: display,
      language,
      url,
      format,
      source: 'direct',
      provider: isString(entry.source) ? entry.source : 'cinesrc',
      sdh: entry.isHearingImpaired === true,
      forced: entry.isForced === true,
      default: entry.isDefault === true,
    };
  },
};

export const kisskhProfile: JsonListingProfile = {
  id: 'kisskh-listing',
  priority: 10,
  urlPattern: /\/api\/Sub\/\d+/i,
  responseType: 'array',
  extractList: (parsed) => (Array.isArray(parsed) ? parsed : []),
  mapEntry: (entry) => {
    if (!isRecord(entry)) return null;
    const url = entry.src as string;
    const label = entry.label as string;
    const land = entry.land as string;
    if (!isString(url) || !isString(label)) return null;
    return {
      label,
      language: isString(land) ? resolveLanguage(land) : languageFromLabel(label),
      url,
      source: 'direct',
      provider: 'kisskh',
      default: entry.default === true,
    };
  },
};

export const lookmovieProfile: JsonListingProfile = {
  id: 'lookmovie-listing',
  priority: 10,
  urlPattern: /\/api\/v1\/security\/episode-access/i,
  responseType: 'object-key',
  objectKey: 'subtitles',
  extractList: (parsed) => {
    if (!isRecord(parsed) || !Array.isArray(parsed.subtitles)) return [];
    return parsed.subtitles;
  },
  mapEntry: (entry, ctx, index) => {
    if (!isRecord(entry)) return null;
    const label = isString(entry.language) ? entry.language : `Subtitle ${index + 1}`;
    const file = entry.file;

    if (isString(file)) {
      const language = languageFromPath(file) === 'unknown' ? languageFromLabel(label) : languageFromPath(file);
      return {
        label,
        language,
        url: file,
        source: 'relative',
        baseUrl: ctx.origin,
        provider: 'lookmovie',
        default: index === 0,
      };
    }

    if (Array.isArray(file)) {
      return {
        label,
        language: languageFromLabel(label),
        source: 'metadata',
        provider: 'lookmovie-opensubtitles',
        metadata: {
          provider: 'opensubtitles',
          providerId: `lookmovie:${index}`,
          language: languageFromLabel(label),
          label,
          extra: { file },
        },
        status: 'unresolved',
      };
    }

    return null;
  },
  replayReferer: (ctx) => ctx.origin,
};

export const broodingmoviesProfile: JsonListingProfile = {
  id: 'broodingmovies-listing',
  priority: 10,
  urlPattern: /streamdata\.vaplayer\.ru\/api\.php/i,
  responseType: 'object-key',
  objectKey: 'default_subs',
  extractList: (parsed) => {
    if (!isRecord(parsed) || !Array.isArray(parsed.default_subs)) return [];
    return parsed.default_subs;
  },
  mapEntry: (entry) => {
    if (!isRecord(entry)) return null;
    const url = entry.url as string;
    const code = entry.code as string;
    const lang = (entry.lang as string) || (entry.label as string);
    if (!isString(url) || !isString(lang)) return null;
    return {
      label: lang,
      language: isString(code) ? resolveLanguage(code) : languageFromLabel(lang),
      url,
      source: 'direct',
      provider: 'vaplayer',
      default: entry.default === true,
    };
  },
};
