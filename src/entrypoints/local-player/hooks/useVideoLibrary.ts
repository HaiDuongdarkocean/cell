import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import {
  getVideo,
  getAllVideos,
  getAllSubtitles,
  deleteVideo,
  clearAllVideos,
  clearAllSubtitles,
} from '@/features/local-player/services/mediaLibraryRepository';
import {
  scanFolder,
  matchVideosWithSubtitles,
  isVideoFile,
  isSubtitleFile,
  type VideoScanResult,
} from '@/features/local-player/logic/folderScan';
import { sortVideosByNumericSuffix } from '@/features/local-player/logic/videoSort';
import { logger } from '@/shared/lib/logger';
import { openMediaFiles, openFolder, verifyPermission } from './useFileSystemAccess';
import { createThrottledSaver, type ThrottledSaver } from './useResumePosition';
import { useLocalPlayerStore } from './useLocalPlayerStore';
import {
  videoId,
  buildVideoRecord,
  buildSubtitleRecord,
  persistVideoRecord,
  persistSubtitleRecord,
  addWatchHistoryEntry,
  refreshLibrary,
  resumeRepo,
} from '../logic/mediaPersistence';
import { createFileCache } from '../logic/fileCache';
import type { FileCaches } from './useFileCaches';

const RESUME_SAVE_INTERVAL_MS = 5000;

export interface VideoLibraryDeps {
  readonly caches: FileCaches;
  readonly videoRef: RefObject<HTMLVideoElement | null>;
  readonly autoMatchSubtitles: (videoFile: File) => Promise<void>;
  readonly matchPendingSubsForVideo: (videoFile: File) => Promise<void>;
  readonly matchPendingSubsForCurrentVideo: () => void;
}

export interface VideoLibrary {
  readonly handleOpenFile: () => Promise<void>;
  readonly handleOpenFolder: () => Promise<void>;
  readonly handleFilesDrop: (files: File[]) => void;
  readonly handleVideoSelect: (videoId: string) => Promise<void>;
  readonly handleVideoDelete: (videoId: string) => Promise<void>;
  readonly handleClearAll: () => Promise<void>;
  readonly handleTimeUpdate: (currentTime: number) => void;
}

export function useVideoLibrary(deps: VideoLibraryDeps): VideoLibrary {
  const {
    caches,
    videoRef,
    autoMatchSubtitles,
    matchPendingSubsForVideo,
    matchPendingSubsForCurrentVideo,
  } = deps;

  const currentVideo = useLocalPlayerStore((s) => s.currentVideo);
  const setVideo = useLocalPlayerStore((s) => s.setVideo);
  const setSubtitles = useLocalPlayerStore((s) => s.setSubtitles);
  const setLibrary = useLocalPlayerStore((s) => s.setLibrary);
  const setSubtitlesLibrary = useLocalPlayerStore((s) => s.setSubtitlesLibrary);

  const saverRef = useRef<ThrottledSaver | null>(null);

  const savePickedMedia = useCallback(
    async (
      videos: readonly VideoScanResult[],
      subtitles: ReadonlyMap<string, File>,
      dirHandle: FileSystemDirectoryHandle | null,
      subtitleHandles?: ReadonlyMap<string, FileSystemFileHandle>,
    ): Promise<void> => {
      await Promise.all(
        [...subtitles].map(async ([filename, file]) => {
          const subRecord = buildSubtitleRecord(file, subtitleHandles?.get(filename));
          subRecord.id = filename;
          await persistSubtitleRecord(subRecord);
        }),
      );

      if (videos.length > 0) {
        const matched = matchVideosWithSubtitles(
          videos,
          Array.from(subtitles.keys()),
          'en',
          'vi',
        );
        await Promise.all(
          matched.map(async ({ video, subtitles: subs }) => {
            const record = buildVideoRecord(video.file);
            record.fileHandle = video.handle;
            if (dirHandle) record.dirHandle = dirHandle;
            record.hasSubtitle = subs.target !== null;
            await persistVideoRecord(record);
          }),
        );
      }

      const { videos: allVideos, subtitles: allSubs } = await refreshLibrary();
      setLibrary(allVideos);
      setSubtitlesLibrary(allSubs);
    },
    [setLibrary, setSubtitlesLibrary],
  );

  const loadVideo = useCallback(
    async (file: File, handle?: FileSystemFileHandle): Promise<void> => {
      logger.debug('[Cell:autoMatch] loadVideo ENTER', {
        filename: file.name,
        hasHandle: !!handle,
        fileSize: file.size,
      });
      const record = buildVideoRecord(file);
      if (handle) record.fileHandle = handle;
      if (caches.dirHandleRef.current) record.dirHandle = caches.dirHandleRef.current;
      setVideo(record, file);

      await persistVideoRecord(record);
      await addWatchHistoryEntry(record.id);

      const videos = await getAllVideos();
      setLibrary(videos);

      saverRef.current = createThrottledSaver(resumeRepo, record.id, RESUME_SAVE_INTERVAL_MS);

      void autoMatchSubtitles(file);
    },
    [caches, setVideo, setLibrary, autoMatchSubtitles],
  );

  const loadVideoWithPendingSubs = useCallback(
    async (file: File): Promise<void> => {
      const record = buildVideoRecord(file);
      setVideo(record, file);

      await persistVideoRecord(record);
      await addWatchHistoryEntry(record.id);

      const videos = await getAllVideos();
      setLibrary(videos);

      saverRef.current = createThrottledSaver(resumeRepo, record.id, RESUME_SAVE_INTERVAL_MS);

      void matchPendingSubsForVideo(file);
    },
    [setVideo, setLibrary, matchPendingSubsForVideo],
  );

  const handleOpenFile = useCallback(async (): Promise<void> => {
    const picked = await openMediaFiles();
    if (!picked || picked.length === 0) return;

    const videoPicks = picked.filter((p) => isVideoFile(p.file.name));
    const subtitlePicks = picked.filter((p) => isSubtitleFile(p.file.name));
    if (videoPicks.length === 0 && subtitlePicks.length === 0) return;

    const subtitleFileMap = new Map<string, File>();
    const subtitleHandles = new Map<string, FileSystemFileHandle>();
    for (const s of subtitlePicks) {
      subtitleFileMap.set(s.file.name, s.file);
      if (s.handle) subtitleHandles.set(s.file.name, s.handle);
    }
    caches.subtitleFileMapRef.current = createFileCache(subtitleFileMap);

    await savePickedMedia(
      videoPicks.map((p) => ({ file: p.file, handle: p.handle, filename: p.file.name })),
      subtitleFileMap,
      null,
      subtitleHandles,
    );

    if (videoPicks.length > 0) {
      await loadVideo(videoPicks[0].file, videoPicks[0].handle);
    }
  }, [caches, savePickedMedia, loadVideo]);

  const handleOpenFolder = useCallback(async (): Promise<void> => {
    const dirHandle = await openFolder();
    if (!dirHandle) return;

    caches.dirHandleRef.current = dirHandle;
    const scan = await scanFolder(dirHandle);
    caches.subtitleFileMapRef.current = createFileCache(scan.subtitleFiles);

    await savePickedMedia(scan.videos, scan.subtitleFiles, dirHandle);
  }, [caches, savePickedMedia]);

  const handleFilesDrop = useCallback(
    (files: File[]): void => {
      const videoFiles = files.filter((f) => isVideoFile(f.name));
      const subFiles = files.filter((f) => isSubtitleFile(f.name));

      const pendingSubs = caches.pendingSubsRef.current;
      const subtitleFileMap = caches.subtitleFileMapRef.current;
      for (const sub of subFiles) {
        pendingSubs.set(sub.name, sub);
        subtitleFileMap.set(sub.name, sub);
      }

      if (subFiles.length > 0) {
        void (async (): Promise<void> => {
          for (const sub of subFiles) {
            const record = buildSubtitleRecord(sub);
            record.id = sub.name;
            await persistSubtitleRecord(record);
          }
          const subs = await getAllSubtitles();
          setSubtitlesLibrary(subs);
        })();
      }

      if (videoFiles.length === 0) {
        if (currentVideo) {
          matchPendingSubsForCurrentVideo();
        }
        return;
      }

      const sorted = sortVideosByNumericSuffix(videoFiles.map((f) => f.name));
      const filesByName = new Map<string, File>();
      for (const f of videoFiles) {
        if (!filesByName.has(f.name)) filesByName.set(f.name, f);
      }
      const sortedFiles = sorted.map((name) => filesByName.get(name)!);

      const videoFileCache = caches.videoFileCacheRef.current;
      for (const f of sortedFiles) {
        videoFileCache.set(videoId(f), f);
      }

      const [first, ...rest] = sortedFiles;
      void loadVideoWithPendingSubs(first);

      void (async (): Promise<void> => {
        for (const v of rest) {
          await persistVideoRecord(buildVideoRecord(v));
        }
        const videos = await getAllVideos();
        setLibrary(videos);
      })();
    },
    [
      caches,
      currentVideo,
      matchPendingSubsForCurrentVideo,
      loadVideoWithPendingSubs,
      setLibrary,
      setSubtitlesLibrary,
    ],
  );

  const handleVideoSelect = useCallback(
    async (videoId_: string): Promise<void> => {
      logger.debug('[Cell:autoMatch] handleVideoSelect ENTER', { videoId_ });
      const cachedFile = caches.videoFileCacheRef.current.get(videoId_);
      if (cachedFile) {
        logger.debug('[Cell:autoMatch] handleVideoSelect: cached file', cachedFile.name);
        await loadVideo(cachedFile);
        return;
      }
      const record = await getVideo(videoId_);
      logger.debug('[Cell:autoMatch] handleVideoSelect: record', {
        found: !!record,
        hasHandle: !!record?.fileHandle,
      });
      if (!record?.fileHandle) return;
      const granted = await verifyPermission(record.fileHandle, false);
      logger.debug('[Cell:autoMatch] handleVideoSelect: permission', granted);
      if (!granted) return;
      const file = await record.fileHandle.getFile();
      if (record.dirHandle) {
        caches.dirHandleRef.current = record.dirHandle;
        logger.debug('[Cell:autoMatch] handleVideoSelect: dirHandle restored from record');
      }
      await loadVideo(file, record.fileHandle);
    },
    [caches, loadVideo],
  );

  const handleVideoDelete = useCallback(
    async (videoId_: string): Promise<void> => {
      await deleteVideo(videoId_).catch(() => {});
      caches.videoFileCacheRef.current.delete(videoId_);
      const { videos, subtitles } = await refreshLibrary();
      setLibrary(videos);
      setSubtitlesLibrary(subtitles);
    },
    [caches, setLibrary, setSubtitlesLibrary],
  );

  const handleClearAll = useCallback(async (): Promise<void> => {
    await Promise.all([clearAllVideos(), clearAllSubtitles()]).catch(() => {});
    caches.videoFileCacheRef.current.clear();
    caches.subtitleFileMapRef.current.clear();
    caches.pendingSubsRef.current.clear();
    caches.dirHandleRef.current = null;
    setLibrary([]);
    setSubtitlesLibrary([]);
    setSubtitles({ target: null, native: null, others: [] });
    setVideo(null, null);
  }, [caches, setLibrary, setSubtitlesLibrary, setSubtitles, setVideo]);

  const handleTimeUpdate = useCallback(
    (currentTime: number): void => {
      const video = videoRef.current;
      if (!video) return;
      const positionMs = Math.round(currentTime * 1000);
      saverRef.current?.save(positionMs);
    },
    [videoRef],
  );

  useEffect(() => {
    const flush = (): void => {
      void saverRef.current?.flush();
    };
    window.addEventListener('beforeunload', flush);
    return (): void => {
      window.removeEventListener('beforeunload', flush);
      void saverRef.current?.flush();
    };
  }, []);

  return useMemo(
    () => ({
      handleOpenFile,
      handleOpenFolder,
      handleFilesDrop,
      handleVideoSelect,
      handleVideoDelete,
      handleClearAll,
      handleTimeUpdate,
    }),
    [
      handleOpenFile,
      handleOpenFolder,
      handleFilesDrop,
      handleVideoSelect,
      handleVideoDelete,
      handleClearAll,
      handleTimeUpdate,
    ],
  );
}
