import { describe, expect, it, jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { useDropzone } from './useDropzone';

/** Build a fake DragEvent with a DataTransfer carrying the given files. */
function makeDragEvent(files: File[]): unknown {
  const fileList = {
    length: files.length,
    item: (i: number) => files[i],
    ...Object.fromEntries(files.map((f, i) => [i, f])),
  } as unknown as FileList;
  return {
    preventDefault: jest.fn(),
    dataTransfer: { files: fileList, types: ['Files'] },
  };
}

describe('useDropzone', () => {
  it('starts with dragging=false', () => {
    const { result } = renderHook(() => useDropzone(jest.fn()));
    expect(result.current.dragging).toBe(false);
  });

  it('sets dragging=true on dragEnter', () => {
    const { result } = renderHook(() => useDropzone(jest.fn()));
    act(() => {
      result.current.handlers.onDragEnter(makeDragEvent([]) as never);
    });
    expect(result.current.dragging).toBe(true);
  });

  it('calls onFilesDrop with accepted video + subtitle files on drop', () => {
    const onFilesDrop = jest.fn();
    const { result } = renderHook(() => useDropzone(onFilesDrop));
    const video = new File(['x'], 'movie.mp4', { type: 'video/mp4' });
    const sub = new File(['s'], 'movie.en.srt', { type: 'text/plain' });
    act(() => {
      result.current.handlers.onDrop(makeDragEvent([video, sub]) as never);
    });
    expect(onFilesDrop).toHaveBeenCalledTimes(1);
    expect(onFilesDrop).toHaveBeenCalledWith([video, sub]);
  });

  it('filters out non-video/non-subtitle files', () => {
    const onFilesDrop = jest.fn();
    const { result } = renderHook(() => useDropzone(onFilesDrop));
    const txt = new File(['hi'], 'notes.txt', { type: 'text/plain' });
    act(() => {
      result.current.handlers.onDrop(makeDragEvent([txt]) as never);
    });
    expect(onFilesDrop).not.toHaveBeenCalled();
  });

  it('resets dragging=false after drop', () => {
    const { result } = renderHook(() => useDropzone(jest.fn()));
    act(() => {
      result.current.handlers.onDragEnter(makeDragEvent([]) as never);
    });
    expect(result.current.dragging).toBe(true);
    act(() => {
      result.current.handlers.onDrop(makeDragEvent([new File([], 'x.mp4')]) as never);
    });
    expect(result.current.dragging).toBe(false);
  });

  it('counter pattern: dragging stays true across nested dragEnter/dragLeave', () => {
    const { result } = renderHook(() => useDropzone(jest.fn()));
    // Enter parent, then enter child (nested), then leave child — still inside.
    act(() => {
      result.current.handlers.onDragEnter(makeDragEvent([]) as never);
      result.current.handlers.onDragEnter(makeDragEvent([]) as never);
      result.current.handlers.onDragLeave(makeDragEvent([]) as never);
    });
    expect(result.current.dragging).toBe(true);
    // Leave parent — now fully outside.
    act(() => {
      result.current.handlers.onDragLeave(makeDragEvent([]) as never);
    });
    expect(result.current.dragging).toBe(false);
  });

  it('does not go negative on extra dragLeave (clamped at 0)', () => {
    const { result } = renderHook(() => useDropzone(jest.fn()));
    act(() => {
      result.current.handlers.onDragLeave(makeDragEvent([]) as never);
      result.current.handlers.onDragLeave(makeDragEvent([]) as never);
    });
    expect(result.current.dragging).toBe(false);
    // Subsequent enter still works.
    act(() => {
      result.current.handlers.onDragEnter(makeDragEvent([]) as never);
    });
    expect(result.current.dragging).toBe(true);
  });

  it('calls preventDefault on dragOver (required to allow drop)', () => {
    const { result } = renderHook(() => useDropzone(jest.fn()));
    const evt = makeDragEvent([]);
    act(() => {
      result.current.handlers.onDragOver(evt as never);
    });
    expect((evt as { preventDefault: jest.Mock }).preventDefault).toHaveBeenCalled();
  });
});
