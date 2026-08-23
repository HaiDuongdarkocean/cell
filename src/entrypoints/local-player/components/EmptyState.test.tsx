import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders an "Add files" button', () => {
    render(<EmptyState onOpenFile={jest.fn()} onOpenFolder={jest.fn()} />);
    expect(screen.getByRole('button', { name: /add files/i })).toBeInTheDocument();
  });

  it('renders an "Add folder" button', () => {
    render(<EmptyState onOpenFile={jest.fn()} onOpenFolder={jest.fn()} />);
    expect(screen.getByRole('button', { name: /add folder/i })).toBeInTheDocument();
  });

  it('renders dropzone hint text', () => {
    render(<EmptyState onOpenFile={jest.fn()} onOpenFolder={jest.fn()} />);
    expect(
      screen.getByText(/drop your video and subtitles here/i),
    ).toBeInTheDocument();
  });

  it('calls onOpenFile when the "Add files" button is clicked', () => {
    const onOpenFile = jest.fn();
    render(<EmptyState onOpenFile={onOpenFile} onOpenFolder={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /add files/i }));
    expect(onOpenFile).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenFolder when the "Add folder" button is clicked', () => {
    const onOpenFolder = jest.fn();
    render(<EmptyState onOpenFile={jest.fn()} onOpenFolder={onOpenFolder} />);
    fireEvent.click(screen.getByRole('button', { name: /add folder/i }));
    expect(onOpenFolder).toHaveBeenCalledTimes(1);
  });

  // Note: drag-and-drop tests moved to useDropzone.test.ts + PlayerView.test.tsx
  // — drop logic now lives on the video stage (useDropzone), not EmptyState.
});
