/**
 * Type augmentations for the File System Access API.
 *
 * TypeScript 6.0's bundled lib.dom.d.ts includes `FileSystemHandle` and
 * `FileSystemFileHandle` but does NOT yet declare `showOpenFilePicker`,
 * `queryPermission`, `requestPermission`, or the associated option types.
 * These augmentations fill that gap so the local video player can use the
 * API with full type safety.
 *
 * @source MDN — File System Access API:
 *   https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
 * @source MDN — Window.showOpenFilePicker():
 *   https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker
 * @source MDN — FileSystemHandle.queryPermission():
 *   https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/queryPermission
 * @source MDN — FileSystemHandle.requestPermission():
 *   https://developer.mozilla.org/en-US/docs/Web/API/FileSystemHandle/requestPermission
 * @source Chrome — The File System Access API:
 *   https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
 */

/** Permission state returned by queryPermission / requestPermission. */
type PermissionState = 'granted' | 'denied' | 'prompt';

/** Descriptor for queryPermission / requestPermission. */
interface FileSystemPermissionDescriptor {
  mode?: 'read' | 'readwrite' | 'write';
}

/** Options for window.showOpenFilePicker(). */
interface OpenFilePickerOptions {
  id?: string;
  multiple?: boolean;
  types?: {
    description?: string;
    accept: Record<string, readonly string[]>;
  }[];
  excludeAcceptAllOption?: boolean;
  startIn?: string | FileSystemHandle;
}

interface SaveFilePickerOptions {
  id?: string;
  suggestedName?: string;
  types?: {
    description?: string;
    accept: Record<string, readonly string[]>;
  }[];
  excludeAcceptAllOption?: boolean;
  startIn?: string | FileSystemHandle;
}

interface DirectoryPickerOptions {
  id?: string;
  mode?: 'read' | 'readwrite';
  startIn?: string | FileSystemHandle;
}

interface FileSystemHandle {
  queryPermission(
    descriptor?: FileSystemPermissionDescriptor,
  ): Promise<PermissionState>;
  requestPermission(
    descriptor?: FileSystemPermissionDescriptor,
  ): Promise<PermissionState>;
  remove(): Promise<void>;
}

interface FileSystemFileHandle {
  move?(
    name: string,
  ): Promise<FileSystemFileHandle>;
  move?(
    destination: FileSystemDirectoryHandle,
    name?: string,
  ): Promise<FileSystemFileHandle>;
}

interface Window {
  showOpenFilePicker(
    options?: OpenFilePickerOptions,
  ): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker(
    options?: SaveFilePickerOptions,
  ): Promise<FileSystemFileHandle>;
  showDirectoryPicker(
    options?: DirectoryPickerOptions,
  ): Promise<FileSystemDirectoryHandle>;
}
