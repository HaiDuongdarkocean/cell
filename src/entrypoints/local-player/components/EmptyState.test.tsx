import { render, screen, fireEvent, createEvent } from '@testing-library/react';
import { EmptyState } from './EmptyState';

/** Build a fake DragEvent with a DataTransfer carrying the given files. */
function dragEvent(type: string, files: File[]): React.DragEvent<HTMLDivElement> {
  const event = createEvent(type, document.createElement('div'));
  const fileArray = files.map((f, i) => [i, f] as const);
  const fileList = {
    item: (i: number) => files[i],
    length: files.length,
    ...Object.fromEntries(fileArray),
  } as unknown as FileList;
  const dataTransfer = {
    files: fileList,
    types: ['Files'],
    dataTransfer: {},
  };
  (event as unknown as { dataTransfer: typeof dataTransfer }).dataTransfer = dataTransfer;
  return event as unknown as React.DragEvent<HTMLDivElement>;
}

describe('EmptyState', () => {
  it('renders an "Open file" button', () => {
    render(<EmptyState onOpenFile={jest.fn()} onOpenFolder={jest.fn()} onFilesDrop={jest.fn()} />);
    expect(screen.getByRole('button', { name: /open file/i })).toBeInTheDocument();
  });

  it('renders an "Open folder" button', () => {
    render(<EmptyState onOpenFile={jest.fn()} onOpenFolder={jest.fn()} onFilesDrop={jest.fn()} />);
    expect(screen.getByRole('button', { name: /open folder/i })).toBeInTheDocument();
  });

  it('renders dropzone text prompting drag or click', () => {
    render(<EmptyState onOpenFile={jest.fn()} onOpenFolder={jest.fn()} onFilesDrop={jest.fn()} />);
    expect(
      screen.getByText(/drop a video file here or click to browse/i),
    ).toBeInTheDocument();
  });

  it('calls onOpenFile when the "Open file" button is clicked', () => {
    const onOpenFile = jest.fn();
    render(<EmptyState onOpenFile={onOpenFile} onOpenFolder={jest.fn()} onFilesDrop={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /open file/i }));
    expect(onOpenFile).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenFolder when the "Open folder" button is clicked', () => {
    const onOpenFolder = jest.fn();
    render(<EmptyState onOpenFile={jest.fn()} onOpenFolder={onOpenFolder} onFilesDrop={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /open folder/i }));
    expect(onOpenFolder).toHaveBeenCalledTimes(1);
  });

  it('calls onFilesDrop when a video file is dropped', () => {
    const onFilesDrop = jest.fn();
    const { container } = render(
      <EmptyState onOpenFile={jest.fn()} onOpenFolder={jest.fn()} onFilesDrop={onFilesDrop} />,
    );
    const dropzone = container.querySelector('[data-cell-id="empty-dropzone"]') as HTMLDivElement;
    const videoFile = new File(['dummy'], 'movie.mp4', { type: 'video/mp4' });
    fireEvent.drop(dropzone, dragEvent('drop', [videoFile]));
    expect(onFilesDrop).toHaveBeenCalledTimes(1);
    expect(onFilesDrop).toHaveBeenCalledWith([videoFile]);
  });

  it('calls onFilesDrop with both video and subtitle files', () => {
    const onFilesDrop = jest.fn();
    const { container } = render(
      <EmptyState onOpenFile={jest.fn()} onOpenFolder={jest.fn()} onFilesDrop={onFilesDrop} />,
    );
    const dropzone = container.querySelector('[data-cell-id="empty-dropzone"]') as HTMLDivElement;
    const videoFile = new File(['dummy'], 'movie.mp4', { type: 'video/mp4' });
    const subFile = new File(['sub'], 'movie.en.srt', { type: 'text/plain' });
    fireEvent.drop(dropzone, dragEvent('drop', [videoFile, subFile]));
    expect(onFilesDrop).toHaveBeenCalledTimes(1);
    expect(onFilesDrop).toHaveBeenCalledWith([videoFile, subFile]);
  });

  it('calls onFilesDrop with subtitle-only drop', () => {
    const onFilesDrop = jest.fn();
    const { container } = render(
      <EmptyState onOpenFile={jest.fn()} onOpenFolder={jest.fn()} onFilesDrop={onFilesDrop} />,
    );
    const dropzone = container.querySelector('[data-cell-id="empty-dropzone"]') as HTMLDivElement;
    const subFile = new File(['sub'], 'movie.en.srt', { type: 'text/plain' });
    fireEvent.drop(dropzone, dragEvent('drop', [subFile]));
    expect(onFilesDrop).toHaveBeenCalledTimes(1);
    expect(onFilesDrop).toHaveBeenCalledWith([subFile]);
  });

  it('ignores non-video/non-subtitle files dropped', () => {
    const onFilesDrop = jest.fn();
    const { container } = render(
      <EmptyState onOpenFile={jest.fn()} onOpenFolder={jest.fn()} onFilesDrop={onFilesDrop} />,
    );
    const dropzone = container.querySelector('[data-cell-id="empty-dropzone"]') as HTMLDivElement;
    const textFile = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    fireEvent.drop(dropzone, dragEvent('drop', [textFile]));
    expect(onFilesDrop).not.toHaveBeenCalled();
  });

  it('shows visual highlight on drag over', () => {
    const { container } = render(
      <EmptyState onOpenFile={jest.fn()} onOpenFolder={jest.fn()} onFilesDrop={jest.fn()} />,
    );
    const dropzone = container.querySelector('[data-cell-id="empty-dropzone"]') as HTMLDivElement;
    fireEvent.dragEnter(dropzone, dragEvent('dragEnter', []));
    fireEvent.dragOver(dropzone, dragEvent('dragOver', []));
    expect(dropzone).toHaveAttribute('data-dragging', 'true');
  });

  it('removes visual highlight on drag leave', () => {
    const { container } = render(
      <EmptyState onOpenFile={jest.fn()} onOpenFolder={jest.fn()} onFilesDrop={jest.fn()} />,
    );
    const dropzone = container.querySelector('[data-cell-id="empty-dropzone"]') as HTMLDivElement;
    fireEvent.dragEnter(dropzone, dragEvent('dragEnter', []));
    fireEvent.dragOver(dropzone, dragEvent('dragOver', []));
    expect(dropzone).toHaveAttribute('data-dragging', 'true');
    fireEvent.dragLeave(dropzone, dragEvent('dragLeave', []));
    expect(dropzone).toHaveAttribute('data-dragging', 'false');
  });
});
