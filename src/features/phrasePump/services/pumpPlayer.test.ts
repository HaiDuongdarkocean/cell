import { PumpPlayer, type PumpPlayerDeps } from './pumpPlayer';
import type { PumpItem, PumpState } from '../types';

function ttsItem(id: string, sentence = `s-${id}`): PumpItem {
  return { id, source: 'srs', refId: id, sentence, langCode: 'en' };
}

function assetItem(id: string): PumpItem {
  return { id, source: 'srs', refId: id, sentence: `s-${id}`, langCode: 'en', audioUrl: `blob:${id}` };
}

function deps(overrides: Partial<PumpPlayerDeps> = {}): { deps: PumpPlayerDeps; speakCalls: string[]; stops: number } {
  const speakCalls: string[] = [];
  let stops = 0;
  return {
    speakCalls,
    get stops() { return stops; },
    deps: {
      speak: jest.fn(async (text: string) => { speakCalls.push(text); }),
      speakStop: jest.fn(() => { stops += 1; }),
      playUrl: jest.fn(() => {
        let resolveSettled!: () => void;
        const settled = new Promise<void>((r) => { resolveSettled = r; });
        queueMicrotask(() => resolveSettled());
        return { handle: { pause: jest.fn(), resume: jest.fn(), stop: jest.fn() }, settled };
      }),
      sleep: jest.fn(async () => undefined),
      ...overrides,
    },
  };
}

function collect(): { states: PumpState[]; cb: { onState(s: PumpState): void } } {
  const states: PumpState[] = [];
  return { states, cb: { onState: (s) => states.push(s) } };
}

async function flush(times = 8): Promise<void> {
  for (let i = 0; i < times; i += 1) await Promise.resolve();
}

describe('PumpPlayer', () => {
  it('plays items in order and finishes done', async () => {
    const { deps: d, speakCalls } = deps();
    const { states, cb } = collect();
    const p = new PumpPlayer(d, cb);
    p.start([ttsItem('a'), ttsItem('b')], { repeat: 1, gapSeconds: 0 });
    await flush();
    expect(speakCalls).toEqual(['s-a', 's-b']);
    expect(states.at(-1)?.phase).toBe('done');
    expect(states.at(-1)?.played).toBe(2);
    expect(states.at(-1)?.skipped).toBe(0);
  });

  it('prefetches the next item audio while the current plays', async () => {
    const preloads: string[] = [];
    const { deps: d } = deps({ preloadUrl: jest.fn((url: string) => { preloads.push(url); }) });
    const { cb } = collect();
    const p = new PumpPlayer(d, cb);
    p.start([assetItem('a'), assetItem('b'), ttsItem('c')], { repeat: 1, gapSeconds: 0 });
    await flush();
    expect(preloads).toEqual(['blob:b']);
  });

  it('repeats an item N times before advancing', async () => {
    const { deps: d, speakCalls } = deps();
    const { cb } = collect();
    const p = new PumpPlayer(d, cb);
    p.start([ttsItem('a'), ttsItem('b')], { repeat: 2, gapSeconds: 0 });
    await flush();
    expect(speakCalls).toEqual(['s-a', 's-a', 's-b', 's-b']);
  });

  it('waits the gap between items', async () => {
    const sleepCalls: number[] = [];
    const { deps: d } = deps({ sleep: jest.fn(async (ms: number) => { sleepCalls.push(ms); }) });
    const { cb } = collect();
    const p = new PumpPlayer(d, cb);
    p.start([ttsItem('a'), ttsItem('b')], { repeat: 1, gapSeconds: 2 });
    await flush();
    expect(sleepCalls).toEqual([2000]);
  });

  it('counts engine failures as skips and continues', async () => {
    let n = 0;
    const { deps: d } = deps({
      speak: jest.fn(async () => { n += 1; if (n === 1) throw new Error('no voice'); }),
    });
    const { states, cb } = collect();
    const p = new PumpPlayer(d, cb);
    p.start([ttsItem('a'), ttsItem('b')], { repeat: 1, gapSeconds: 0 });
    await flush();
    const last = states.at(-1)!;
    expect(last.phase).toBe('done');
    expect(last.skipped).toBe(1);
    expect(last.played).toBe(1);
  });

  it('discards a late TTS rejection after user pause — not a skip', async () => {
    let rejectSpeak!: (e: Error) => void;
    const speakStopped = jest.fn();
    const { deps: d } = deps({
      speak: jest.fn(() => new Promise<void>((_, rej) => { rejectSpeak = rej; })),
      speakStop: speakStopped,
    });
    const { states, cb } = collect();
    const p = new PumpPlayer(d, cb);
    p.start([ttsItem('a')], { repeat: 1, gapSeconds: 0 });
    await flush(2);
    p.pause();
    rejectSpeak(new Error('interrupted'));
    await flush();
    const last = states.at(-1)!;
    expect(last.phase).toBe('paused');
    expect(last.skipped).toBe(0);
    p.resume();
    await flush(2);
    // resume replays the item from its start — a second speak call fires
    expect((d.speak as jest.Mock).mock.calls.length).toBe(2);
  });

  it('discards a late rejection after skip-next', async () => {
    let rejectSpeak!: (e: Error) => void;
    const speakCalls: string[] = [];
    const { deps: d } = deps({
      speak: jest.fn((text: string) => {
        speakCalls.push(text);
        return text === 's-a' ? new Promise<void>((_, rej) => { rejectSpeak = rej; }) : Promise.resolve();
      }),
    });
    const { states, cb } = collect();
    const p = new PumpPlayer(d, cb);
    p.start([ttsItem('a'), ttsItem('b')], { repeat: 1, gapSeconds: 0 });
    await flush(2);
    p.next();
    rejectSpeak(new Error('cancelled'));
    await flush();
    const last = states.at(-1)!;
    expect(last.phase).toBe('done');
    expect(last.skipped).toBe(0);
    expect(speakCalls).toContain('s-b');
  });

  it('uses the audio element path for asset items and never calls speak', async () => {
    const { deps: d, speakCalls } = deps();
    const { states, cb } = collect();
    const p = new PumpPlayer(d, cb);
    p.start([assetItem('a'), ttsItem('b')], { repeat: 1, gapSeconds: 0 });
    await flush();
    expect(d.playUrl).toHaveBeenCalledWith('blob:a');
    expect(speakCalls).toEqual(['s-b']);
    expect(states.at(-1)?.phase).toBe('done');
  });

  it('pause/resume on an asset item calls pause/resume on the handle', async () => {
    const handle = { pause: jest.fn(), resume: jest.fn(), stop: jest.fn() };
    const { deps: d } = deps({
      playUrl: jest.fn(() => ({ handle, settled: new Promise<void>(() => {}) })),
    });
    const { states, cb } = collect();
    const p = new PumpPlayer(d, cb);
    p.start([assetItem('a')], { repeat: 1, gapSeconds: 0 });
    await flush(2);
    p.pause();
    expect(handle.pause).toHaveBeenCalled();
    p.resume();
    expect(handle.resume).toHaveBeenCalled();
    expect(states.at(-1)?.phase).toBe('playing');
  });

  it('stop returns to ready with the list kept', async () => {
    const { deps: d } = deps();
    const { states, cb } = collect();
    const p = new PumpPlayer(d, cb);
    p.start([ttsItem('a')], { repeat: 1, gapSeconds: 0 });
    await flush(2);
    p.stop();
    const last = states.at(-1)!;
    expect(last.phase).toBe('ready');
    expect(last.items).toHaveLength(1);
  });

  it('shuffle reorders remaining items, keeps current', async () => {
    const { deps: d, speakCalls } = deps();
    const { states, cb } = collect();
    const p = new PumpPlayer(d, cb);
    const items = ['a', 'b', 'c', 'd'].map((id) => ttsItem(id));
    // Hold the first speak so we can shuffle mid-item.
    let release!: () => void;
    d.speak = jest.fn(() => new Promise<void>((r) => { release = r; }));
    p.start(items, { repeat: 1, gapSeconds: 0 });
    await flush(2);
    p.shuffleRemaining();
    const ids = states.at(-1)!.items.map((i) => i.id);
    expect(ids[0]).toBe('a');
    expect(ids.slice(1).sort()).toEqual(['b', 'c', 'd']);
    release();
    void speakCalls;
  });

  it('start with zero items lands on empty', () => {
    const { deps: d } = deps();
    const { states, cb } = collect();
    const p = new PumpPlayer(d, cb);
    p.start([], { repeat: 1, gapSeconds: 0 });
    expect(states.at(-1)?.phase).toBe('empty');
  });
});
