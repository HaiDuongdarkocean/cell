/**
 * useResumePosition — save/restore resume position + prompt dialog.
 *
 * T9 (mediaLibraryRepository) may not be implemented yet, so the repository
 * is injected via `ResumePositionRepository`. The pure functions
 * (`shouldPromptResume`, `formatPosition`) are exported directly for unit testing.
 */

/* ── Types ──────────────────────────────────────────────────────── */

export interface VideoResumeData {
  readonly resumePositionMs: number | null;
  readonly durationMs: number | null;
}

export interface ResumePositionRepository {
  updateResumePosition(videoId: string, positionMs: number): Promise<void>;
  getVideo(videoId: string): Promise<VideoResumeData | null>;
}

export type ShowResumeDialog = (text: string) => Promise<boolean>;

/* ── Pure: shouldPromptResume ───────────────────────────────────── */

const MIN_RESUME_MS = 10_000;
const NEAR_END_RATIO = 0.95;

/**
 * Pure: decide whether to show the "Continue from X?" prompt.
 *
 * Prompt when `10s ≤ position < 95%` of duration.
 * No prompt for: position 0, <10s, ≥95% (treated as finished), or >duration (invalid).
 */
export function shouldPromptResume(
  positionMs: number,
  durationMs: number,
): boolean {
  if (positionMs < MIN_RESUME_MS) return false;
  if (durationMs <= 0) return false;
  if (positionMs >= durationMs) return false;
  return positionMs < NEAR_END_RATIO * durationMs;
}

/* ── Pure: formatPosition ───────────────────────────────────────── */

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}

/**
 * Pure: format milliseconds as `M:SS` (< 1h) or `H:MM:SS` (≥ 1h).
 *
 * @example formatPosition(120000) → "2:00"
 * @example formatPosition(5025000) → "1:23:45"
 * @example formatPosition(45000) → "0:45"
 */
export function formatPosition(positionMs: number): string {
  const totalSeconds = Math.floor(positionMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${pad2(m)}:${pad2(s)}`;
  return `${m}:${pad2(s)}`;
}

/* ── Service factory ────────────────────────────────────────────── */

export interface ResumePositionService {
  saveResumePosition(videoId: string, positionMs: number): Promise<void>;
  getResumePosition(videoId: string): Promise<number | null>;
  promptResume(
    videoId: string,
    durationMs: number,
    showDialog: ShowResumeDialog,
  ): Promise<boolean>;
}

/**
 * Create a resume-position service bound to a repository.
 *
 * The repository is injected (T9 may not exist yet — pass a mock).
 */
export function createResumePositionService(
  repo: ResumePositionRepository,
): ResumePositionService {
  async function getResumePosition(videoId: string): Promise<number | null> {
    const video = await repo.getVideo(videoId);
    return video?.resumePositionMs ?? null;
  }

  return {
    saveResumePosition: (videoId, positionMs) =>
      repo.updateResumePosition(videoId, positionMs),

    getResumePosition,

    promptResume: async (videoId, durationMs, showDialog) => {
      const position = await getResumePosition(videoId);
      if (position === null || !shouldPromptResume(position, durationMs)) {
        return false;
      }
      return showDialog(`Continue from ${formatPosition(position)}?`);
    },
  };
}

/* ── Throttled saver ────────────────────────────────────────────── */

export interface ThrottledSaver {
  /** Queue a save — only fires after `intervalMs` has elapsed. */
  save(positionMs: number): void;
  /** Force-save the pending position immediately (for pause/unload). */
  flush(): Promise<void>;
}

/**
 * Create a throttled saver that writes to the repository at most every `intervalMs`.
 *
 * During playback, `timeupdate` fires ~4×/s — this collapses rapid calls into
 * a single repository write per interval, always saving the latest position.
 * Call `flush()` on pause / page unload to write the pending position immediately.
 */
export function createThrottledSaver(
  repo: ResumePositionRepository,
  videoId: string,
  intervalMs: number = 5000,
): ThrottledSaver {
  let pendingPosition: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function fire(): Promise<void> {
    timer = null;
    if (pendingPosition !== null) {
      const pos = pendingPosition;
      pendingPosition = null;
      await repo.updateResumePosition(videoId, pos);
    }
  }

  function save(positionMs: number): void {
    pendingPosition = positionMs;
    if (timer !== null) return;
    timer = setTimeout(() => {
      void fire();
    }, intervalMs);
  }

  async function flush(): Promise<void> {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (pendingPosition !== null) {
      const pos = pendingPosition;
      pendingPosition = null;
      await repo.updateResumePosition(videoId, pos);
    }
  }

  return { save, flush };
}
