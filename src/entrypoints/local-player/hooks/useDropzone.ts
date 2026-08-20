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
 */
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
      const dropped = Array.from(e.dataTransfer.files ?? []);
      const accepted = dropped.filter((f) => isVideoFile(f.name) || isSubtitleFile(f.name));
      if (accepted.length > 0) onFilesDrop(accepted);
    },
    [onFilesDrop],
  );

  return { dragging, handlers: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}
