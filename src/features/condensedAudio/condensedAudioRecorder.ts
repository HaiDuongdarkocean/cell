import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { encodeBase64 } from '@/shared/lib/base64';
import type { CondenseAudioChunkPayload } from '@/entities/message';
import type { CueRange } from '@/entities/condensedAudio';
import { normalizeCueRanges } from './lib/cueRanges';
import {
  mountCondensedAudioPill,
  type CondensedAudioPillHandle,
} from './ui/mountCondensedAudioPill';

const TIMESLICE_MS = 5000;
const TICK_MS = 200;
const RANGE_EPSILON_MS = 120;

interface RecorderSession {
  readonly recordId: string;
  readonly ranges: CueRange[];
  readonly video: HTMLVideoElement;
  readonly recorder: MediaRecorder;
  readonly stream: MediaStream;
  readonly pill: CondensedAudioPillHandle;
  readonly startedAt: number;
  readonly previousRate: number;
  readonly tickId: number;
  readonly onTimeUpdate: () => void;
  readonly onEnded: () => void;
  rangeIdx: number;
  seq: number;
  stopped: boolean;
  pending: Promise<unknown>;
}

let session: RecorderSession | null = null;

function pickRecorderMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

function pickVideoElement(): HTMLVideoElement | null {
  const videos = [...document.querySelectorAll('video')].filter(
    (v) => Number.isFinite(v.duration) && v.duration > 0,
  );
  videos.sort((a, b) => b.duration - a.duration);
  return videos[0] ?? null;
}

function postChunk(payload: CondenseAudioChunkPayload): void {
  void sendMessage({ type: MESSAGE_TYPES.CONDENSE_AUDIO_CHUNK, payload });
}

function failSession(recordId: string, reason: string): void {
  postChunk({ recordId, seq: 0, dataBase64: '', error: reason });
}

function tickSession(s: RecorderSession): void {
  if (s.stopped) return;
  const video = s.video;
  if (video.seeking) return;
  const timeMs = video.currentTime * 1000;
  while (s.rangeIdx < s.ranges.length && timeMs >= s.ranges[s.rangeIdx]!.endMs) {
    s.rangeIdx += 1;
  }
  const range = s.ranges[s.rangeIdx];
  if (!range) {
    void finalizeSession(s);
    return;
  }
  if (timeMs < range.startMs - RANGE_EPSILON_MS) {
    video.currentTime = range.startMs / 1000;
    if (video.paused) void video.play().catch(() => undefined);
  }
}

async function finalizeSession(s: RecorderSession): Promise<void> {
  if (s.stopped) return;
  s.stopped = true;
  await new Promise<void>((resolve) => {
    s.recorder.onstop = () => resolve();
    try {
      if (s.recorder.state !== 'inactive') s.recorder.stop();
      else resolve();
    } catch {
      resolve();
    }
  });
  await s.pending.catch(() => undefined);
  postChunk({
    recordId: s.recordId,
    seq: s.seq,
    dataBase64: '',
    last: true,
    mimeType: s.recorder.mimeType || undefined,
    elapsedMs: Date.now() - s.startedAt,
  });
  teardownSession(s);
}

function abortSession(recordId: string, silent: boolean): void {
  const s = session;
  if (!s || s.recordId !== recordId || s.stopped) return;
  s.stopped = true;
  try {
    if (s.recorder.state !== 'inactive') s.recorder.stop();
  } catch {
  }
  if (!silent) {
    postChunk({ recordId, seq: s.seq, dataBase64: '', error: 'cancelled' });
  }
  teardownSession(s);
}

function teardownSession(s: RecorderSession): void {
  clearInterval(s.tickId);
  s.video.removeEventListener('timeupdate', s.onTimeUpdate);
  s.video.removeEventListener('ended', s.onEnded);
  s.video.playbackRate = s.previousRate;
  s.stream.getTracks().forEach((track) => track.stop());
  s.pill.unmount();
  if (session === s) session = null;
}

export function startCondensedAudioSession(
  recordId: string,
  rawRanges: readonly CueRange[],
): { ok: true } | { ok: false; error: string } {
  if (session) {
    if (session.recordId === recordId) return { ok: true };
    abortSession(session.recordId, false);
  }
  const video = pickVideoElement();
  if (!video || video.muted || video.volume === 0) {
    failSession(recordId, video ? 'capture-blocked' : 'no-source');
    return { ok: false, error: video ? 'capture-blocked' : 'no-source' };
  }
  const captureFn =
    (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream ??
    (video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream;
  if (typeof MediaRecorder === 'undefined' || !captureFn) {
    failSession(recordId, 'capture-blocked');
    return { ok: false, error: 'capture-blocked' };
  }
  let stream: MediaStream;
  try {
    stream = captureFn.call(video);
  } catch {
    failSession(recordId, 'capture-blocked');
    return { ok: false, error: 'capture-blocked' };
  }
  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) {
    stream.getTracks().forEach((track) => track.stop());
    failSession(recordId, 'capture-blocked');
    return { ok: false, error: 'capture-blocked' };
  }
  const audioStream = new MediaStream(audioTracks);
  const mimeType = pickRecorderMimeType();
  let recorder: MediaRecorder;
  try {
    recorder = mimeType
      ? new MediaRecorder(audioStream, { mimeType })
      : new MediaRecorder(audioStream);
  } catch {
    audioStream.getTracks().forEach((track) => track.stop());
    failSession(recordId, 'capture-blocked');
    return { ok: false, error: 'capture-blocked' };
  }
  const durationMs = Number.isFinite(video.duration) ? video.duration * 1000 : 0;
  const ranges = normalizeCueRanges(rawRanges, 0, durationMs);
  if (ranges.length === 0) {
    audioStream.getTracks().forEach((track) => track.stop());
    failSession(recordId, 'no-cues');
    return { ok: false, error: 'no-cues' };
  }
  const startedAt = Date.now();
  const s = {} as RecorderSession;
  const pill = mountCondensedAudioPill(video, startedAt, () => void finalizeSession(s));
  const onTimeUpdate = (): void => tickSession(s);
  const onEnded = (): void => void finalizeSession(s);
  Object.assign(s, {
    recordId,
    ranges,
    video,
    recorder,
    stream: audioStream,
    pill,
    startedAt,
    previousRate: video.playbackRate,
    tickId: window.setInterval(() => {
      tickSession(s);
      pill.updatePosition();
    }, TICK_MS),
    onTimeUpdate,
    onEnded,
    rangeIdx: 0,
    seq: 0,
    stopped: false,
    pending: Promise.resolve(),
  });
  session = s;
  recorder.ondataavailable = (e: BlobEvent) => {
    if (!e.data.size) return;
    s.pending = s.pending.then(async () => {
      const buf = await e.data.arrayBuffer();
      postChunk({
        recordId,
        seq: s.seq,
        dataBase64: encodeBase64(buf),
        elapsedMs: Date.now() - startedAt,
      });
      s.seq += 1;
    });
  };
  recorder.onerror = () => {
    abortSession(recordId, true);
    failSession(recordId, 'capture-blocked');
  };
  video.addEventListener('timeupdate', onTimeUpdate);
  video.addEventListener('ended', onEnded);
  try {
    recorder.start(TIMESLICE_MS);
  } catch {
    abortSession(recordId, true);
    failSession(recordId, 'capture-blocked');
    return { ok: false, error: 'capture-blocked' };
  }
  video.playbackRate = 1;
  video.currentTime = ranges[0]!.startMs / 1000;
  void video.play().catch(() => undefined);
  return { ok: true };
}

export function stopCondensedAudioSession(recordId: string): void {
  abortSession(recordId, false);
}

export function isCondensedAudioSessionActive(recordId?: string): boolean {
  if (!session) return false;
  return recordId === undefined || session.recordId === recordId;
}
