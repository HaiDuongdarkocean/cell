import {
  saveVideo,
  getVideo,
  getAllVideos,
  getAllSubtitles,
  addHistoryEntry,
  saveSubtitle,
  updateResumePosition,
  type VideoRecord,
  type SubtitleRecord,
} from '@/features/local-player/services/mediaLibraryRepository';
import {
  createResumePositionService,
  type ResumePositionRepository,
} from '../hooks/useResumePosition';

export function videoId(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export function buildVideoRecord(file: File): VideoRecord {
  const now = new Date().toISOString();
  return {
    id: videoId(file),
    filename: file.name,
    title: file.name.replace(/\.[^.]+$/, ''),
    durationMs: 0,
    addedAt: now,
    lastWatchedAt: now,
    resumePositionMs: 0,
    fileSizeBytes: file.size,
  };
}

export function buildSubtitleRecord(
  file: File,
  handle?: FileSystemFileHandle,
): SubtitleRecord {
  return {
    id: file.name,
    filename: file.name,
    languageCode: null,
    addedAt: new Date().toISOString(),
    fileHandle: handle,
  };
}

export async function persistVideoRecord(record: VideoRecord): Promise<void> {
  if (record.comprehension === undefined) {
    const existing = await getVideo(record.id).catch(() => undefined);
    if (existing?.comprehension) {
      record = { ...record, comprehension: existing.comprehension };
    }
  }
  await saveVideo(record).catch(() => {
    const { fileHandle, dirHandle, ...rest } = record;
    void fileHandle;
    void dirHandle;
    return saveVideo(rest);
  });
}

export async function persistSubtitleRecord(
  record: SubtitleRecord,
): Promise<void> {
  await saveSubtitle(record).catch(() => {
    const { fileHandle, ...rest } = record;
    void fileHandle;
    return saveSubtitle(rest);
  });
}

export async function addWatchHistoryEntry(videoId_: string): Promise<void> {
  await addHistoryEntry({
    id: `${videoId_}-${Date.now()}`,
    videoId: videoId_,
    watchedAt: new Date().toISOString(),
    watchDurationMs: 0,
    positionMs: 0,
  });
}

export async function refreshLibrary(): Promise<{
  videos: VideoRecord[];
  subtitles: SubtitleRecord[];
}> {
  const [videos, subtitles] = await Promise.all([
    getAllVideos(),
    getAllSubtitles(),
  ]);
  return { videos, subtitles };
}

async function updateResumePositionMs(
  videoId_: string,
  positionMs: number,
): Promise<void> {
  await updateResumePosition(videoId_, positionMs, new Date().toISOString());
}

export const resumeRepo: ResumePositionRepository = {
  updateResumePosition: updateResumePositionMs,
  async getVideo(videoId_): Promise<{
    resumePositionMs: number | null;
    durationMs: number | null;
  } | null> {
    const v = await getVideo(videoId_);
    if (!v) return null;
    return {
      resumePositionMs: v.resumePositionMs,
      durationMs: v.durationMs,
    };
  },
};

export const resumeService = createResumePositionService(resumeRepo);
