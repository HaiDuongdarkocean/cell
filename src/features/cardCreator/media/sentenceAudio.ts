/**
 * Sentence audio extraction — capture audio from a `<video>` element for a
 * cue's time range using MediaRecorder + captureStream.
 *
 * Approach:
 * 1. Seek video to cue.start.
 * 2. Create captureStream (audio-only) from the video element.
 * 3. Start MediaRecorder.
 * 4. Play video until cue.end (or trimmed end if cue > 15s — 4GB mobile).
 * 5. Stop recorder → Blob → ArrayBuffer.
 *
 * Fallback: if MediaRecorder or captureStream is unsupported (older Kiwi),
 * return null + the caller shows a non-blocking warning. We never throw —
 * audio is optional; screenshot + translation can still proceed.
 *
 * Performance constraint (4GB mobile): cue longer than 15s → trim to 15s.
 * Avoid blocking: if document.hidden, skip audio (screenshot only).
 */
import type { MediaFile } from './mediaFile';
import { generateMediaFilename } from './mediaFile';
import { seekVideo, playVideo, pauseVideo } from '@/shared/lib/dom/netflixPlayback';
import { t } from '@/shared/i18n';

/** Max audio capture duration (4GB mobile constraint). */
const MAX_AUDIO_DURATION_MS = 15_000;

/**
 * Post-seek landing tolerance. A seek counts as landed when |currentTime -
 * target| stays under this. Generous enough for keyframe snapping (Netflix)
 * yet tight enough to refuse recording a different sentence's audio.
 */
const SEEK_LAND_TOLERANCE_SEC = 0.75;

/** Result: either a MediaFile or null (unsupported/skipped/failed). */
export type SentenceAudioResult =
  | { ok: true; file: MediaFile }
  | { ok: false; reason: 'unsupported' | 'hidden' | 'failed'; error?: string };

// Serializes captures per video element: two lookups must not fight over
// video.currentTime mid-recording. Chained so a failed capture never blocks
// the next one.
const captureChains = new WeakMap<HTMLVideoElement, Promise<unknown>>();

/**
 * Capture audio for a subtitle cue's time range.
 *
 * @param video - The video element to capture audio from.
 * @param cue - The cue with start/end in milliseconds.
 * @returns SentenceAudioResult — never throws.
 */
export function captureSentenceAudio(
  video: HTMLVideoElement,
  cue: { start: number; end: number },
): Promise<SentenceAudioResult> {
  const prev = captureChains.get(video) ?? Promise.resolve();
  const run = prev.then(() => captureSentenceAudioOnce(video, cue));
  captureChains.set(
    video,
    run.catch(() => undefined),
  );
  return run;
}

async function captureSentenceAudioOnce(
  video: HTMLVideoElement,
  cue: { start: number; end: number },
): Promise<SentenceAudioResult> {
  // Skip if tab hidden (avoid blocking / wasted work).
  if (document.hidden) {
    return { ok: false, reason: 'hidden' };
  }

  const captureStreamFn = (video as HTMLVideoElement & {
    captureStream?: () => MediaStream;
  }).captureStream;
  if (typeof MediaRecorder === 'undefined' || !captureStreamFn) {
    return { ok: false, reason: 'unsupported' };
  }

  const durationMs = Math.min(cue.end - cue.start, MAX_AUDIO_DURATION_MS);
  if (durationMs <= 0) {
    return { ok: false, reason: 'failed', error: t('cardCreator.error.audioCueEmpty') };
  }

  try {
    // Seek to cue start and require the video to actually land there with
    // decodable data — otherwise we'd silently record a different sentence.
    const landed = await seekAndWaitReady(video, cue.start / 1000);
    if (!landed) {
      console.warn(
        '[sentenceAudio] seek did not reach cue start:',
        cue.start / 1000,
        'currentTime:',
        video.currentTime,
      );
      return { ok: false, reason: 'failed', error: t('cardCreator.error.audioSeek') };
    }

    // Capture audio-only stream.
    const stream = captureStreamFn.call(video);
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      return { ok: false, reason: 'unsupported', error: 'No audio tracks' };
    }
    const audioStream = new MediaStream(audioTracks);

    // Pick mime type — prefer mp3, fall back to webm (Kiwi default).
    const mimeType = pickAudioMimeType();
    const recorder = mimeType
      ? new MediaRecorder(audioStream, { mimeType })
      : new MediaRecorder(audioStream);

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    recorder.start();
    await playForDuration(video, durationMs / 1000);
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
    await stopped;

    if (chunks.length === 0) {
      return { ok: false, reason: 'failed', error: t('cardCreator.error.audioNoData') };
    }

    const blob = new Blob(chunks, { type: mimeType ?? 'audio/webm' });
    const data = await blob.arrayBuffer();
    const ext = mimeType?.includes('mp3') ? 'mp3' : 'webm';

    return {
      ok: true,
      file: {
        kind: 'audio',
        filename: generateMediaFilename('sentence', ext),
        mimeType: blob.type,
        data,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: 'failed', error: msg };
  }
}

/**
 * Seek video to a time and wait until it has landed there with decodable
 * data (readyState ≥ HAVE_CURRENT_DATA). Returns false when the seek never
 * landed within tolerance or the video stays unready — callers must treat
 * that as "do not record", otherwise they'd capture the wrong sentence.
 *
 * Used both by captureSentenceAudio and by callers that need to position
 * the video before taking a screenshot of a non-current cue.
 */
export function seekAndWaitReady(
  video: HTMLVideoElement,
  timeSec: number,
  timeoutMs = 4000,
): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    let seekedFired = false;

    const landed = (): boolean =>
      Math.abs(video.currentTime - timeSec) <= SEEK_LAND_TOLERANCE_SEC &&
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

    const poll = (): void => {
      if (landed()) {
        cleanup();
        resolve(true);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        cleanup();
        resolve(false);
        return;
      }
      setTimeout(poll, 50);
    };
    const onSeeked = (): void => {
      seekedFired = true;
      poll();
    };
    const cleanup = (): void => {
      video.removeEventListener('seeked', onSeeked);
    };

    video.addEventListener('seeked', onSeeked);
    // ADR-030: route through seekVideo to avoid Netflix M7375.
    seekVideo(video, timeSec);
    if (seekedFired) return;
    poll();
  });
}

/** Play video for a duration, then pause. Resolves when paused. */
function playForDuration(video: HTMLVideoElement, durationSec: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    let startTime = video.currentTime; // captured when play actually starts
    const onTimeUpdate = () => {
      // Stop when the video has played for the full duration from when play
      // started. Comparing against startTime (not cue.start) handles the case
      // where play() takes a moment to begin after the seek.
      if (video.currentTime - startTime >= durationSec) {
        clearTimeout(timer);
        finish();
      }
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', finish);
      // ADR-030: route through pauseVideo to avoid Netflix M7375.
      pauseVideo(video);
      resolve();
    };
    // Timeout fallback in case 'timeupdate' doesn't fire fast enough.
    const timer = setTimeout(finish, durationSec * 1000 + 500);
    video.addEventListener('timeupdate', onTimeUpdate);
    // Cue can extend past the video end — stop early instead of waiting out
    // the full timeout on a dead position.
    video.addEventListener('ended', finish);
    // ADR-030: route through playVideo to avoid Netflix M7375.
    void playVideo(video).then(() => {
      // Record the actual start time once playback begins — this is when the
      // MediaRecorder starts capturing audio.
      startTime = video.currentTime;
    }).catch(() => {
      finish();
    });
  });
}

/** Pick the best supported audio mime type for MediaRecorder. */
function pickAudioMimeType(): string | undefined {
  const candidates = ['audio/mpeg', 'audio/webm;codecs=opus', 'audio/webm'];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return undefined;
}
