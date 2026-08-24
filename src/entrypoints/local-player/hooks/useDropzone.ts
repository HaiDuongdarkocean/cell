import { useCallback, useRef, useState, type DragEvent } from 'react';
import { isVideoFile, isSubtitleFile } from '@/features/local-player/logic/folderScan';

export interface DropzoneHandlers {
  onDragEnter: (e: DragEvent<HTMLElement>) => void;
  onDragOver: (e: DragEvent<HTMLElement>) => void;
  onDragLeave: (e: DragEvent<HTMLElement>) => void;
  onDrop: (e: DragEvent<HTMLElement>) => void;
}

/**
 * useDropzone — drag-and-drop logic for the video stage.
 *
 * Pure logic (no side effects beyond state) so it is testable in isolation
 * and reusable across EmptyState + PlayerView video stage.
 *
 * Counter pattern: dragenter/dragleave fire on every child element boundary
 * crossing. A depth counter keeps the "dragging" flag stable until the cursor
 * fully exits the container — prevents flicker when the pointer moves over
 * nested children (icon, text, buttons) inside the dropzone.
 *
 * File filter: accepts video + subtitle files (detected by extension, not
 * MIME — drag-drop MIME is unreliable per EmptyState original comment).
 *
 * Folder support: uses webkitGetAsEntry() to traverse dropped directories
 * recursively, collecting all video + subtitle files inside.
 */

/** Recursively traverse a FileSystemEntry, collecting video + subtitle Files. */
function traverseEntry(
  entry: FileSystemEntry,
  prefix: string,
  acc: File[],
  done: () => void,
): void {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    fileEntry.file((file: File) => {
      // Use the real filename (not the prefixed path) for matching logic.
      if (isVideoFile(file.name) || isSubtitleFile(file.name)) {
        acc.push(file);
      }
      done();
    }, done);
  } else if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    const readBatch = (): void => {
      reader.readEntries((entries: FileSystemEntry[]) => {
        if (entries.length === 0) { done(); return; }
        let remaining = entries.length;
        for (const child of entries) {
          traverseEntry(child, `${prefix}${entry.name}/`, acc, () => {
            remaining -= 1;
            if (remaining === 0) readBatch();
          });
        }
      }, done);
    };
    readBatch();
  } else {
    done();
  }
}

/** Collect all video + subtitle Files from a DataTransfer (files + folder entries). */
function collectDroppedFiles(dataTransfer: DataTransfer, callback: (files: File[]) => void): void {
  // Fast path: no items API → use plain files (no folder support).
  if (!dataTransfer.items || dataTransfer.items.length === 0) {
    const files = Array.from(dataTransfer.files ?? []).filter(
      (f) => isVideoFile(f.name) || isSubtitleFile(f.name),
    );
    callback(files);
    return;
  }

  const items = Array.from(dataTransfer.items);
  const entries: FileSystemEntry[] = [];
  for (const item of items) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }

  // No entries → fall back to plain files.
  if (entries.length === 0) {
    const files = Array.from(dataTransfer.files ?? []).filter(
      (f) => isVideoFile(f.name) || isSubtitleFile(f.name),
    );
    callback(files);
    return;
  }

  const acc: File[] = [];
  let remaining = entries.length;
  for (const entry of entries) {
    traverseEntry(entry, '', acc, () => {
      remaining -= 1;
      if (remaining === 0) callback(acc);
    });
  }
}

export function useDropzone(onFilesDrop: (files: File[]) => void): {
  dragging: boolean;
  handlers: DropzoneHandlers;
} {
  const [dragging, setDragging] = useState(false);
  const depthRef = useRef(0);

  const onDragEnter = useCallback((e: DragEvent<HTMLElement>): void => {
    e.preventDefault();
    depthRef.current += 1;
    setDragging(true);
  }, []);

  const onDragOver = useCallback((e: DragEvent<HTMLElement>): void => {
    // preventDefault required to allow drop (otherwise browser opens file).
    e.preventDefault();
  }, []);

  const onDragLeave = useCallback((e: DragEvent<HTMLElement>): void => {
    e.preventDefault();
    depthRef.current = Math.max(0, depthRef.current - 1);
    if (depthRef.current === 0) setDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLElement>): void => {
      e.preventDefault();
      depthRef.current = 0;
      setDragging(false);
      collectDroppedFiles(e.dataTransfer, (files) => {
        if (files.length > 0) onFilesDrop(files);
      });
    },
    [onFilesDrop],
  );

  return { dragging, handlers: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}
