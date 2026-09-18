import {
  createScoreTracker,
  createTokenList,
  fetchTermStatuses,
  type Token,
} from '@/features/tokenize';
import type { WordStatus } from '@/entities/dictionary';
import type { SrtCue } from '@/entities/media';
import { isSubtitleFile } from '@/features/local-player/logic/folderScan';
import type { MatchResult } from '@/features/local-player/logic/subtitleMatch';
import {
  updateVideoComprehension,
  type SubtitleRecord,
  type VideoComprehension,
  type VideoRecord,
} from '@/features/local-player/services/mediaLibraryRepository';
import { matchSubtitlesForVideo, parseSubtitleFile } from '../hooks/useSubtitleMatch';

export interface TokenCacheEntry {
  readonly subtitleFilename: string;
  readonly mtimeMs: number;
  readonly tokens: readonly Token[];
  readonly terms: readonly string[];
}

export type TokenCache = Map<string, TokenCacheEntry>;

export interface LibraryScoreDeps {
  matchSubtitlesForVideo: (
    videoFilename: string,
    subtitleFiles: readonly string[],
    targetLang: string,
    nativeLang: string,
  ) => MatchResult;
  parseSubtitleFile: (filename: string, content: string) => SrtCue[];
  queryPermission: (handle: FileSystemHandle) => Promise<PermissionState>;
  scanSubtitlesInDir: (
    dirHandle: FileSystemDirectoryHandle,
  ) => Promise<ReadonlyMap<string, File>>;
  fetchTermStatuses: (
    langCode: string,
    terms: Iterable<string>,
  ) => Promise<ReadonlyMap<string, WordStatus>>;
  updateVideoComprehension: (
    id: string,
    comprehension: VideoComprehension,
  ) => Promise<boolean>;
  now: () => string;
}

export interface LibraryScoreInput {
  videos: readonly VideoRecord[];
  subtitles: readonly SubtitleRecord[];
  fileMap: { get(filename: string): File | undefined };
  deps: LibraryScoreDeps;
  tokenCache: TokenCache;
  isCurrent: () => boolean;
  targetLang?: string;
  nativeLang?: string;
}

export interface LibraryScoreResult {
  writes: number;
  scored: number;
  skipped: number;
  aborted: boolean;
}

async function scanSubtitlesInDir(
  dirHandle: FileSystemDirectoryHandle,
): Promise<ReadonlyMap<string, File>> {
  const files = new Map<string, File>();
  try {
    for await (const entry of dirHandle.values()) {
      if (entry.kind !== 'file' || !isSubtitleFile(entry.name)) continue;
      try {
        files.set(entry.name, await (entry as FileSystemFileHandle).getFile());
      } catch {
        // per-entry: unreadable files don't poison the scan
      }
    }
  } catch {
    // iteration failure → partial/empty map, scoring just skips those files
  }
  return files;
}

export const defaultLibraryScoreDeps: LibraryScoreDeps = {
  matchSubtitlesForVideo,
  parseSubtitleFile,
  queryPermission: (handle) => handle.queryPermission({ mode: 'read' }),
  scanSubtitlesInDir,
  fetchTermStatuses,
  updateVideoComprehension,
  now: () => new Date().toISOString(),
};

interface ScoredVideo {
  video: VideoRecord;
  entry: TokenCacheEntry;
}

export async function runLibraryScoring(
  input: LibraryScoreInput,
): Promise<LibraryScoreResult> {
  const { videos, subtitles, fileMap, deps, tokenCache, isCurrent } = input;
  const targetLang = input.targetLang ?? 'en';
  const nativeLang = input.nativeLang ?? 'vi';
  const result: LibraryScoreResult = { writes: 0, scored: 0, skipped: 0, aborted: false };
  if (videos.length === 0) {
    tokenCache.clear();
    return result;
  }

  const liveVideoIds = new Set(videos.map((v) => v.id));
  for (const key of tokenCache.keys()) {
    if (!liveVideoIds.has(key)) tokenCache.delete(key);
  }

  const libFilenames = subtitles.map((s) => s.filename);
  const subByFilename = new Map(subtitles.map((s) => [s.filename, s]));
  const dirScans = new Map<
    FileSystemDirectoryHandle,
    Promise<ReadonlyMap<string, File>>
  >();
  const dirScan = (handle: FileSystemDirectoryHandle) => {
    let scan = dirScans.get(handle);
    if (!scan) {
      scan = deps.scanSubtitlesInDir(handle);
      dirScans.set(handle, scan);
    }
    return scan;
  };
  const granted = async (handle: FileSystemHandle): Promise<boolean> => {
    try {
      return (await deps.queryPermission(handle)) === 'granted';
    } catch {
      return false;
    }
  };

  const scored: ScoredVideo[] = [];
  const allTerms = new Set<string>();

  for (const video of videos) {
    if (!isCurrent()) return { ...result, aborted: true };

    const candidates = new Set<string>(libFilenames);
    let dirFiles: ReadonlyMap<string, File> | undefined;
    if (video.dirHandle && (await granted(video.dirHandle))) {
      dirFiles = await dirScan(video.dirHandle);
      for (const name of dirFiles.keys()) candidates.add(name);
    }
    const names = [...candidates];
    const match = deps.matchSubtitlesForVideo(
      video.filename,
      names,
      targetLang,
      nativeLang,
    );
    let filename = match.target?.filename;
    if (!filename && names.length === 1) filename = names[0];
    if (!filename) {
      result.skipped++;
      continue;
    }

    let file = fileMap.get(filename) ?? dirFiles?.get(filename);
    if (!file) {
      const rec = subByFilename.get(filename);
      if (rec?.fileHandle && (await granted(rec.fileHandle))) {
        file = await rec.fileHandle.getFile().catch(() => undefined);
      }
    }
    if (!file) {
      result.skipped++;
      continue;
    }

    const cached = tokenCache.get(video.id);
    let entry = cached;
    if (
      !entry ||
      entry.subtitleFilename !== filename ||
      entry.mtimeMs !== file.lastModified
    ) {
      let cues: SrtCue[];
      try {
        cues = deps.parseSubtitleFile(file.name, await file.text());
      } catch {
        result.skipped++;
        continue;
      }
      const tokens = cues.flatMap((c) => createTokenList(c.text, targetLang));
      const terms = [
        ...new Set(
          tokens.filter((t) => !t.isSeparator).map((t) => t.term),
        ),
      ];
      entry = {
        subtitleFilename: filename,
        mtimeMs: file.lastModified,
        tokens,
        terms,
      };
      tokenCache.set(video.id, entry);
    }

    scored.push({ video, entry });
    for (const term of entry.terms) allTerms.add(term);
    result.scored++;
  }

  if (scored.length === 0) return result;

  let statuses: ReadonlyMap<string, WordStatus>;
  try {
    statuses = await deps.fetchTermStatuses(targetLang, allTerms);
  } catch {
    return { ...result, aborted: true };
  }
  if (statuses.size === 0) return { ...result, aborted: true };

  for (const { video, entry } of scored) {
    if (!isCurrent()) return { ...result, aborted: true };
    const tracker = createScoreTracker(entry.tokens, statuses, targetLang);
    const stats = tracker.stats('media');
    if (stats.totalTokens === 0) continue;

    const prev = video.comprehension;
    if (
      prev &&
      prev.coverage === stats.coverage &&
      prev.band === stats.band &&
      prev.newTerms === stats.newTerms &&
      prev.subtitleFilename === entry.subtitleFilename
    ) {
      continue;
    }

    const landed = await deps.updateVideoComprehension(video.id, {
      coverage: stats.coverage,
      band: stats.band,
      newTerms: stats.newTerms,
      subtitleFilename: entry.subtitleFilename,
      computedAt: deps.now(),
    });
    if (landed) result.writes++;
  }

  return result;
}
