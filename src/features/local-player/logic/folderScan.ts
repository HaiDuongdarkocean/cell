/**
 * folderScan — scan a directory for video + subtitle files, match them,
 * and build a library-ready result.
 *
 * Ponytail ceiling: O(n) scan where n = files in folder. 10k files = ~2s.
 * Upgrade: web worker for background scan without blocking UI.
 */
import type { SubtitleMatch } from '@/features/local-player/logic/subtitleMatch';
import { matchSubtitles } from '@/features/local-player/logic/subtitleMatch';

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogg', 'ogv', 'mov']);
const SUBTITLE_EXTENSIONS = new Set(['srt', 'vtt', 'ass', 'ssa', 'ttml', 'dfxp', 'sbv', 'smi', 'sami']);

function getExtension(filename: string): string {
  const dotIdx = filename.lastIndexOf('.');
  if (dotIdx <= 0) return '';
  return filename.slice(dotIdx + 1).toLowerCase();
}

export function isVideoFile(filename: string): boolean {
  return VIDEO_EXTENSIONS.has(getExtension(filename));
}

export function isSubtitleFile(filename: string): boolean {
  return SUBTITLE_EXTENSIONS.has(getExtension(filename));
}

export interface VideoScanResult {
  readonly file: File;
  readonly handle: FileSystemFileHandle;
  readonly filename: string;
}

export interface FolderScanResult {
  /** All video files found in the folder. */
  readonly videos: VideoScanResult[];
  /** Map of subtitle filename → File, for track switching later. */
  readonly subtitleFiles: Map<string, File>;
  /** All subtitle filenames (keys of subtitleFiles). */
  readonly subtitleFilenames: string[];
}

export interface VideoWithSubtitles {
  readonly video: VideoScanResult;
  readonly subtitles: {
    readonly target: SubtitleMatch | null;
    readonly native: SubtitleMatch | null;
    readonly others: SubtitleMatch[];
  };
}

/**
 * Scan a directory handle for video + subtitle files (top-level only,
 * no recursion — ponytail: avoids scanning entire drive).
 */
export async function scanFolder(
  dirHandle: FileSystemDirectoryHandle,
): Promise<FolderScanResult> {
  const videos: VideoScanResult[] = [];
  const subtitleFiles = new Map<string, File>();

  for await (const entry of dirHandle.values()) {
    if (entry.kind !== 'file') continue;
    const ext = getExtension(entry.name);
    if (!ext) continue;

    if (VIDEO_EXTENSIONS.has(ext)) {
      const fileHandle = entry as FileSystemFileHandle;
      try {
        const file = await fileHandle.getFile();
        videos.push({ file, handle: fileHandle, filename: entry.name });
      } catch {
        // Skip unreadable video files (corrupt, permission, etc.)
      }
    } else if (SUBTITLE_EXTENSIONS.has(ext)) {
      const fileHandle = entry as FileSystemFileHandle;
      try {
        const file = await fileHandle.getFile();
        subtitleFiles.set(entry.name, file);
      } catch {
        // Skip unreadable subtitle files
      }
    }
  }

  return {
    videos,
    subtitleFiles,
    subtitleFilenames: Array.from(subtitleFiles.keys()),
  };
}

/**
 * Match each video with its subtitles using the existing matchSubtitles logic.
 * Videos without matching subtitles get empty subtitles (target: null).
 */
export function matchVideosWithSubtitles(
  videos: readonly VideoScanResult[],
  subtitleFilenames: readonly string[],
  targetLang: string,
  nativeLang: string,
): VideoWithSubtitles[] {
  return videos.map((video) => {
    const result = matchSubtitles(
      video.filename,
      subtitleFilenames,
      targetLang,
      nativeLang,
    );
    return {
      video,
      subtitles: {
        target: result.target ?? null,
        native: result.native ?? null,
        others: result.others,
      },
    };
  });
}
