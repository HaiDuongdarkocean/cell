// ttsQueue — audio playback queue for local TTS.
//
// Pure playback manager: receives AudioBuffer instances, plays them in order,
// supports pause / resume / stop. Keeps the queue so longer text (reader) can
// be chunked into many buffers and still controlled as one session.

export interface TtsAudioQueueItem {
  readonly audioBuffer: AudioBuffer;
  readonly onStart?: () => void;
  readonly onEnd?: () => void;
}

export interface TtsAudioQueue {
  readonly isPlaying: boolean;
  readonly isPaused: boolean;
  readonly length: number;
  enqueue(item: TtsAudioQueueItem): void;
  play(): void;
  pause(): void;
  resume(): void;
  stop(): void;
}

interface QueueState {
  items: TtsAudioQueueItem[];
  currentIndex: number;
  audioContext: AudioContext | undefined;
  currentSource: AudioBufferSourceNode | undefined;
  playing: boolean;
  paused: boolean;
}

function getAudioContext(): AudioContext {
  const AudioContextCtor = globalThis.AudioContext as
    | (new () => AudioContext)
    | undefined;
  if (!AudioContextCtor) {
    throw new Error('AudioContext is not available in this environment');
  }
  return new AudioContextCtor();
}

function playNext(state: QueueState): void {
  if (state.currentIndex >= state.items.length) {
    state.playing = false;
    state.paused = false;
    state.currentSource = undefined;
    return;
  }

  if (!state.audioContext) {
    state.audioContext = getAudioContext();
  }

  const item = state.items[state.currentIndex];
  const source = state.audioContext.createBufferSource();
  source.buffer = item.audioBuffer;
  source.connect(state.audioContext.destination);
  source.onended = (): void => {
    if (state.currentSource !== source) return;
    state.currentSource = undefined;
    item.onEnd?.();
    state.currentIndex += 1;
    playNext(state);
  };

  state.currentSource = source;
  state.playing = true;
  state.paused = false;
  item.onStart?.();

  void state.audioContext.resume().then(() => {
    source.start();
  });
}

function stopSource(state: QueueState): void {
  const source = state.currentSource;
  if (!source) return;
  try {
    source.stop();
  } catch {
    // stop() throws if the source has already ended or stopped.
  }
  state.currentSource = undefined;
}

export function createTtsAudioQueue(): TtsAudioQueue {
  const state: QueueState = {
    items: [],
    currentIndex: 0,
    audioContext: undefined,
    currentSource: undefined,
    playing: false,
    paused: false,
  };

  return {
    get isPlaying() {
      return state.playing && !state.paused;
    },
    get isPaused() {
      return state.paused;
    },
    get length() {
      return state.items.length;
    },
    enqueue(item) {
      state.items.push(item);
      if (!state.playing && !state.paused) {
        playNext(state);
      }
    },
    play() {
      if (state.paused && state.audioContext) {
        state.paused = false;
        void state.audioContext.resume().then(() => {
          if (state.currentSource) return;
          playNext(state);
        });
        return;
      }
      if (!state.playing) {
        playNext(state);
      }
    },
    pause() {
      if (!state.playing || state.paused || !state.audioContext) return;
      state.paused = true;
      void state.audioContext.suspend();
    },
    resume() {
      if (!state.paused) return;
      state.paused = false;
      if (state.currentSource) {
        void state.audioContext?.resume();
      } else {
        playNext(state);
      }
    },
    stop() {
      stopSource(state);
      state.items = [];
      state.currentIndex = 0;
      state.playing = false;
      state.paused = false;
      if (state.audioContext?.state === 'running') {
        void state.audioContext.suspend();
      }
    },
  };
}
