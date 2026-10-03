import { MESSAGE_TYPES } from '@/shared/config/messages';
import { sendMessage } from '@/shared/lib/chrome-apis/runtime';
import { encodeBase64 } from '@/shared/lib/base64';
import { pauseVideo, playVideo, seekVideo } from '@/shared/lib/dom/netflixPlayback';
import { findLargestPlayableVideo, getAllVideos } from '@/shared/lib/dom/videoFinder';
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
const MIN_SEEK_GAP_MS = 2000;
const SEEK_RETRY_MS = 2000;
const SEEK_GRACE_MS = 2500;
const PLAY_RETRY_MS = 1000;
const PLAY_GRACE_MS = 1500;
const PAUSE_GIVE_UP_MS = 10_000;
const SOURCE_WAIT_MS = 8_000;
const SOURCE_WAIT_POLL_MS = 250;
const DONE_AUTO_HIDE_MS = 60_000;

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
  pausedByUser: boolean;
  seenPlaying: boolean;
  seekPending: boolean;
  seekedRangeIdx: number;
  lastSeekAt: number;
  lastPlayCmdAt: number;
  pausedSince: number;
  reanchors: number;
  capturedMs: number;
  lastTickAt: number;
  pending: Promise<unknown>;
}

let session: RecorderSession | null = null;

interface FinishedPill {
  readonly recordId: string;
  readonly pill: CondensedAudioPillHandle;
  autoHideId: number;
}

let finishedPill: FinishedPill | null = null;

function dismissFinishedPill(): void {
  if (!finishedPill) return;
  window.clearTimeout(finishedPill.autoHideId);
  finishedPill.pill.unmount();
  finishedPill = null;
}

function pickRecorderMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

function pickVideoElement(): HTMLVideoElement | null {
  const visible = findLargestPlayableVideo();
  if (visible && Number.isFinite(visible.duration) && visible.duration > 0) {
    return visible;
  }
  const videos = getAllVideos().filter(
    (v) => Number.isFinite(v.duration) && v.duration > 0,
  );
  videos.sort((a, b) => b.duration - a.duration);
  return videos[0] ?? null;
}

async function waitForVideoSource(): Promise<HTMLVideoElement | null> {
  const deadline = Date.now() + SOURCE_WAIT_MS;
  let video = pickVideoElement();
  while (!video && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, SOURCE_WAIT_POLL_MS));
    video = pickVideoElement();
  }
  return video;
}

function postChunk(payload: CondenseAudioChunkPayload): void {
  void sendMessage({ type: MESSAGE_TYPES.CONDENSE_AUDIO_CHUNK, payload });
}

function failSession(recordId: string, reason: string): void {
  postChunk({ recordId, seq: 0, dataBase64: '', error: reason });
}

function syncRecorder(s: RecorderSession, inRange: boolean): void {
  const video = s.video;
  const wantRecording =
    !s.pausedByUser && inRange && !video.seeking && !video.paused && !video.ended;
  try {
    if (wantRecording && s.recorder.state === 'paused') s.recorder.resume();
    else if (!wantRecording && s.recorder.state === 'recording') s.recorder.pause();
  } catch {
  }
}

function commandPlay(s: RecorderSession): void {
  const now = Date.now();
  if (now - s.lastPlayCmdAt < PLAY_RETRY_MS) return;
  s.lastPlayCmdAt = now;
  void playVideo(s.video).catch(() => undefined);
}

function setSessionPaused(s: RecorderSession, paused: boolean): void {
  if (s.stopped || s.pausedByUser === paused) return;
  s.pausedByUser = paused;
  s.pill.setPaused(paused);
  if (paused) {
    syncRecorder(s, false);
    pauseVideo(s.video);
    return;
  }
  s.seekedRangeIdx = -1;
  s.seekPending = false;
  if (s.video.paused && !s.video.ended) commandPlay(s);
  tickSession(s);
}

function maybeSeekTo(s: RecorderSession, range: CueRange, timeMs: number, now: number): void {
  if (s.pausedByUser) return;
  if (range.startMs - timeMs <= MIN_SEEK_GAP_MS) return;
  if (s.seekedRangeIdx === s.rangeIdx && now - s.lastSeekAt < SEEK_RETRY_MS) return;
  s.seekedRangeIdx = s.rangeIdx;
  s.lastSeekAt = now;
  s.seekPending = true;
  seekVideo(s.video, range.startMs / 1000);
}

function reanchorSession(s: RecorderSession, now: number): boolean {
  if (s.capturedMs > 0 || s.reanchors >= 2) return false;
  s.reanchors += 1;
  s.rangeIdx = 0;
  s.seekedRangeIdx = 0;
  s.lastSeekAt = now;
  s.seekPending = true;
  seekVideo(s.video, s.ranges[0]!.startMs / 1000);
  return true;
}

function recoverOrPause(s: RecorderSession, now: number): void {
  if (s.pausedByUser) return;
  if (s.seekPending && now - s.lastSeekAt <= SEEK_GRACE_MS) {
    commandPlay(s);
    return;
  }
  if (s.pausedSince > 0 && now - s.pausedSince >= PAUSE_GIVE_UP_MS) {
    s.seekPending = false;
    setSessionPaused(s, true);
    return;
  }
  if (now - s.lastPlayCmdAt < PLAY_GRACE_MS) return;
  commandPlay(s);
}

function tickSession(s: RecorderSession): void {
  if (s.stopped) return;
  const video = s.video;
  const now = Date.now();
  if (s.recorder.state === 'recording') s.capturedMs += now - s.lastTickAt;
  s.lastTickAt = now;
  if (!video.paused) {
    s.seenPlaying = true;
    s.lastPlayCmdAt = 0;
    s.pausedSince = 0;
    if (!video.seeking) s.seekPending = false;
    if (s.pausedByUser) {
      setSessionPaused(s, false);
      return;
    }
  } else if (s.pausedSince === 0) {
    s.pausedSince = now;
  }
  if (video.seeking || video.ended) {
    syncRecorder(s, false);
    if (video.ended && !video.seeking) {
      if (reanchorSession(s, now)) {
        if (!s.pausedByUser) commandPlay(s);
        return;
      }
      void finalizeSession(s);
    }
    return;
  }
  const timeMs = video.currentTime * 1000;
  while (s.rangeIdx < s.ranges.length && timeMs >= s.ranges[s.rangeIdx]!.endMs) {
    s.rangeIdx += 1;
  }
  const range = s.ranges[s.rangeIdx];
  if (!range) {
    if (reanchorSession(s, now)) return;
    void finalizeSession(s);
    return;
  }
  const inRange = timeMs >= range.startMs - RANGE_EPSILON_MS && timeMs < range.endMs;
  if (video.paused) {
    syncRecorder(s, false);
    if (!s.pausedByUser && !inRange && !s.seenPlaying) {
      maybeSeekTo(s, range, timeMs, now);
    }
    recoverOrPause(s, now);
    return;
  }
  if (!inRange) {
    syncRecorder(s, false);
    maybeSeekTo(s, range, timeMs, now);
    return;
  }
  syncRecorder(s, true);
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
    elapsedMs: s.capturedMs,
  });
  teardownSession(s, true);
  s.pill.setPhase('done');
  finishedPill = {
    recordId: s.recordId,
    pill: s.pill,
    autoHideId: window.setTimeout(dismissFinishedPill, DONE_AUTO_HIDE_MS),
  };
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

function teardownSession(s: RecorderSession, keepPill = false): void {
  clearInterval(s.tickId);
  s.video.removeEventListener('timeupdate', s.onTimeUpdate);
  s.video.removeEventListener('ended', s.onEnded);
  s.video.playbackRate = s.previousRate;
  if (!s.video.ended) pauseVideo(s.video);
  s.stream.getTracks().forEach((track) => track.stop());
  if (!keepPill) s.pill.unmount();
  if (session === s) session = null;
}

export interface CondensedAudioSessionOptions {
  readonly onOpenLibrary?: () => void;
}

export async function startCondensedAudioSession(
  recordId: string,
  rawRanges: readonly CueRange[],
  padMs = 0,
  opts: CondensedAudioSessionOptions = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (session) {
    if (session.recordId === recordId) return { ok: true };
    abortSession(session.recordId, false);
  }
  dismissFinishedPill();
  const video = await waitForVideoSource();
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
  const ranges = normalizeCueRanges(rawRanges, padMs, durationMs);
  if (ranges.length === 0) {
    audioStream.getTracks().forEach((track) => track.stop());
    failSession(recordId, 'no-cues');
    return { ok: false, error: 'no-cues' };
  }
  const startedAt = Date.now();
  const s = { capturedMs: 0 } as RecorderSession;
  const pill = mountCondensedAudioPill(video, {
    getElapsedMs: () => s.capturedMs,
    onStop: () => void finalizeSession(s),
    onTogglePause: () => setSessionPaused(s, !s.pausedByUser),
    onDiscard: () => abortSession(recordId, false),
    onOpenLibrary: () => {
      opts.onOpenLibrary?.();
      dismissFinishedPill();
    },
    onDismissDone: dismissFinishedPill,
  });
  const onTimeUpdate = (): void => tickSession(s);
  const onEnded = (): void => tickSession(s);
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
    pausedByUser: false,
    seenPlaying: false,
    seekPending: false,
    seekedRangeIdx: -1,
    lastSeekAt: 0,
    lastPlayCmdAt: 0,
    pausedSince: 0,
    reanchors: 0,
    capturedMs: 0,
    lastTickAt: startedAt,
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
        elapsedMs: s.capturedMs,
      });
      s.seq += 1;
    }).catch(() => undefined);
  };
  recorder.onerror = () => {
    abortSession(recordId, true);
    failSession(recordId, 'capture-blocked');
  };
  video.addEventListener('timeupdate', onTimeUpdate);
  video.addEventListener('ended', onEnded);
  try {
    recorder.start(TIMESLICE_MS);
    recorder.pause();
  } catch {
    abortSession(recordId, true);
    failSession(recordId, 'capture-blocked');
    return { ok: false, error: 'capture-blocked' };
  }
  video.playbackRate = 1;
  s.lastSeekAt = startedAt;
  s.seekedRangeIdx = 0;
  s.seekPending = true;
  seekVideo(video, ranges[0]!.startMs / 1000);
  commandPlay(s);
  return { ok: true };
}

export function setCondensedAudioSessionPaused(recordId: string, paused: boolean): void {
  const s = session;
  if (!s || s.recordId !== recordId) return;
  setSessionPaused(s, paused);
}

export function stopCondensedAudioSession(recordId: string): void {
  abortSession(recordId, false);
  if (finishedPill?.recordId === recordId) dismissFinishedPill();
}

export function notifyCondensedAudioRecordStatus(recordId: string, status: string): void {
  if (!finishedPill || finishedPill.recordId !== recordId) return;
  if (status === 'ready') {
    window.clearTimeout(finishedPill.autoHideId);
    finishedPill.autoHideId = window.setTimeout(dismissFinishedPill, DONE_AUTO_HIDE_MS);
    finishedPill.pill.setPhase('ready');
    return;
  }
  if (status === 'failed' || status === 'missing' || status === 'removed') {
    dismissFinishedPill();
  }
}

export function isCondensedAudioSessionActive(recordId?: string): boolean {
  if (!session) return false;
  return recordId === undefined || session.recordId === recordId;
}
