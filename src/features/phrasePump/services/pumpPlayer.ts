import type { PumpItem, PumpPhase, PumpState } from '../types';

export interface PumpPlaybackHandle {
  pause(): void;
  resume(): void;
  stop(): void;
}

export interface PumpPlayerDeps {
  /** Resolves when the utterance ends; rejects on engine error/timeout. */
  speak(text: string, langCode: string): Promise<void>;
  /** Stops in-flight TTS. */
  speakStop(): void;
  /** Plays a stored audio URL; resolves handle immediately, completion via promise. */
  playUrl(url: string): { handle: PumpPlaybackHandle; settled: Promise<void> };
  /** Warms the next item's audio while the current one plays (prefetch-1). */
  preloadUrl?(url: string): void;
  sleep(ms: number): Promise<void>;
}

export interface PumpPlayerCallbacks {
  onState(state: PumpState): void;
}

interface RunConfig {
  repeat: number;
  gapSeconds: number;
}

/**
 * Sequential pump player. One item at a time; asset items play through a real
 * media element (true pause), TTS items go through the speak engine where
 * pause = stop and resume replays the item from its start. Every await is
 * guarded by a generation counter so settlements arriving after a
 * user-initiated stop/skip are discarded — never counted, never replayed.
 */
export class PumpPlayer {
  private items: PumpItem[] = [];
  private index = 0;
  private repeatsDone = 0;
  private skipped = 0;
  private played = 0;
  private phase: PumpPhase = 'idle';
  private generation = 0;
  private active: PumpPlaybackHandle | null = null;
  private activeIsTts = false;
  private config: RunConfig = { repeat: 1, gapSeconds: 1 };

  constructor(
    private readonly deps: PumpPlayerDeps,
    private readonly cb: PumpPlayerCallbacks,
  ) {}

  getState(): PumpState {
    return {
      phase: this.phase,
      items: this.items,
      index: this.index,
      repeatsDone: this.repeatsDone,
      skipped: this.skipped,
      played: this.played,
    };
  }

  private emit(): void {
    this.cb.onState(this.getState());
  }

  private setPhase(phase: PumpPhase): void {
    this.phase = phase;
    this.emit();
  }

  start(items: readonly PumpItem[], config: RunConfig): void {
    this.haltActive();
    this.items = items.slice();
    this.index = 0;
    this.repeatsDone = 0;
    this.skipped = 0;
    this.played = 0;
    this.config = config;
    if (items.length === 0) {
      this.setPhase('empty');
      return;
    }
    this.setPhase('playing');
    void this.runCurrent();
  }

  pause(): void {
    if (this.phase !== 'playing') return;
    this.setPhase('paused');
    if (this.active && !this.activeIsTts) {
      this.active.pause();
      return;
    }
    // TTS item or inter-item gap: no resumable handle — invalidate the pending
    // settlement/advance; resume() replays the current item from its start.
    this.generation += 1;
    if (this.activeIsTts) this.deps.speakStop();
    this.active = null;
    this.activeIsTts = false;
  }

  resume(): void {
    if (this.phase !== 'paused') return;
    this.setPhase('playing');
    if (this.active === null) {
      void this.runCurrent();
    } else {
      this.active.resume();
    }
  }

  private haltActive(): void {
    this.generation += 1;
    this.active?.stop();
    if (this.activeIsTts) this.deps.speakStop();
    this.active = null;
    this.activeIsTts = false;
  }

  next(): void {
    if (this.items.length === 0) return;
    this.haltActive();
    this.repeatsDone = 0;
    if (this.index < this.items.length - 1) {
      this.index += 1;
      this.setPhase('playing');
      void this.runCurrent();
    } else {
      this.setPhase('done');
    }
  }

  prev(): void {
    if (this.items.length === 0) return;
    this.haltActive();
    this.repeatsDone = 0;
    this.index = Math.max(0, this.index - 1);
    this.setPhase('playing');
    void this.runCurrent();
  }

  stop(): void {
    this.haltActive();
    if (this.items.length === 0) {
      this.setPhase('empty');
      return;
    }
    this.setPhase('ready');
  }

  setRepeat(repeat: number): void {
    this.config = { ...this.config, repeat };
  }

  setGap(gapSeconds: number): void {
    this.config = { ...this.config, gapSeconds };
  }

  shuffleRemaining(): void {
    if (this.items.length - this.index <= 1) return;
    const rest = this.items.slice(this.index + 1);
    for (let i = rest.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    this.items = [...this.items.slice(0, this.index + 1), ...rest];
    this.emit();
  }

  private async runCurrent(): Promise<void> {
    const gen = ++this.generation;
    const item = this.items[this.index];
    if (!item) {
      this.setPhase('done');
      return;
    }
    this.emit();

    const upcoming = this.items[this.index + 1];
    if (upcoming?.audioUrl && this.deps.preloadUrl) {
      this.deps.preloadUrl(upcoming.audioUrl);
    }

    try {
      if (item.audioUrl) {
        this.activeIsTts = false;
        const { handle, settled } = this.deps.playUrl(item.audioUrl);
        this.active = handle;
        await settled;
        this.active = null;
      } else {
        this.activeIsTts = true;
        this.active = { pause: () => undefined, resume: () => undefined, stop: () => this.deps.speakStop() };
        await this.deps.speak(item.sentence, item.langCode);
      }
    } catch {
      // Settlements after a user-initiated stop/skip are stale — discard.
      if (gen !== this.generation) return;
      this.skipped += 1;
      this.repeatsDone = 0;
      await this.advance(gen);
      return;
    }

    if (gen !== this.generation) return;
    this.played += 1;
    this.repeatsDone += 1;
    if (this.repeatsDone < this.config.repeat) {
      void this.runCurrent();
      return;
    }
    this.repeatsDone = 0;
    await this.advance(gen);
  }

  private async advance(gen: number): Promise<void> {
    if (this.index >= this.items.length - 1) {
      if (gen === this.generation) this.setPhase('done');
      return;
    }
    this.index += 1;
    if (this.config.gapSeconds > 0) {
      this.emit();
      await this.deps.sleep(this.config.gapSeconds * 1000);
      if (gen !== this.generation) return;
    }
    this.setPhase('playing');
    void this.runCurrent();
  }
}

export function createUrlPlayback(url: string): { handle: PumpPlaybackHandle; settled: Promise<void> } {
  const audio = new Audio(url);
  let settledResolve!: () => void;
  let settledReject!: (err: unknown) => void;
  const settled = new Promise<void>((resolve, reject) => {
    settledResolve = resolve;
    settledReject = reject;
  });
  audio.addEventListener('ended', () => settledResolve());
  audio.addEventListener('error', () => settledReject(new Error('audio playback failed')));
  const handle: PumpPlaybackHandle = {
    pause: () => audio.pause(),
    resume: () => void audio.play(),
    stop: () => {
      audio.pause();
      audio.currentTime = 0;
      settledResolve();
    },
  };
  void audio.play().catch(settledReject);
  return { handle, settled };
}
