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
import { seekVideo, playVideo, pauseVideo } from '@/features/subtitle/ui/netflixPlayback';

/** Max audio capture duration (4GB mobile constraint). */
const MAX_AUDIO_DURATION_MS = 15_000;

/** Result: either a MediaFile or null (unsupported/skipped/failed). */
export type SentenceAudioResult =
  | { ok: true; file: MediaFile }
  | { ok: false; reason: 'unsupported' | 'hidden' | 'failed'; error?: string };

/**
 * Capture audio for a subtitle cue's time range.
 *
 * @param video - The video element to capture audio from.
 * @param cue - The cue with start/end in milliseconds.
 * @returns SentenceAudioResult — never throws.
 */
export async function captureSentenceAudio(
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
    return { ok: false, reason: 'failed', error: 'Cue duration ≤ 0' };
  }

  try {
    // Seek to cue start.
    await seekTo(video, cue.start / 1000);

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
      return { ok: false, reason: 'failed', error: 'No audio data captured' };
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

/** Seek video to a time, resolving when the seek completes.
 *  Timeout fallback prevents hanging if 'seeked' never fires (hidden tab,
 *  video error, Netflix player edge cases). */
function seekTo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const onSeeked = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    // Timeout: if seek doesn't fire within 3s, resolve anyway (captureScreenshot
    // will handle the unready state). Prevents listener leak + promise hang.
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      video.removeEventListener('seeked', onSeeked);
      resolve();
    }, 3000);
    // ADR-030: route through seekVideo to avoid Netflix M7375.
    // Netflix player.seek() sets video.currentTime internally → fires 'seeked'.
    seekVideo(video, timeSec);
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
      // ADR-030: route through pauseVideo to avoid Netflix M7375.
      pauseVideo(video);
      resolve();
    };
    // Timeout fallback in case 'timeupdate' doesn't fire fast enough.
    const timer = setTimeout(finish, durationSec * 1000 + 500);
    video.addEventListener('timeupdate', onTimeUpdate);
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
