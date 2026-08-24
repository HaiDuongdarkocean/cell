/**
 * Local Video Player — React mount point + orchestration layer.
 *
 * Wires together every local-player building block:
 *  1. `useLocalPlayerStore` — global Zustand state (current video, subtitles,
 *     library, playback mirror).
 *  2. `openVideoFile` / `openSubtitleFile` — File System Access API pickers.
 *  3. `matchSubtitlesForVideo` / `parseSubtitleFile` — subtitle auto-match +
 *     parse (T11).
 *  4. `createResumePositionService` + `createThrottledSaver` — save/restore
 *     playback position (T13) backed by `mediaLibraryRepository` (T9).
 *  5. `mediaLibraryRepository` — IndexedDB library CRUD (save, getAll, history).
 *
 * `PlayerView` (T18) calls `useLocalVideo` internally — this module does NOT
 * call it a second time. The `videoRef` is created here and forwarded so the
 * resume-position saver can read `video.currentTime` on pause/unload.
 *
 * Flow:
 *  - User opens file (EmptyState onOpenFile or onFileDrop) → `openVideoFile()`
 *    → set video in store → save to library → match subtitles.
 *  - Video plays → `useLocalVideo` (inside PlayerView) manages playback →
 *    `onTimeUpdate` callback → throttled resume-position save every 5s.
 *  - User opens library → `LibraryView` shows videos → click → load video.
 *  - Subtitle match → parse → set in store → PlayerView renders SubtitleBlock.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { VideoRecord, SubtitleRecord } from '@/features/local-player/services/mediaLibraryRepository';
import {
  saveVideo,
  getVideo,
  getAllVideos,
  addHistoryEntry,
  saveSubtitle,
  getAllSubtitles,
  getSubtitle,
  deleteVideo,
  clearAllVideos,
  clearAllSubtitles,
} from '@/features/local-player/services/mediaLibraryRepository';
import { openSubtitleFile, openFolder, openMediaFiles, verifyPermission } from './hooks/useFileSystemAccess';
import { matchSubtitlesForVideo, parseSubtitleFile } from './hooks/useSubtitleMatch';
import { scanFolder, matchVideosWithSubtitles, isVideoFile, isSubtitleFile } from '@/features/local-player/logic/folderScan';
import { sortVideosByNumericSuffix } from '@/features/local-player/logic/videoSort';
import {
  createResumePositionService,
  createThrottledSaver,
  type ThrottledSaver,
  type ResumePositionRepository,
} from './hooks/useResumePosition';
import {
  useLocalPlayerStore,
  type LibrarySort,
} from './hooks/useLocalPlayerStore';
import { useSubtitleEngine } from './hooks/useSubtitleEngine';
import { useSubtitleActions } from './hooks/useSubtitleActions';
import type { SortBy } from '@/features/local-player/logic/librarySort';
import { sortLibrary } from '@/features/local-player/logic/librarySort';
import type { SrtCue } from '@/entities/media';
import type { OverlayStyleConfig } from '@/entities/subtitle';
import type { SubtitleBlockSettings, NavClusterSettings } from '@/entities/settings';
import type { SubtitleMatch } from '@/features/local-player/logic/subtitleMatch';
import type { ManagerState, AppearanceState } from '@/features/subtitle/ui/subtitlePanelsTypes';
import { cuesToSrt } from '@/features/subtitle/logic/cuesToSrt';
import { buildPanelItemsFromSubtitles } from './logic/subtitlePanelItems';
import { PlayerView } from './components/PlayerView';
import {
  DEFAULT_OVERLAY_STYLE_TARGET,
  DEFAULT_OVERLAY_STYLE_NATIVE,
} from '@/shared/config/config';
import { loadSettings, saveSettings } from '@/shared/lib/storage/settingsStore';
import { ThemeProvider } from '@/features/theme/ui/ThemeProvider';
import { ErrorBoundary } from '@/shared/ui';
import './styles/global.css';

// ─── Repository adapter ─────────────────────────────────────────────────────
// mediaLibraryRepository (T9) stores position in ms, but the
// ResumePositionRepository interface (T13) also uses ms — direct adapter.

const resumeRepo: ResumePositionRepository = {
  async updateResumePosition(videoId, positionMs): Promise<void> {
    await updateResumePositionMs(videoId, positionMs);
  },
  async getVideo(videoId): Promise<{ resumePositionMs: number | null; durationMs: number | null } | null> {
    const v = await getVideo(videoId);
    if (!v) return null;
    return {
      resumePositionMs: v.resumePositionMs,
      durationMs: v.durationMs,
    };
  },
};

const resumeService = createResumePositionService(resumeRepo);

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Generate a stable id for a video file (name + size + lastModified). */
function videoId(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

/** Build a VideoRecord from a picked File (metadata filled lazily on loadedmetadata). */
function buildVideoRecord(file: File): VideoRecord {
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

/** Build a SubtitleRecord from a picked subtitle File + handle. */
function buildSubtitleRecord(file: File, handle?: FileSystemFileHandle): SubtitleRecord {
  return {
    id: file.name,
    filename: file.name,
    languageCode: null,
    addedAt: new Date().toISOString(),
    fileHandle: handle,
  };
}

/** Thin wrapper to update resume position (ms) + lastWatchedAt in one call. */
async function updateResumePositionMs(videoId_: string, positionMs: number): Promise<void> {
  // mediaLibraryRepository.updateResumePosition expects (id, ms, lastWatchedAt).
  const { updateResumePosition } = await import(
    '@/features/local-player/services/mediaLibraryRepository'
  );
  await updateResumePosition(videoId_, positionMs, new Date().toISOString());
}

// ─── App component (orchestration layer) ────────────────────────────────────

function LocalPlayerApp(): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Store selectors — subscribe to slices used by this component.
  const currentVideo = useLocalPlayerStore((s) => s.currentVideo);
  const videoFile = useLocalPlayerStore((s) => s.videoFile);
  const subtitles = useLocalPlayerStore((s) => s.subtitles);
  const subtitleStatus = useLocalPlayerStore((s) => s.subtitleStatus);
  const library = useLocalPlayerStore((s) => s.library);
  const subtitlesLibrary = useLocalPlayerStore((s) => s.subtitlesLibrary);
  const librarySort = useLocalPlayerStore((s) => s.librarySort);

  const setVideo = useLocalPlayerStore((s) => s.setVideo);
  const setSubtitles = useLocalPlayerStore((s) => s.setSubtitles);
  const setSubtitleStatus = useLocalPlayerStore((s) => s.setSubtitleStatus);
  const setLibrary = useLocalPlayerStore((s) => s.setLibrary);
  const setSubtitlesLibrary = useLocalPlayerStore((s) => s.setSubtitlesLibrary);
  const setLibrarySort = useLocalPlayerStore((s) => s.setLibrarySort);

  // Subtitle engine — binds SubtitleCueEngine to <video>, drives cuesStore.
  const subtitleEngine = useSubtitleEngine(videoRef, videoFile);
  const subtitleActions = useSubtitleActions({ videoRef, offsetMs: subtitleEngine.offsetMs });

  // Throttled saver for the current video (recreated when video changes).
  const saverRef = useRef<ThrottledSaver | null>(null);

  // Cached directory handle + subtitle file map for reuse across video opens (Gap 3).
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const subtitleFileMapRef = useRef<Map<string, File>>(new Map());
  // Pending subtitles dropped before any video — matched when a video arrives.
  // Ponytail: not persisted (lost on tab close). Upgrade: save to IndexedDB.
  const pendingSubsRef = useRef<Map<string, File>>(new Map());
  // In-memory cache of drag-dropped video File objects (videoId → File).
  // Drag-dropped videos have no FileSystemFileHandle, so handleVideoSelect
  // can't reopen them from storage. This cache lets prev/next navigation
  // reload them within the same session.
  // Ponytail: not persisted (lost on tab close). Upgrade: IndexedDB blob store.
  const videoFileCacheRef = useRef<Map<string, File>>(new Map());

  // Subtitle overlay hide/show state (manager "Hide" buttons).
  const [targetHidden, setTargetHidden] = useState(false);
  const [nativeHidden, setNativeHidden] = useState(false);

  // Appearance preview text (persisted to settingsStore).
  const [previewTargetText, setPreviewTargetText] = useState('This is how the target subtitle will look.');
  const [previewNativeText, setPreviewNativeText] = useState('This is how the native subtitle will look.');

  // Debounced persist timers for appearance changes (mirror reactSubtitleController).
  const stylePersistRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockPersistRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clusterPersistRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTextPersistRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PERSIST_DEBOUNCE_MS = 400;

  // ── Load library on mount ──────────────────────────────────────────────
  useEffect(() => {
    void (async (): Promise<void> => {
      const [videos, subs] = await Promise.all([getAllVideos(), getAllSubtitles()]);
      setLibrary(videos);
      setSubtitlesLibrary(subs);
    })();
  }, [setLibrary, setSubtitlesLibrary]);

  // ── Load persisted appearance settings on mount ───────────────────────
  // Applies saved style/block/cluster/preview text to the engine so the
  // manager Customize tab + overlay start from the user's last configuration.
  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        const settings = await loadSettings();
        if (settings.subtitleOverlayTargetStyle) {
          subtitleEngine.updateStyle('target', settings.subtitleOverlayTargetStyle);
        }
        if (settings.subtitleOverlayNativeStyle) {
          subtitleEngine.updateStyle('native', settings.subtitleOverlayNativeStyle);
        }
        if (settings.subtitleBlockSettings) {
          subtitleEngine.updateBlockSettings(settings.subtitleBlockSettings);
        }
        if (settings.navClusterSettings) {
          subtitleEngine.updateClusterSettings(settings.navClusterSettings);
        }
        if (typeof settings.subtitlePreviewTargetText === 'string' && settings.subtitlePreviewTargetText) {
          setPreviewTargetText(settings.subtitlePreviewTargetText);
        }
        if (typeof settings.subtitlePreviewNativeText === 'string' && settings.subtitlePreviewNativeText) {
          setPreviewNativeText(settings.subtitlePreviewNativeText);
        }
      } catch {
        // Storage unavailable (e.g. test env) — keep defaults.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── SSOT: save picked/scanned videos + subtitles → refresh libraries ──
  // Dùng chung cho handleOpenFile + handleOpenFolder + handleFilesDrop.
  // videos: array of { file, handle, filename }. subtitles: Map<filename, File>.
  // dirHandle: parent directory (optional — null khi drag-drop).
  const savePickedMedia = useCallback(async (
    videos: { file: File; handle?: FileSystemFileHandle; filename: string }[],
    subtitles: Map<string, File>,
    dirHandle: FileSystemDirectoryHandle | null,
  ): Promise<void> => {
    // Save subtitles to library.
    for (const [filename, file] of subtitles) {
      const subRecord = buildSubtitleRecord(file);
      subRecord.id = filename;
      await saveSubtitle(subRecord).catch(() => {
        const { fileHandle, ...rest } = subRecord;
        void fileHandle;
        return saveSubtitle(rest as SubtitleRecord);
      });
    }

    // Match + save videos.
    if (videos.length > 0) {
      const matched = matchVideosWithSubtitles(videos, Array.from(subtitles.keys()), 'en', 'vi');
      for (const { video, subtitles: subs } of matched) {
        const record = buildVideoRecord(video.file);
        record.fileHandle = video.handle;
        if (dirHandle) record.dirHandle = dirHandle;
        record.hasSubtitle = subs.target !== null;
        await saveVideo(record).catch(() => {
          const { fileHandle, dirHandle, ...rest } = record;
          void fileHandle;
          void dirHandle;
          return saveVideo(rest as VideoRecord);
        });
      }
    }

    const [allVideos, allSubs] = await Promise.all([getAllVideos(), getAllSubtitles()]);
    setLibrary(allVideos);
    setSubtitlesLibrary(allSubs);
  }, [setLibrary, setSubtitlesLibrary]);

  // ── Add files: pick video + subtitle files → match directly ──
  // User chọn 1 hoặc nhiều file video + subtitle cùng lúc. Match trực tiếp.
  const handleOpenFile = useCallback(async (): Promise<void> => {
    const picked = await openMediaFiles();
    if (!picked || picked.length === 0) return;

    const videoPicks = picked.filter((p) => isVideoFile(p.file.name));
    const subtitlePicks = picked.filter((p) => isSubtitleFile(p.file.name));
    if (videoPicks.length === 0 && subtitlePicks.length === 0) return;

    const subtitleFileMap = new Map<string, File>();
    for (const s of subtitlePicks) subtitleFileMap.set(s.file.name, s.file);
    subtitleFileMapRef.current = subtitleFileMap;

    await savePickedMedia(
      videoPicks.map((p) => ({ file: p.file, handle: p.handle, filename: p.file.name })),
      subtitleFileMap,
      null,
    );

    if (videoPicks.length > 0) {
      await loadVideo(videoPicks[0].file, videoPicks[0].handle);
    }
  }, [savePickedMedia]);

  // ── Drag-and-drop: accept video + subtitle files (any mix) ─────────────
  // Split by extension, sort videos by numeric suffix → alphabetical,
  // play first video, queue rest into library. Subtitles:
  //  - Matched to videos by base name via matchSubtitles.
  //  - No video yet → stored in pendingSubsRef, matched when video arrives.
  //  - No match → added to subtitleFileMapRef so TrackSelector can pick them.
  const handleFilesDrop = useCallback((files: File[]): void => {
    const videoFiles = files.filter((f) => isVideoFile(f.name));
    const subFiles = files.filter((f) => isSubtitleFile(f.name));

    // Stash subtitles (pending if no video, or available for matching).
    for (const sub of subFiles) {
      pendingSubsRef.current.set(sub.name, sub);
      subtitleFileMapRef.current.set(sub.name, sub);
    }

    // Save subtitles to library (persist for future sessions + Subtitles tab).
    if (subFiles.length > 0) {
      void (async (): Promise<void> => {
        for (const sub of subFiles) {
          const record = buildSubtitleRecord(sub);
          record.id = sub.name;
          await saveSubtitle(record).catch(() => {
            const { fileHandle, ...rest } = record;
            void fileHandle;
            return saveSubtitle(rest as SubtitleRecord);
          });
        }
        const subs = await getAllSubtitles();
        setSubtitlesLibrary(subs);
      })();
    }

    if (videoFiles.length === 0) {
      // Subtitle-only drop. If a video is already loaded, try matching now.
      if (currentVideo) {
        void matchPendingSubsForCurrentVideo();
      }
      return;
    }

    // Sort videos: numeric suffix first, then alphabetical.
    const sorted = sortVideosByNumericSuffix(videoFiles.map((f) => f.name));
    const sortedFiles = sorted.map((name) => videoFiles.find((f) => f.name === name)!);

    // Cache all dropped video File objects for prev/next navigation.
    for (const f of sortedFiles) {
      videoFileCacheRef.current.set(`${f.name}-${f.size}-${f.lastModified}`, f);
    }

    // Play first video, queue rest into library.
    const [first, ...rest] = sortedFiles;
    void loadVideoWithPendingSubs(first!);

    // Save remaining videos to library (async, non-blocking).
    void (async (): Promise<void> => {
      for (const v of rest) {
        const record = buildVideoRecord(v);
        await saveVideo(record).catch(() => {
          const { fileHandle, ...rest2 } = record;
          void fileHandle;
          return saveVideo(rest2 as VideoRecord);
        });
      }
      const videos = await getAllVideos();
      setLibrary(videos);
    })();
  }, [currentVideo, setLibrary, setSubtitlesLibrary]);

  /** Load a video + match it against pending subtitles (no folder scan needed). */
  async function loadVideoWithPendingSubs(file: File): Promise<void> {
    const record = buildVideoRecord(file);
    setVideo(record, file);

    await saveVideo(record).catch(() => {
      const { fileHandle, ...rest } = record;
      void fileHandle;
      return saveVideo(rest as VideoRecord);
    });
    await addHistoryEntry({
      id: `${record.id}-${Date.now()}`,
      videoId: record.id,
      watchedAt: new Date().toISOString(),
      watchDurationMs: 0,
      positionMs: 0,
    });

    const videos = await getAllVideos();
    setLibrary(videos);
    saverRef.current = createThrottledSaver(resumeRepo, record.id, 5000);

    // Match against pending + cached subtitles.
    void matchPendingSubsForVideo(file);
  }

  /** Match pending subtitles against a specific video file. */
  async function matchPendingSubsForVideo(videoFile_: File): Promise<void> {
    const subFilenames = Array.from(pendingSubsRef.current.keys());
    if (subFilenames.length === 0) {
      setSubtitleStatus('not-found');
      setSubtitles({ target: null, native: null, others: [] });
      return;
    }

    setSubtitleStatus('searching');
    const result = matchSubtitlesForVideo(videoFile_.name, subFilenames, 'en', 'vi');

    if (result.target) {
      setSubtitles({
        target: result.target,
        native: result.native ?? null,
        others: result.others,
      });
      const targetFile = pendingSubsRef.current.get(result.target.filename);
      const nativeFile = result.native?.filename
        ? pendingSubsRef.current.get(result.native.filename)
        : undefined;
      if (targetFile) {
        await loadAndParseSubtitle(targetFile, nativeFile);
      }
    } else if (subFilenames.length === 1) {
      // Auto-pair: 1 video + 1 subtitle with different base name.
      const sole = subFilenames[0]!;
      const autoMatch: SubtitleMatch = { filename: sole, languageCode: 'en', tags: [] };
      setSubtitles({ target: autoMatch, native: null, others: [] });
      const f = pendingSubsRef.current.get(sole);
      if (f) await loadAndParseSubtitle(f);
    } else {
      // No match — subs stay in subtitleFileMapRef for TrackSelector manual pick.
      setSubtitleStatus('not-found');
      setSubtitles({ target: null, native: null, others: [] });
    }
  }

  /** Match pending subtitles against the currently loaded video. */
  async function matchPendingSubsForCurrentVideo(): Promise<void> {
    if (!currentVideo) return;
    const subFilenames = Array.from(pendingSubsRef.current.keys());
    if (subFilenames.length === 0) return;
    // Reuse loadVideo's subtitle matching by calling matchPendingSubsForVideo
    // with the current video file. We need the File object — get from store.
    const file = videoFile;
    if (!file) return;
    void matchPendingSubsForVideo(file);
  }

  // ── Add folder: pick folder → scan → save all (SSOT savePickedMedia) ──
  // Cùng flow handleOpenFile — 2 nút cùng cơ chế, user chọn folder 1 lần.
  const handleOpenFolder = useCallback(async (): Promise<void> => {
    const dirHandle = await openFolder();
    if (!dirHandle) return;

    dirHandleRef.current = dirHandle;
    const scan = await scanFolder(dirHandle);
    subtitleFileMapRef.current = scan.subtitleFiles;

    await savePickedMedia(scan.videos, scan.subtitleFiles, dirHandle);
  }, [savePickedMedia]);

  /** Load a video File into the player: create record, save to library, match subs. */
  async function loadVideo(file: File, handle?: FileSystemFileHandle): Promise<void> {
    console.log('[Cell:autoMatch] loadVideo ENTER', { filename: file.name, hasHandle: !!handle, fileSize: file.size });
    const record = buildVideoRecord(file);
    if (handle) record.fileHandle = handle;
    if (dirHandleRef.current) record.dirHandle = dirHandleRef.current;
    setVideo(record, file);

    // Save to library (upsert) + add history entry.
    // Fallback: if fileHandle/dirHandle is not structured-cloneable, retry without it.
    await saveVideo(record).catch(() => {
      const { fileHandle, dirHandle, ...rest } = record;
      void fileHandle;
      void dirHandle;
      return saveVideo(rest as VideoRecord);
    });
    await addHistoryEntry({
      id: `${record.id}-${Date.now()}`,
      videoId: record.id,
      watchedAt: new Date().toISOString(),
      watchDurationMs: 0,
      positionMs: 0,
    });

    // Refresh library list.
    const videos = await getAllVideos();
    setLibrary(videos);

    // Create throttled saver for this video.
    saverRef.current = createThrottledSaver(resumeRepo, record.id, 5000);

    // Auto-match subtitles: scan the video's folder for sibling subtitle files.
    // Pass the file handle so autoMatchSubtitles can resolve the parent dir.
    void autoMatchSubtitles(file);
  }

  /** Attempt subtitle auto-match by scanning the video's folder for sibling subtitle files.
   *  If no dirHandle is cached, falls back to matching against subtitles already
   *  saved in the library (from previous folder scans or manual subtitle loads). */
  async function autoMatchSubtitles(videoFile_: File): Promise<void> {
    console.log('[Cell:autoMatch] autoMatchSubtitles ENTER', { filename: videoFile_.name });
    setSubtitleStatus('searching');
    const targetLang = 'en';
    const nativeLang = 'vi';

    let subtitleFilenames: string[] = [];
    let subtitleFileMap = subtitleFileMapRef.current;
    console.log('[Cell:autoMatch] cached subtitleFileMap size', subtitleFileMap.size);

    // If subtitleFileMap is already cached from handleOpenFile/handleOpenFolder,
    // reuse it — no need to scan the directory again.
    if (subtitleFileMap.size === 0) {
      subtitleFileMap = new Map();
      // Gap 3: Reuse cached directory handle if permission still granted.
      let dirHandle: FileSystemDirectoryHandle | null = dirHandleRef.current;
      console.log('[Cell:autoMatch] dirHandle cached?', !!dirHandle);
      if (dirHandle) {
        const granted = await verifyPermission(dirHandle, false);
        console.log('[Cell:autoMatch] dirHandle permission granted?', granted);
        if (!granted) dirHandle = null;
      }

      if (!dirHandle) {
        // No cached dirHandle — try matching against subtitles already saved
        // in the library (from previous folder scans or manual subtitle loads).
        console.log('[Cell:autoMatch] FALLBACK: matching against library subtitles');
        const libSubs = await getAllSubtitles();
        console.log('[Cell:autoMatch] library subtitles count', libSubs.length, libSubs.map(s => s.filename));
        if (libSubs.length > 0) {
          const libFilenames = libSubs.map((s) => s.filename);
          const result = matchSubtitlesForVideo(
            videoFile_.name,
            libFilenames,
            targetLang,
            nativeLang,
          );
          console.log('[Cell:autoMatch] library match result', { target: result.target?.filename, native: result.native?.filename, others: result.others.length });

          if (result.target) {
            // Resolve File objects from stored handles or in-memory cache.
            // drag-dropped files have no fileHandle — fall back to subtitleFileMapRef
            // (cached from a previous handleOpenFile/handleOpenFolder/drag-drop).
            const subtitleFileMap = new Map<string, File>();
            const cachedMap = subtitleFileMapRef.current;
            for (const sub of libSubs) {
              if (sub.fileHandle) {
                try {
                  const granted = await verifyPermission(sub.fileHandle, false);
                  console.log('[Cell:autoMatch] lib sub permission', sub.filename, granted);
                  if (granted) {
                    const f = await sub.fileHandle.getFile();
                    subtitleFileMap.set(sub.filename, f);
                    console.log('[Cell:autoMatch] lib sub file resolved', sub.filename, f.size);
                  }
                } catch (e) { console.log('[Cell:autoMatch] lib sub permission error', sub.filename, String(e)); }
              } else {
                // No fileHandle — try in-memory cache (drag-dropped files).
                const cached = cachedMap.get(sub.filename);
                if (cached) {
                  subtitleFileMap.set(sub.filename, cached);
                  console.log('[Cell:autoMatch] lib sub file from cache', sub.filename, cached.size);
                } else {
                  console.log('[Cell:autoMatch] lib sub no fileHandle + no cache', sub.filename);
                }
              }
            }
            subtitleFileMapRef.current = subtitleFileMap;
            console.log('[Cell:autoMatch] lib subtitleFileMap built', subtitleFileMap.size, Array.from(subtitleFileMap.keys()));

            setSubtitles({
              target: result.target,
              native: result.native ?? null,
              others: result.others,
            });
            const targetFile = subtitleFileMap.get(result.target.filename);
            console.log('[Cell:autoMatch] target file from map?', !!targetFile, result.target.filename);
            if (targetFile) {
              const nativeFile = result.native?.filename
                ? subtitleFileMap.get(result.native.filename)
                : undefined;
              await loadAndParseSubtitle(targetFile, nativeFile);
              console.log('[Cell:autoMatch] loadAndParseSubtitle DONE (library match)');
            }
            return;
          }

          // Auto-pair: 1 subtitle in library with different base name.
          if (libFilenames.length === 1) {
            const soleSubtitle = libFilenames[0];
            const subtitleFileMap = new Map<string, File>();
            const subRecord = libSubs[0];
            if (subRecord.fileHandle) {
              try {
                const granted = await verifyPermission(subRecord.fileHandle, false);
                if (granted) {
                  const f = await subRecord.fileHandle.getFile();
                  subtitleFileMap.set(soleSubtitle, f);
                }
              } catch { /* skip */ }
            }
            subtitleFileMapRef.current = subtitleFileMap;
            const autoMatch: SubtitleMatch = {
              filename: soleSubtitle,
              languageCode: targetLang,
              tags: [],
            };
            setSubtitles({ target: autoMatch, native: null, others: [] });
            const targetFile = subtitleFileMap.get(soleSubtitle);
            if (targetFile) await loadAndParseSubtitle(targetFile);
            return;
          }
        }

        // No library subtitles matched — show not-found.
        console.log('[Cell:autoMatch] NO MATCH — not-found');
        setSubtitleStatus('not-found');
        setSubtitles({ target: null, native: null, others: [] });
        return;
      }

      console.log('[Cell:autoMatch] scanning dirHandle for subtitles...');
      try {
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file' && isSubtitleFile(entry.name)) {
            const f = await (entry as FileSystemFileHandle).getFile();
            subtitleFileMap.set(entry.name, f);
          }
        }
      } catch {
        setSubtitleStatus('error');
        setSubtitles({ target: null, native: null, others: [] });
        return;
      }
      subtitleFileMapRef.current = subtitleFileMap;
    }

    subtitleFilenames = Array.from(subtitleFileMap.keys());
    console.log('[Cell:autoMatch] subtitleFilenames', subtitleFilenames);

    // Cache the subtitle file map for track switching.
    subtitleFileMapRef.current = subtitleFileMap;

    if (subtitleFilenames.length === 0) {
      console.log('[Cell:autoMatch] no subtitles found — not-found');
      setSubtitleStatus('not-found');
      setSubtitles({ target: null, native: null, others: [] });
      return;
    }

    const result = matchSubtitlesForVideo(
      videoFile_.name,
      subtitleFilenames,
      targetLang,
      nativeLang,
    );
    console.log('[Cell:autoMatch] dirScan match result', { target: result.target?.filename, native: result.native?.filename, others: result.others.length });

    if (result.target) {
      setSubtitles({
        target: result.target,
        native: result.native ?? null,
        others: result.others,
      });
      // Parse target subtitle file → load cues into engine.
      const targetFile = subtitleFileMap.get(result.target.filename);
      if (targetFile) {
        await loadAndParseSubtitle(targetFile, result.native?.filename ? subtitleFileMap.get(result.native.filename) : undefined);
      }
    } else if (subtitleFilenames.length === 1) {
      // Auto-pair: 1 video + 1 subtitle with different base name → pair them.
      // ponytail ceiling: only auto-pairs when exactly 1 subtitle exists.
      // Multiple unmatched subtitles → user must use track selector manually.
      const soleSubtitle = subtitleFilenames[0];
      const autoMatch: SubtitleMatch = {
        filename: soleSubtitle,
        languageCode: targetLang,
        tags: [],
      };
      setSubtitles({ target: autoMatch, native: null, others: [] });
      const targetFile = subtitleFileMap.get(soleSubtitle);
      if (targetFile) {
        await loadAndParseSubtitle(targetFile);
      }
    } else {
      setSubtitleStatus('not-found');
      setSubtitles({ target: null, native: null, others: [] });
    }
  }

  /** Parse subtitle file(s) and load cues into the SubtitleCueEngine. */
  async function loadAndParseSubtitle(targetFile: File, nativeFile?: File): Promise<void> {
    try {
      const targetContent = await targetFile.text();
      const targetCues = parseSubtitleFile(targetFile.name, targetContent);

      let nativeCues: SrtCue[] = [];
      if (nativeFile) {
        const nativeContent = await nativeFile.text();
        nativeCues = parseSubtitleFile(nativeFile.name, nativeContent);
      }

      subtitleEngine.loadCues(targetCues, nativeCues);
      setSubtitleStatus('loaded');
    } catch {
      setSubtitleStatus('error');
    }
  }

  // ── Open subtitle file manually (when auto-match fails) ────────────────
  const handleOpenSubtitle = useCallback(async (): Promise<void> => {
    const picked = await openSubtitleFile();
    if (!picked) return;
    await loadAndParseSubtitle(picked.file);
    setSubtitles({
      target: { filename: picked.file.name, languageCode: null, tags: [] },
      native: null,
      others: [],
    });
  }, [subtitleEngine]);

  // ── Track selector: user picks a different subtitle from the matched list ─
  const handleSelectTrack = useCallback(
    async (match: SubtitleMatch): Promise<void> => {
      const targetFile = subtitleFileMapRef.current.get(match.filename);
      if (!targetFile) return;
      // Update subtitles state: selected match becomes target, keep native if different.
      const currentNative = subtitles.native;
      setSubtitles({
        target: match,
        native: currentNative?.filename === match.filename ? null : currentNative,
        others: subtitles.others.filter((o) => o.filename !== match.filename),
      });
      const nativeFile = currentNative && currentNative.filename !== match.filename
        ? subtitleFileMapRef.current.get(currentNative.filename)
        : undefined;
      await loadAndParseSubtitle(targetFile, nativeFile);
    },
    [subtitles, subtitleEngine],
  );

  // ── Subtitle select from library: load subtitle file + apply to current video ──
  const handleSubtitleSelect = useCallback(
    async (subtitleId: string): Promise<void> => {
      const record = await getSubtitle(subtitleId);
      if (!record) return;

      // Get the File: prefer cached map, fall back to fileHandle from IndexedDB.
      let file: File | undefined = subtitleFileMapRef.current.get(record.filename);
      if (!file && record.fileHandle) {
        const granted = await verifyPermission(record.fileHandle, false);
        if (!granted) return;
        file = await record.fileHandle.getFile();
      }
      if (!file) return;

      // Cache for future track switches.
      subtitleFileMapRef.current.set(record.filename, file);

      const match: SubtitleMatch = {
        filename: record.filename,
        languageCode: record.languageCode,
        tags: [],
      };
      setSubtitles({ target: match, native: null, others: [] });
      setSubtitleStatus('loaded');
      await loadAndParseSubtitle(file);
    },
    [],
  );

  // ── Resume position: throttled save on timeupdate ──────────────────────
  const handleTimeUpdate = useCallback((currentTime: number): void => {
    const video = videoRef.current;
    if (!video) return;
    const positionMs = Math.round(currentTime * 1000);
    saverRef.current?.save(positionMs);
  }, []);

  // ── Flush resume position on unmount / page unload ─────────────────────
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

  // ── Library video select — reopen from stored handle or in-memory cache ─
  const handleVideoSelect = useCallback(
    async (videoId_: string): Promise<void> => {
      console.log('[Cell:autoMatch] handleVideoSelect ENTER', { videoId_ });
      // Fast path: in-memory cache (drag-dropped videos have no fileHandle).
      const cachedFile = videoFileCacheRef.current.get(videoId_);
      if (cachedFile) {
        console.log('[Cell:autoMatch] handleVideoSelect: cached file', cachedFile.name);
        await loadVideo(cachedFile);
        return;
      }
      const record = await getVideo(videoId_);
      console.log('[Cell:autoMatch] handleVideoSelect: record', { found: !!record, hasHandle: !!record?.fileHandle });
      if (!record?.fileHandle) return;
      // Re-request permission for stored handle (reverts to 'prompt' on retrieval).
      const granted = await verifyPermission(record.fileHandle, false);
      console.log('[Cell:autoMatch] handleVideoSelect: permission', granted);
      if (!granted) return;
      const file = await record.fileHandle.getFile();
      // Cache the video's parent dirHandle so autoMatchSubtitles can scan
      // the folder for sibling subtitle files matching this video.
      if (record.dirHandle) {
        dirHandleRef.current = record.dirHandle;
        console.log('[Cell:autoMatch] handleVideoSelect: dirHandle restored from record');
      }
      await loadVideo(file, record.fileHandle);
    },
    [],
  );

  // ── Delete single video from library ──────────────────────────────────
  const handleVideoDelete = useCallback(
    async (videoId: string): Promise<void> => {
      await deleteVideo(videoId).catch(() => {});
      videoFileCacheRef.current.delete(videoId);
      const [videos, subs] = await Promise.all([getAllVideos(), getAllSubtitles()]);
      setLibrary(videos);
      setSubtitlesLibrary(subs);
    },
    [setLibrary, setSubtitlesLibrary],
  );

  // ── Clear all videos + subtitles from library ─────────────────────────
  const handleClearAll = useCallback(
    async (): Promise<void> => {
      await Promise.all([clearAllVideos(), clearAllSubtitles()]).catch(() => {});
      videoFileCacheRef.current.clear();
      subtitleFileMapRef.current.clear();
      pendingSubsRef.current.clear();
      dirHandleRef.current = null;
      setLibrary([]);
      setSubtitlesLibrary([]);
      setSubtitles({ target: null, native: null, others: [] });
      setVideo(null, null);
    },
    [setLibrary, setSubtitlesLibrary, setSubtitles, setVideo],
  );

  // ── Prev/next video navigation (sorted library order) ──────────────────
  // Matches the order the user sees in LibraryView (sortLibrary SSOT).
  const sortedLibrary = useMemo(
    () => sortLibrary(library, librarySort as SortBy),
    [library, librarySort],
  );
  const currentIndex = currentVideo
    ? sortedLibrary.findIndex((v) => v.id === currentVideo.id)
    : -1;
  const hasPrevVideo = currentIndex > 0;
  const hasNextVideo = currentIndex >= 0 && currentIndex < sortedLibrary.length - 1;
  const handlePrevVideo = useCallback((): void => {
    if (!hasPrevVideo) return;
    void handleVideoSelect(sortedLibrary[currentIndex - 1].id);
  }, [hasPrevVideo, sortedLibrary, currentIndex, handleVideoSelect]);
  const handleNextVideo = useCallback((): void => {
    if (!hasNextVideo) return;
    void handleVideoSelect(sortedLibrary[currentIndex + 1].id);
  }, [hasNextVideo, sortedLibrary, currentIndex, handleVideoSelect]);

  // ── Library sort change (bridge LibrarySort → SortBy) ──────────────────
  const handleSortChange = useCallback(
    (sortBy: SortBy): void => {
      setLibrarySort(sortBy as LibrarySort);
    },
    [setLibrarySort],
  );

  // ── Resume prompt on video load ────────────────────────────────────────
  useEffect(() => {
    if (!currentVideo) return;
    const video = videoRef.current;
    if (!video) return;
    void (async (): Promise<void> => {
      const shouldResume = await resumeService.promptResume(
        currentVideo.id,
        currentVideo.durationMs,
        async (text) => window.confirm(text),
      );
      if (shouldResume) {
        const pos = await resumeService.getResumePosition(currentVideo.id);
        if (pos !== null) video.currentTime = pos / 1000;
      }
    })();
  }, [currentVideo]);

  // ── Manager callbacks: hide/show, download, offset, generate native ──────
  // Reuse patterns from reactSubtitleController (SSOT for content-script manager).
  // Local-player keeps hide state in React (no engine visible-flag wiring needed
  // because PlayerView overlays via SubtitlePanels which reads targetStyle.visible).
  const handleHideSection = useCallback((role: 'target' | 'native'): void => {
    if (role === 'target') {
      setTargetHidden((prev) => {
        const next = !prev;
        subtitleEngine.updateStyle('target', { visible: !next });
        return next;
      });
    } else {
      setNativeHidden((prev) => {
        const next = !prev;
        subtitleEngine.updateStyle('native', { visible: !next });
        return next;
      });
    }
  }, [subtitleEngine]);

  const handleHideBoth = useCallback((): void => {
    const bothHidden = targetHidden && nativeHidden;
    if (bothHidden) {
      setTargetHidden(false);
      setNativeHidden(false);
      subtitleEngine.updateStyle('target', { visible: true });
      subtitleEngine.updateStyle('native', { visible: true });
    } else {
      setTargetHidden(true);
      setNativeHidden(true);
      subtitleEngine.updateStyle('target', { visible: false });
      subtitleEngine.updateStyle('native', { visible: false });
    }
  }, [targetHidden, nativeHidden, subtitleEngine]);

  const handleDownloadItem = useCallback((role: 'target' | 'native', _index: number): void => {
    const cues = role === 'target' ? subtitleEngine.getTargetCues() : subtitleEngine.getNativeCues();
    if (cues.length === 0) return;
    const srt = cuesToSrt(cues);
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${role}-subtitle.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [subtitleEngine]);

  const handleOffsetChange = useCallback((_role: 'target' | 'native', ms: number): void => {
    subtitleEngine.setOffset(ms);
  }, [subtitleEngine]);

  // ── Appearance handlers (persist to settingsStore, debounce) ───────────
  const handleStyleChange = useCallback((role: 'target' | 'native', partial: Partial<OverlayStyleConfig>): void => {
    subtitleEngine.updateStyle(role, partial);
    if (stylePersistRef.current) clearTimeout(stylePersistRef.current);
    stylePersistRef.current = setTimeout(() => {
      const key = role === 'target' ? 'subtitleOverlayTargetStyle' : 'subtitleOverlayNativeStyle';
      const current = role === 'target' ? subtitleEngine.targetStyle : subtitleEngine.nativeStyle;
      void saveSettings({ [key]: current } as Record<string, unknown> as Partial<import('@/entities/settings').Settings>);
      stylePersistRef.current = null;
    }, PERSIST_DEBOUNCE_MS);
  }, [subtitleEngine]);

  const handleBlockSettingsChange = useCallback((partial: Partial<SubtitleBlockSettings>): void => {
    subtitleEngine.updateBlockSettings(partial);
    if (blockPersistRef.current) clearTimeout(blockPersistRef.current);
    blockPersistRef.current = setTimeout(() => {
      void saveSettings({ subtitleBlockSettings: subtitleEngine.blockSettings });
      blockPersistRef.current = null;
    }, PERSIST_DEBOUNCE_MS);
  }, [subtitleEngine]);

  const handleClusterSettingsChange = useCallback((partial: Partial<NavClusterSettings>): void => {
    subtitleEngine.updateClusterSettings(partial);
    if (clusterPersistRef.current) clearTimeout(clusterPersistRef.current);
    clusterPersistRef.current = setTimeout(() => {
      void saveSettings({ navClusterSettings: subtitleEngine.clusterSettings } as Record<string, unknown> as Partial<import('@/entities/settings').Settings>);
      clusterPersistRef.current = null;
    }, PERSIST_DEBOUNCE_MS);
  }, [subtitleEngine]);

  const handleResetStyle = useCallback((role: 'target' | 'native'): void => {
    const defaults = role === 'target' ? DEFAULT_OVERLAY_STYLE_TARGET : DEFAULT_OVERLAY_STYLE_NATIVE;
    subtitleEngine.updateStyle(role, defaults);
    const key = role === 'target' ? 'subtitleOverlayTargetStyle' : 'subtitleOverlayNativeStyle';
    void saveSettings({ [key]: defaults } as Record<string, unknown> as Partial<import('@/entities/settings').Settings>);
  }, [subtitleEngine]);

  const handlePreviewTextChange = useCallback((role: 'target' | 'native', text: string): void => {
    if (role === 'target') setPreviewTargetText(text);
    else setPreviewNativeText(text);
    if (previewTextPersistRef.current) clearTimeout(previewTextPersistRef.current);
    previewTextPersistRef.current = setTimeout(() => {
      const key = role === 'target' ? 'subtitlePreviewTargetText' : 'subtitlePreviewNativeText';
      void saveSettings({ [key]: text } as Record<string, unknown> as Partial<import('@/entities/settings').Settings>);
      previewTextPersistRef.current = null;
    }, PERSIST_DEBOUNCE_MS);
  }, []);

  // Cleanup persist timers on unmount.
  useEffect(() => {
    return (): void => {
      if (stylePersistRef.current) clearTimeout(stylePersistRef.current);
      if (blockPersistRef.current) clearTimeout(blockPersistRef.current);
      if (clusterPersistRef.current) clearTimeout(clusterPersistRef.current);
      if (previewTextPersistRef.current) clearTimeout(previewTextPersistRef.current);
    };
  }, []);

  // ── Manager state: build SubtitlePanelItem[] from SubtitlesState ─────────
  // Manager lets the user see + re-select the active target/native track.
  // onSelect reuses handleSelectTrack (finds the SubtitleMatch by filename).
  // onImport opens the subtitle file picker (same as manual open flow).
  // Appearance + hide + download + offset + generate-native mirror
  // reactSubtitleController.buildManagerState (SSOT).
  const appearance: AppearanceState = useMemo(() => ({
    targetStyle: subtitleEngine.targetStyle,
    nativeStyle: subtitleEngine.nativeStyle,
    blockSettings: subtitleEngine.blockSettings,
    clusterSettings: subtitleEngine.clusterSettings,
    defaultTargetStyle: DEFAULT_OVERLAY_STYLE_TARGET,
    defaultNativeStyle: DEFAULT_OVERLAY_STYLE_NATIVE,
    previewTargetText,
    previewNativeText,
    onStyleChange: handleStyleChange,
    onBlockSettingsChange: handleBlockSettingsChange,
    onClusterSettingsChange: handleClusterSettingsChange,
    onResetStyle: handleResetStyle,
    onPreviewTextChange: handlePreviewTextChange,
  }), [
    subtitleEngine.targetStyle, subtitleEngine.nativeStyle,
    subtitleEngine.blockSettings, subtitleEngine.clusterSettings,
    previewTargetText, previewNativeText,
    handleStyleChange, handleBlockSettingsChange, handleClusterSettingsChange,
    handleResetStyle, handlePreviewTextChange,
  ]);

  const manager: ManagerState = useMemo(() => {
    const items = buildPanelItemsFromSubtitles(subtitles);
    const allMatches: SubtitleMatch[] = [
      subtitles.target,
      subtitles.native,
      ...subtitles.others,
    ].filter(Boolean) as SubtitleMatch[];

    return {
      targetItems: items.targetItems,
      nativeItems: items.nativeItems,
      targetActiveIndex: items.targetActiveIndex,
      nativeActiveIndex: items.nativeActiveIndex,
      onSelect: (role, index) => {
        const list = role === 'target' ? items.targetItems : items.nativeItems;
        const item = list[index];
        if (!item) return;
        // Find the SubtitleMatch by filename (id = `${role}-${filename}`)
        const filename = item.id.slice(role.length + 1);
        const match = allMatches.find((m) => m.filename === filename);
        if (match) handleSelectTrack(match);
      },
      onImport: () => { void handleOpenSubtitle(); },
      onGenerateNative: subtitleActions.onGenerateNative,
      onOffsetChange: handleOffsetChange,
      onDownload: handleDownloadItem,
      onHideSection: handleHideSection,
      onHideBoth: handleHideBoth,
      targetHidden,
      nativeHidden,
      bothHidden: targetHidden && nativeHidden,
      appearance,
      hasSearchKeys: false,
      apiKeys: [],
      onApiKeysChange: () => {},
      onSearchResultSelect: () => {},
    };
  }, [subtitles, handleSelectTrack, handleOpenSubtitle, subtitleActions.onGenerateNative, handleOffsetChange, handleDownloadItem, handleHideSection, handleHideBoth, targetHidden, nativeHidden, appearance]);

  return (
    <PlayerView
      videoRef={videoRef}
      videoFile={videoFile}
      filename={videoFile?.name ?? null}
      subtitles={subtitles}
      subtitleStatus={subtitleStatus}
      library={library}
      subtitlesLibrary={subtitlesLibrary}
      librarySort={librarySort as SortBy}
      targetStyle={subtitleEngine.targetStyle}
      nativeStyle={subtitleEngine.nativeStyle}
      onOpenFile={handleOpenFile}
      onOpenFolder={handleOpenFolder}
      onOpenSubtitle={handleOpenSubtitle}
      onSelectTrack={handleSelectTrack}
      onFilesDrop={handleFilesDrop}
      onVideoSelect={handleVideoSelect}
      onVideoDelete={handleVideoDelete}
      onClearAll={handleClearAll}
      onSubtitleSelect={handleSubtitleSelect}
      onSortChange={handleSortChange}
      currentVideoId={currentVideo?.id ?? null}
      onTimeUpdate={handleTimeUpdate}
      subtitleEngine={subtitleEngine}
      manager={manager}
      subtitleActions={subtitleActions}
      hasPrevVideo={hasPrevVideo}
      hasNextVideo={hasNextVideo}
      onPrevVideo={handlePrevVideo}
      onNextVideo={handleNextVideo}
    />
  );
}

// ─── React mount ────────────────────────────────────────────────────────────

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <ThemeProvider>
      <ErrorBoundary>
        <LocalPlayerApp />
      </ErrorBoundary>
    </ThemeProvider>,
  );
}

// Re-export for testability (mocked in main.test.tsx).
export { LocalPlayerApp };
