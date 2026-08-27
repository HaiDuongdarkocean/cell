import helloMp4 from '../design-system-showcase/assets/hello.mp4?url';
import helloSrt from '../design-system-showcase/assets/hello.srt?raw';
import helloThumb from '../design-system-showcase/assets/hello-thumb.jpg?url';
import jeremyChelseaMp4 from '../design-system-showcase/assets/jeremy-chelsea.mp4?url';
import jeremyChelseaSrt from '../design-system-showcase/assets/jeremy-chelsea.srt?raw';
import jeremyChelseaThumb from '../design-system-showcase/assets/jeremy-chelsea-thumb.jpg?url';
import pleaseAcousticMp4 from '../design-system-showcase/assets/please-acoustic.mp4?url';
import pleaseAcousticSrt from '../design-system-showcase/assets/please-acoustic.srt?raw';
import pleaseAcousticThumb from '../design-system-showcase/assets/please-acoustic-thumb.jpg?url';
import fallInLoveMp4 from '../design-system-showcase/assets/fall-in-love.mp4?url';
import fallInLoveSrt from '../design-system-showcase/assets/fall-in-love.srt?raw';
import fallInLoveThumb from '../design-system-showcase/assets/fall-in-love-thumb.jpg?url';
import apologizeMp4 from '../design-system-showcase/assets/apologize.mp4?url';
import apologizeSrt from '../design-system-showcase/assets/apologize.srt?raw';
import apologizeThumb from '../design-system-showcase/assets/apologize-thumb.jpg?url';
import { parseSrt } from '@/shared/lib/parsers/srtParser';
import type { SrtCue } from '@/entities/media';

export interface MockVideo {
  readonly id: string;
  readonly title: string;
  readonly mp4: string;
  readonly thumb: string;
  readonly cues: readonly SrtCue[];
}

export const VIDEOS: readonly MockVideo[] = [
  { id: 'jeremy-chelsea', title: 'you were good to me (Live)', mp4: jeremyChelseaMp4, thumb: jeremyChelseaThumb, cues: parseSrt(jeremyChelseaSrt).cues },
  { id: 'please-acoustic', title: 'please (Acoustic)', mp4: pleaseAcousticMp4, thumb: pleaseAcousticThumb, cues: parseSrt(pleaseAcousticSrt).cues },
  { id: 'fall-in-love', title: 'this is how you fall in love', mp4: fallInLoveMp4, thumb: fallInLoveThumb, cues: parseSrt(fallInLoveSrt).cues },
  { id: 'apologize', title: 'Apologize ft. OneRepublic', mp4: apologizeMp4, thumb: apologizeThumb, cues: parseSrt(apologizeSrt).cues },
  { id: 'hello', title: 'hello (demo)', mp4: helloMp4, thumb: helloThumb, cues: parseSrt(helloSrt).cues },
];

export const EPISODES = VIDEOS.map((v, i) => ({ num: i + 1, title: v.title, active: i === 0 }));

export const SERVERS = [
  { id: 'server-1', label: 'Server 1', quality: 'HD' },
  { id: 'server-2', label: 'Server 2', quality: 'HD' },
  { id: 'server-3', label: 'Server 3', quality: 'Full HD' },
  { id: 'server-4', label: 'Server 4', quality: 'Full HD' },
];

export const COMMENTS = [
  { user: 'AnimeFan2024', time: '2 hours ago', text: 'Jin Woo is the GOAT! This episode gave me chills.', likes: 42 },
  { user: 'ShadowMonarch', time: '5 hours ago', text: 'The animation quality is insane. A-1 Pictures cooked.', likes: 28 },
  { user: 'LevelUpKing', time: '1 day ago', text: 'Best anime of 2024 no cap. The system mechanics are so cool.', likes: 15 },
];

export const METADATA: readonly { label: string; value: string; href?: boolean; rating?: boolean }[] = [
  { label: 'Genres', value: 'Action, Fantasy, Adventure', href: true },
  { label: 'Studio', value: 'A-1 Pictures' },
  { label: 'Status', value: 'Completed' },
  { label: 'Episodes', value: '12' },
  { label: 'Duration', value: '23min' },
  { label: 'Released', value: '2024' },
  { label: 'Rating', value: '9.86', rating: true },
];

export const DESCRIPTION =
  'Humanity was caught at a precipice a decade ago when the first gates—portals linked with other dimensions that harbor monsters immune to conventional weaponry—emerged around the world. Alongside the appearance of the gates, various humans were transformed into hunters and bestowed superhuman abilities. Sung Jin-Woo is an E-rank hunter dubbed as the weakest hunter of all mankind. While exploring a supposedly safe dungeon, he and his party encounter an unusual tunnel leading to a deeper area.';

// ponytail: hardcoded port for the cross-origin iframe child. It must match
// scripts/serve-mock-pages.mjs. Upgrade path: pass via import.meta.env.
export const PLAYER_ORIGIN = 'http://127.0.0.1:4324';
export const PLAYER_PATH = '/index.html';

export function srtToVtt(cues: readonly SrtCue[]): string {
  const lines = ['WEBVTT', ''];
  for (const c of cues) {
    const start = msToVttTime(c.start);
    const end = msToVttTime(c.end);
    lines.push(String(c.index), `${start} --> ${end}`, c.text, '');
  }
  return lines.join('\n');
}

export function msToVttTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mmm = Math.floor(ms % 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(mmm).padStart(3, '0')}`;
}

export function buildIframeSrc(videoIndex: number, cues: readonly SrtCue[], subMode: 'hash' | 'track' = 'hash'): string {
  const url = new URL(PLAYER_PATH, PLAYER_ORIGIN);
  url.searchParams.set('mode', subMode);
  url.searchParams.set('v', String(videoIndex));
  if (subMode === 'hash') {
    const vttDataUrl = `data:text/vtt;charset=utf-8,${encodeURIComponent(srtToVtt(cues))}`;
    const subs = [
      { label: 'English', url: vttDataUrl, language: 'en', default: true },
      { label: 'Vietnamese', url: vttDataUrl, language: 'vi' },
    ];
    return `${url.toString()}#subs=${encodeURIComponent(JSON.stringify(subs))}`;
  }
  return url.toString();
}
