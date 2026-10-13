import { useCallback, useMemo } from 'react';
import type { SrtCue } from '@/entities/media';
import type { SubtitleRecord } from '@/features/local-player/services/mediaLibraryRepository';
import {
  getAllSubtitles,
  getSubtitle,
} from '@/features/local-player/services/mediaLibraryRepository';
import type {
  MatchResult,
  SubtitleMatch,
} from '@/features/local-player/logic/subtitleMatch';
import { isSubtitleFile } from '@/features/local-player/logic/folderScan';
import { logger } from '@/shared/lib/logger';
import { openSubtitleFile, verifyPermission } from './useFileSystemAccess';
import { matchSubtitlesForVideo, parseSubtitleFile } from './useSubtitleMatch';
import {
  useLocalPlayerStore,
  type SubtitlesState,
  type SubtitleStatus,
} from './useLocalPlayerStore';
import { createFileCache, type FileCache } from '../logic/fileCache';
import type { FileCaches } from './useFileCaches';

const TARGET_LANG = 'en';
const NATIVE_LANG = 'vi';
const EMPTY_SUBTITLES: SubtitlesState = { target: null, native: null, others: [] };

interface MatchContext {
  readonly caches: FileCaches;
  readonly setSubtitles: (subs: SubtitlesState) => void;
  readonly setSubtitleStatus: (status: SubtitleStatus) => void;
  readonly loadAndParseSubtitle: (
    targetFile: File,
    nativeFile?: File,
  ) => Promise<void>;
}

async function resolveLibrarySubtitleFiles(
  subs: readonly SubtitleRecord[],
  cachedMap: FileCache,
): Promise<FileCache> {
  const fileMap = createFileCache();
  for (const sub of subs) {
    if (sub.fileHandle) {
      try {
        const granted = await verifyPermission(sub.fileHandle, false);
        logger.debug('[Tihoka:autoMatch] lib sub permission', sub.filename, granted);
        if (granted) {
          const f = await sub.fileHandle.getFile();
          fileMap.set(sub.filename, f);
          logger.debug('[Tihoka:autoMatch] lib sub file resolved', sub.filename, f.size);
        }
      } catch (e) {
        logger.debug('[Tihoka:autoMatch] lib sub permission error', sub.filename, String(e));
      }
    } else {
      const cached = cachedMap.get(sub.filename);
      if (cached) {
        fileMap.set(sub.filename, cached);
        logger.debug('[Tihoka:autoMatch] lib sub file from cache', sub.filename, cached.size);
      } else {
        logger.debug('[Tihoka:autoMatch] lib sub no fileHandle + no cache', sub.filename);
      }
    }
  }
  return fileMap;
}

async function matchFromLibrarySubs(
  videoFile_: File,
  ctx: MatchContext,
): Promise<void> {
  logger.debug('[Tihoka:autoMatch] FALLBACK: matching against library subtitles');
  const libSubs = await getAllSubtitles();
  logger.debug(
    '[Tihoka:autoMatch] library subtitles count',
    libSubs.length,
    libSubs.map((s) => s.filename),
  );
  if (libSubs.length > 0) {
    const libFilenames = libSubs.map((s) => s.filename);
    const result = matchSubtitlesForVideo(
      videoFile_.name,
      libFilenames,
      TARGET_LANG,
      NATIVE_LANG,
    );
    logger.debug('[Tihoka:autoMatch] library match result', {
      target: result.target?.filename,
      native: result.native?.filename,
      others: result.others.length,
    });

    if (result.target) {
      const fileMap = await resolveLibrarySubtitleFiles(
        libSubs,
        ctx.caches.subtitleFileMapRef.current,
      );
      ctx.caches.subtitleFileMapRef.current = fileMap;
      logger.debug(
        '[Tihoka:autoMatch] lib subtitleFileMap built',
        fileMap.size,
        Array.from(fileMap.keys()),
      );
      ctx.setSubtitles({
        target: result.target,
        native: result.native ?? null,
        others: result.others,
      });
      const targetFile = fileMap.get(result.target.filename);
      logger.debug('[Tihoka:autoMatch] target file from map?', !!targetFile, result.target.filename);
      if (targetFile) {
        const nativeFile = result.native?.filename
          ? fileMap.get(result.native.filename)
          : undefined;
        await ctx.loadAndParseSubtitle(targetFile, nativeFile);
        logger.debug('[Tihoka:autoMatch] loadAndParseSubtitle DONE (library match)');
      }
      return;
    }

    if (libFilenames.length === 1) {
      const soleSubtitle = libFilenames[0];
      const fileMap = createFileCache();
      const subRecord = libSubs[0];
      if (subRecord.fileHandle) {
        try {
          const granted = await verifyPermission(subRecord.fileHandle, false);
          if (granted) {
            fileMap.set(soleSubtitle, await subRecord.fileHandle.getFile());
          }
        } catch {}
      }
      ctx.caches.subtitleFileMapRef.current = fileMap;
      const autoMatch: SubtitleMatch = {
        filename: soleSubtitle,
        languageCode: TARGET_LANG,
        tags: [],
      };
      ctx.setSubtitles({ target: autoMatch, native: null, others: [] });
      const targetFile = fileMap.get(soleSubtitle);
      if (targetFile) await ctx.loadAndParseSubtitle(targetFile);
      return;
    }
  }

  logger.debug('[Tihoka:autoMatch] NO MATCH — not-found');
  ctx.setSubtitleStatus('not-found');
  ctx.setSubtitles(EMPTY_SUBTITLES);
}

async function scanDirForSubtitles(
  dirHandle: FileSystemDirectoryHandle,
): Promise<FileCache | null> {
  const fileMap = createFileCache();
  try {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file' && isSubtitleFile(entry.name)) {
        fileMap.set(entry.name, await (entry as FileSystemFileHandle).getFile());
      }
    }
  } catch {
    return null;
  }
  return fileMap;
}

async function applyMatchOutcome(
  result: MatchResult,
  filenames: readonly string[],
  fileMap: FileCache,
  ctx: MatchContext,
): Promise<void> {
  if (result.target) {
    ctx.setSubtitles({
      target: result.target,
      native: result.native ?? null,
      others: result.others,
    });
    const targetFile = fileMap.get(result.target.filename);
    if (targetFile) {
      const nativeFile = result.native?.filename
        ? fileMap.get(result.native.filename)
        : undefined;
      await ctx.loadAndParseSubtitle(targetFile, nativeFile);
    }
    return;
  }

  if (filenames.length === 1) {
    const sole = filenames[0];
    const autoMatch: SubtitleMatch = {
      filename: sole,
      languageCode: TARGET_LANG,
      tags: [],
    };
    ctx.setSubtitles({ target: autoMatch, native: null, others: [] });
    const file = fileMap.get(sole);
    if (file) await ctx.loadAndParseSubtitle(file);
    return;
  }

  ctx.setSubtitleStatus('not-found');
  ctx.setSubtitles(EMPTY_SUBTITLES);
}

export interface SubtitleMatchingDeps {
  readonly caches: FileCaches;
  readonly loadCues: (targetCues: SrtCue[], nativeCues: SrtCue[]) => void;
}

export interface SubtitleMatching {
  readonly autoMatchSubtitles: (videoFile: File) => Promise<void>;
  readonly matchPendingSubsForVideo: (videoFile: File) => Promise<void>;
  readonly matchPendingSubsForCurrentVideo: () => void;
  readonly handleOpenSubtitle: () => Promise<void>;
  readonly handleSelectTrack: (match: SubtitleMatch) => Promise<void>;
  readonly handleSubtitleSelect: (subtitleId: string) => Promise<void>;
}

export function useSubtitleMatching(deps: SubtitleMatchingDeps): SubtitleMatching {
  const { caches, loadCues } = deps;

  const currentVideo = useLocalPlayerStore((s) => s.currentVideo);
  const videoFile = useLocalPlayerStore((s) => s.videoFile);
  const subtitles = useLocalPlayerStore((s) => s.subtitles);
  const setSubtitles = useLocalPlayerStore((s) => s.setSubtitles);
  const setSubtitleStatus = useLocalPlayerStore((s) => s.setSubtitleStatus);

  const loadAndParseSubtitle = useCallback(
    async (targetFile: File, nativeFile?: File): Promise<void> => {
      try {
        const targetCues = parseSubtitleFile(targetFile.name, await targetFile.text());
        const nativeCues = nativeFile
          ? parseSubtitleFile(nativeFile.name, await nativeFile.text())
          : [];
        loadCues(targetCues, nativeCues);
        setSubtitleStatus('loaded');
      } catch {
        setSubtitleStatus('error');
      }
    },
    [loadCues, setSubtitleStatus],
  );

  const autoMatchSubtitles = useCallback(
    async (videoFile_: File): Promise<void> => {
      logger.debug('[Tihoka:autoMatch] autoMatchSubtitles ENTER', { filename: videoFile_.name });
      setSubtitleStatus('searching');
      const ctx: MatchContext = { caches, setSubtitles, setSubtitleStatus, loadAndParseSubtitle };

      let fileMap = caches.subtitleFileMapRef.current;
      logger.debug('[Tihoka:autoMatch] cached subtitleFileMap size', fileMap.size);

      if (fileMap.size === 0) {
        let dirHandle = caches.dirHandleRef.current;
        logger.debug('[Tihoka:autoMatch] dirHandle cached?', !!dirHandle);
        if (dirHandle) {
          const granted = await verifyPermission(dirHandle, false);
          logger.debug('[Tihoka:autoMatch] dirHandle permission granted?', granted);
          if (!granted) dirHandle = null;
        }

        if (!dirHandle) {
          await matchFromLibrarySubs(videoFile_, ctx);
          return;
        }

        logger.debug('[Tihoka:autoMatch] scanning dirHandle for subtitles...');
        const scanned = await scanDirForSubtitles(dirHandle);
        if (!scanned) {
          setSubtitleStatus('error');
          setSubtitles(EMPTY_SUBTITLES);
          return;
        }
        fileMap = scanned;
        caches.subtitleFileMapRef.current = fileMap;
      }

      const subtitleFilenames = Array.from(fileMap.keys());
      logger.debug('[Tihoka:autoMatch] subtitleFilenames', subtitleFilenames);
      caches.subtitleFileMapRef.current = fileMap;

      if (subtitleFilenames.length === 0) {
        logger.debug('[Tihoka:autoMatch] no subtitles found — not-found');
        setSubtitleStatus('not-found');
        setSubtitles(EMPTY_SUBTITLES);
        return;
      }

      const result = matchSubtitlesForVideo(
        videoFile_.name,
        subtitleFilenames,
        TARGET_LANG,
        NATIVE_LANG,
      );
      logger.debug('[Tihoka:autoMatch] dirScan match result', {
        target: result.target?.filename,
        native: result.native?.filename,
        others: result.others.length,
      });
      await applyMatchOutcome(result, subtitleFilenames, fileMap, ctx);
    },
    [caches, loadAndParseSubtitle, setSubtitles, setSubtitleStatus],
  );

  const matchPendingSubsForVideo = useCallback(
    async (videoFile_: File): Promise<void> => {
      const pending = caches.pendingSubsRef.current;
      const filenames = Array.from(pending.keys());
      if (filenames.length === 0) {
        setSubtitleStatus('not-found');
        setSubtitles(EMPTY_SUBTITLES);
        return;
      }

      setSubtitleStatus('searching');
      const result = matchSubtitlesForVideo(
        videoFile_.name,
        filenames,
        TARGET_LANG,
        NATIVE_LANG,
      );
      const ctx: MatchContext = { caches, setSubtitles, setSubtitleStatus, loadAndParseSubtitle };
      await applyMatchOutcome(result, filenames, pending, ctx);
    },
    [caches, loadAndParseSubtitle, setSubtitles, setSubtitleStatus],
  );

  const matchPendingSubsForCurrentVideo = useCallback((): void => {
    if (!currentVideo) return;
    if (caches.pendingSubsRef.current.size === 0) return;
    if (!videoFile) return;
    void matchPendingSubsForVideo(videoFile);
  }, [caches, currentVideo, videoFile, matchPendingSubsForVideo]);

  const handleOpenSubtitle = useCallback(async (): Promise<void> => {
    const picked = await openSubtitleFile();
    if (!picked) return;
    await loadAndParseSubtitle(picked.file);
    setSubtitles({
      target: { filename: picked.file.name, languageCode: null, tags: [] },
      native: null,
      others: [],
    });
  }, [loadAndParseSubtitle, setSubtitles]);

  const handleSelectTrack = useCallback(
    async (match: SubtitleMatch): Promise<void> => {
      const fileMap = caches.subtitleFileMapRef.current;
      const targetFile = fileMap.get(match.filename);
      if (!targetFile) return;
      const currentNative = subtitles.native;
      setSubtitles({
        target: match,
        native: currentNative?.filename === match.filename ? null : currentNative,
        others: subtitles.others.filter((o) => o.filename !== match.filename),
      });
      const nativeFile =
        currentNative && currentNative.filename !== match.filename
          ? fileMap.get(currentNative.filename)
          : undefined;
      await loadAndParseSubtitle(targetFile, nativeFile);
    },
    [caches, subtitles, loadAndParseSubtitle, setSubtitles],
  );

  const handleSubtitleSelect = useCallback(
    async (subtitleId: string): Promise<void> => {
      const record = await getSubtitle(subtitleId);
      if (!record) return;

      const fileMap = caches.subtitleFileMapRef.current;
      let file: File | undefined = fileMap.get(record.filename);
      if (!file && record.fileHandle) {
        const granted = await verifyPermission(record.fileHandle, false);
        if (!granted) return;
        file = await record.fileHandle.getFile();
      }
      if (!file) return;

      fileMap.set(record.filename, file);
      const match: SubtitleMatch = {
        filename: record.filename,
        languageCode: record.languageCode,
        tags: [],
      };
      setSubtitles({ target: match, native: null, others: [] });
      setSubtitleStatus('loaded');
      await loadAndParseSubtitle(file);
    },
    [caches, loadAndParseSubtitle, setSubtitles, setSubtitleStatus],
  );

  return useMemo(
    () => ({
      autoMatchSubtitles,
      matchPendingSubsForVideo,
      matchPendingSubsForCurrentVideo,
      handleOpenSubtitle,
      handleSelectTrack,
      handleSubtitleSelect,
    }),
    [
      autoMatchSubtitles,
      matchPendingSubsForVideo,
      matchPendingSubsForCurrentVideo,
      handleOpenSubtitle,
      handleSelectTrack,
      handleSubtitleSelect,
    ],
  );
}
