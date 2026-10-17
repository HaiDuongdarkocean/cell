import { t } from '@/shared/i18n';
import { formatMediaTimeMs } from '@/shared/lib/formatMediaTime';

export interface VideoResumeData {
  readonly resumePositionMs: number | null;
  readonly durationMs: number | null;
}

export interface ResumePositionRepository {
  updateResumePosition(videoId: string, positionMs: number): Promise<void>;
  getVideo(videoId: string): Promise<VideoResumeData | null>;
}

export type ShowResumeDialog = (text: string) => Promise<boolean>;

const MIN_RESUME_MS = 10_000;
const NEAR_END_RATIO = 0.95;

export function shouldPromptResume(
  positionMs: number,
  durationMs: number,
): boolean {
  if (positionMs < MIN_RESUME_MS) return false;
  if (durationMs <= 0) return false;
  if (positionMs >= durationMs) return false;
  return positionMs < NEAR_END_RATIO * durationMs;
}

export function formatPosition(positionMs: number): string {
  return formatMediaTimeMs(positionMs);
}

export interface ResumePositionService {
  saveResumePosition(videoId: string, positionMs: number): Promise<void>;
  getResumePosition(videoId: string): Promise<number | null>;
  promptResume(
    videoId: string,
    durationMs: number,
    showDialog: ShowResumeDialog,
  ): Promise<boolean>;
}

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
      return showDialog(t('player.resume.prompt', [formatPosition(position)]));
    },
  };
}

export interface ThrottledSaver {
  save(positionMs: number): void;
  flush(): Promise<void>;
}

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
