import { useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { createFileCache, type FileCache } from '../logic/fileCache';

export interface FileCaches {
  readonly dirHandleRef: RefObject<FileSystemDirectoryHandle | null>;
  readonly subtitleFileMapRef: RefObject<FileCache>;
  readonly pendingSubsRef: RefObject<FileCache>;
  readonly videoFileCacheRef: RefObject<FileCache>;
}

export function useFileCaches(): FileCaches {
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const subtitleFileMapRef = useRef<FileCache>(createFileCache());
  const pendingSubsRef = useRef<FileCache>(createFileCache());
  const videoFileCacheRef = useRef<FileCache>(createFileCache());
  return useMemo(
    () => ({ dirHandleRef, subtitleFileMapRef, pendingSubsRef, videoFileCacheRef }),
    [],
  );
}
