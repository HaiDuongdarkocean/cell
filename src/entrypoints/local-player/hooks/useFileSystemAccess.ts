/**
 * File System Access API wrappers for the local video player.
 *
 * @source File System Access API — MDN:
 *   https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
 * @source Window.showOpenFilePicker() — MDN:
 *   https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker
 * @source FileSystemHandle.queryPermission() — MDN:
 *   https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/queryPermission
 * @source Chrome — The File System Access API: simplifying access to local files:
 *   https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
 * @source Chrome Extensions — secure context (extension pages are secure):
 *   https://developer.chrome.com/docs/extensions/reference/
 *
 * API quirks (verified from sources above):
 * - `showOpenFilePicker()` returns an **array** of FileSystemFileHandle, even
 *   when `multiple: false` — we destructure the first entry.
 * - `AbortError` DOMException is thrown when the user dismisses the picker
 *   without selecting a file → we return `null` (not an error).
 * - `SecurityError` DOMException is thrown when the call is not triggered by
 *   a user gesture or is blocked by same-origin policy → we re-throw.
 * - `queryPermission()` / `requestPermission()` accept `{ mode: 'read' |
 *   'readwrite' }` and return `Promise<PermissionState>` where
 *   PermissionState = 'granted' | 'denied' | 'prompt'.
 * - Handles retrieved from IndexedDB revert to 'prompt' → must re-request.
 *   Source: Chrome — Persistent permissions for the File System Access API
 *   https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api
 */

/** Result of a successful file picker call. */
export interface PickedFile {
  readonly file: File;
  readonly handle: FileSystemFileHandle;
}

/**
 * Generic file picker wrapper: calls `showOpenFilePicker`, resolves the first
 * handle to `{ file, handle }`, returns `null` on user cancel (AbortError),
 * re-throws all other DOMExceptions (SecurityError, TypeError, etc.).
 *
 * @source MDN — showOpenFilePicker exceptions:
 *   AbortError: user dismisses prompt without selection.
 *   SecurityError: not called via user interaction / same-origin block.
 */
async function pickFile(
  options: OpenFilePickerOptions,
): Promise<PickedFile | null> {
  let handles: FileSystemFileHandle[];
  try {
    handles = await window.showOpenFilePicker(options);
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null;
    }
    throw error;
  }

  const handle = handles[0];
  if (handle === undefined) return null;

  const file = await handle.getFile();
  return { file, handle };
}

/**
 * Opens a video file picker. Calls `window.showOpenFilePicker` with
 * `id: 'local-player-video'` so Chrome remembers the last-used directory
 * for video picks.
 *
 * Accepts common web-playable video formats: MP4, WebM, OGG/OGV, MOV.
 */
export async function openVideoFile(): Promise<PickedFile | null> {
  return pickFile({
    id: 'local-player-video',
    multiple: false,
    types: [
      {
        description: 'Video',
        accept: {
          'video/*': ['.mp4', '.webm', '.ogg', '.ogv', '.mov'],
        },
      },
    ],
  });
}

/**
 * Opens a multi-select file picker for videos AND subtitles in one dialog.
 * Uses `multiple: true` so the user can pick any mix of video + subtitle files
 * (including subtitles with names that don't match any video base name).
 *
 * Returns `null` on user cancel (AbortError), re-throws other DOMExceptions.
 */
export async function openMediaFiles(): Promise<PickedFile[] | null> {
  let handles: FileSystemFileHandle[];
  try {
    handles = await window.showOpenFilePicker({
      id: 'local-player-media',
      multiple: true,
      types: [
        {
          description: 'Video & Subtitle',
          accept: {
            'video/*': ['.mp4', '.webm', '.ogg', '.ogv', '.mov'],
            'text/*': ['.srt', '.vtt', '.ass', '.ssa', '.ttml', '.dfxp', '.sbv', '.smi', '.sami'],
          },
        },
      ],
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null;
    }
    throw error;
  }

  if (handles.length === 0) return null;
  const files = await Promise.all(
    handles.map(async (handle) => {
      const file = await handle.getFile();
      return { file, handle } as PickedFile;
    }),
  );
  return files;
}

/**
 * Opens a subtitle file picker. Calls `window.showOpenFilePicker` with
 * `id: 'local-player-subtitle'` so Chrome remembers the last-used directory
 * for subtitle picks.
 *
 * Accepts all subtitle formats supported by the player's parser pipeline:
 * SRT, VTT, ASS/SSA, TTML/DFXP, SBV, SMI.
 */
export async function openSubtitleFile(): Promise<PickedFile | null> {
  return pickFile({
    id: 'local-player-subtitle',
    multiple: false,
    types: [
      {
        description: 'Subtitle',
        accept: {
          'text/*': ['.srt', '.vtt', '.ass', '.ssa', '.ttml', '.dfxp', '.sbv', '.smi'],
        },
      },
    ],
  });
}

/**
 * Opens a directory picker. Calls `window.showDirectoryPicker` with
 * `id: 'local-player-folder'` so Chrome remembers the last-used folder.
 *
 * Returns `null` on user cancel (AbortError), re-throws other DOMExceptions.
 *
 * @source MDN — showDirectoryPicker:
 *   https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker
 */
export async function openFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await window.showDirectoryPicker({ id: 'local-player-folder' });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null;
    }
    throw error;
  }
}

/**
 * Verifies that the user has granted permission for a stored file handle.
 *
 * Handles retrieved from IndexedDB revert to 'prompt' — this function first
 * queries the current state, then requests permission if needed.
 *
 * @param handle    - FileSystemHandle (file or directory) to verify.
 * @param readWrite - `true` for readwrite mode, `false` for read-only.
 * @returns `true` if permission is granted, `false` if denied.
 *
 * @source MDN — queryPermission example (verifyPermission pattern):
 *   https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/queryPermission#examples
 */
export async function verifyPermission(
  handle: FileSystemHandle,
  readWrite: boolean,
): Promise<boolean> {
  const mode = (readWrite ? 'readwrite' : 'read') as 'read' | 'readwrite';
  const descriptor: FileSystemPermissionDescriptor = { mode };

  const state = await handle.queryPermission(descriptor);

  if (state === 'granted') return true;
  if (state === 'denied') return false;

  // state === 'prompt' → request permission (requires user gesture).
  return (await handle.requestPermission(descriptor)) === 'granted';
}
