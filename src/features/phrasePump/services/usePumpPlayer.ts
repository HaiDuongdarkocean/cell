import { useCallback, useMemo, useState } from 'react';
import { createTtsEngine } from '@/features/tts';
import { PumpPlayer, createUrlPlayback, type PumpPlayerDeps } from './pumpPlayer';
import type { PumpConfig, PumpItem, PumpState } from '../types';
import { buildPumpItems } from './pumpSources';

const INITIAL: PumpState = {
  phase: 'idle',
  items: [],
  index: 0,
  repeatsDone: 0,
  skipped: 0,
  played: 0,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const warmPool: HTMLAudioElement[] = [];

function preloadUrl(url: string): void {
  if (!url.startsWith('http')) return;
  const audio = new Audio();
  audio.preload = 'auto';
  audio.src = url;
  warmPool.push(audio);
  if (warmPool.length > 8) warmPool.shift();
}

export interface PumpController {
  readonly state: PumpState;
  readonly build: (deckId: string | null, includeSubdecks: boolean, includeQueue: boolean) => Promise<PumpItem[]>;
  readonly start: (items: readonly PumpItem[], config: Pick<PumpConfig, 'repeat' | 'gapSeconds' | 'shuffle'>) => void;
  readonly pause: () => void;
  readonly resume: () => void;
  readonly next: () => void;
  readonly prev: () => void;
  readonly stop: () => void;
  readonly shuffle: () => void;
  readonly setRepeat: (n: number) => void;
  readonly setGap: (n: number) => void;
}

export function usePumpPlayer(): PumpController {
  const [state, setState] = useState<PumpState>(INITIAL);

  const player = useMemo(() => {
    const engine = createTtsEngine();
    const deps: PumpPlayerDeps = {
      speak: (text, langCode) => engine.speak(text, { langCode }),
      speakStop: () => engine.stop(),
      playUrl: (url) => createUrlPlayback(url),
      preloadUrl,
      sleep,
    };
    return new PumpPlayer(deps, { onState: setState });
  }, []);

  const build = useCallback(async (deckId: string | null, includeSubdecks: boolean, includeQueue: boolean) => {
    setState((s) => ({ ...s, phase: 'building' }));
    try {
      const items = await buildPumpItems({ deckId, includeSubdecks, includeQueue });
      setState({ phase: items.length === 0 ? 'empty' : 'ready', items, index: 0, repeatsDone: 0, skipped: 0, played: 0 });
      return items;
    } catch (err) {
      setState((s) => ({ ...s, phase: 'error', error: err instanceof Error ? err.message : String(err) }));
      return [];
    }
  }, []);

  const start = useCallback(
    (items: readonly PumpItem[], config: Pick<PumpConfig, 'repeat' | 'gapSeconds' | 'shuffle'>) => {
      player.start(items, { repeat: config.repeat, gapSeconds: config.gapSeconds });
      if (config.shuffle) player.shuffleRemaining();
    },
    [player],
  );

  const shuffle = useCallback(() => player.shuffleRemaining(), [player]);
  const pause = useCallback(() => player.pause(), [player]);
  const resume = useCallback(() => player.resume(), [player]);
  const next = useCallback(() => player.next(), [player]);
  const prev = useCallback(() => player.prev(), [player]);
  const stop = useCallback(() => player.stop(), [player]);
  const setRepeat = useCallback((n: number) => player.setRepeat(n), [player]);
  const setGap = useCallback((n: number) => player.setGap(n), [player]);

  return { state, build, start, pause, resume, next, prev, stop, shuffle, setRepeat, setGap };
}
