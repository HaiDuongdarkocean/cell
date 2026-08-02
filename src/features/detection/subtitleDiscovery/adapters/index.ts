// Default subtitle discovery adapters for the nine audited site families.
//
// The adapters are pure protocol handlers; this file wires the site-specific
// profiles to each handler and exports a ready-to-register array.

import { createJsonListingAdapter } from './jsonListing';
import { createIframeHashAdapter } from './iframeHash';
import { createHtmlVariableAdapter } from './htmlVariable';
import { createPlayerStateAdapter } from './playerState';
import { createHlsAdapter } from './hls';
import { createEncryptedAdapter } from './encrypted';
import {
  cinesrcProfile,
  kisskhProfile,
  lookmovieProfile,
  broodingmoviesProfile,
} from './profiles';
import type { SubtitleDiscoveryAdapter } from '../types';

export const lunastreamProfile = {
  id: 'lunastream-iframe-hash',
  priority: 10,
  urlPattern: /flixcdn\.cyou/i,
  hashKey: 'subs',
  origin: 'https://flixcdn.cyou',
  provider: 'lunastream',
} as const;

export const myasiantvProfile = {
  id: 'myasiantv-html-variable',
  priority: 10,
  urlPattern: /kisscloud\.online/i,
  originPattern: /kisscloud\.online/i,
  variableName: 'playerjsSubtitle',
  provider: 'kisscloud',
} as const;

export const noxxProfile = {
  id: 'noxx-player-state',
  priority: 10,
  originPattern: /cloudorchestranova\.com/i,
  playerKey: 'the_subtitles',
  provider: 'noxx',
} as const;

export const onflixProfile = {
  id: 'onflix-hls',
  priority: 10,
  urlPattern: /\.m3u8(?:\?|$)/i,
  provider: 'onflix',
} as const;

export const videasyProfile = {
  id: 'videasy-encrypted',
  priority: 10,
  urlPattern: /sources-with-title/i,
  provider: 'videasy',
} as const;

export function createDefaultAdapters(): SubtitleDiscoveryAdapter[] {
  return [
    createJsonListingAdapter(cinesrcProfile),
    createJsonListingAdapter(kisskhProfile),
    createJsonListingAdapter(lookmovieProfile),
    createJsonListingAdapter(broodingmoviesProfile),
    createIframeHashAdapter(lunastreamProfile),
    createHtmlVariableAdapter(myasiantvProfile),
    createPlayerStateAdapter(noxxProfile),
    createHlsAdapter(onflixProfile),
    createEncryptedAdapter(videasyProfile),
  ];
}
