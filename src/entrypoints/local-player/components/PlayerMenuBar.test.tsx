import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerMenuBar } from './PlayerMenuBar';

const baseProps = {
  filename: null as string | null,
  isLibraryOpen: false,
  onOpenFile: jest.fn(),
  onOpenFolder: jest.fn(),
  onToggleLibrary: jest.fn(),
};

describe('PlayerMenuBar', () => {
  it('renders the app title', () => {
    render(<PlayerMenuBar {...baseProps} />);
    expect(screen.getByText('Local Player')).toBeInTheDocument();
  });

  it('renders "No file loaded" when no video is loaded', () => {
    render(<PlayerMenuBar {...baseProps} />);
    expect(screen.getByText('No file loaded')).toBeInTheDocument();
  });

  it('renders the filename when a video is loaded', () => {
    render(<PlayerMenuBar {...baseProps} filename="movie.mp4" />);
    expect(screen.getByText('movie.mp4')).toBeInTheDocument();
    expect(screen.queryByText('No file loaded')).not.toBeInTheDocument();
  });

  it('renders an "Open file" button that calls onOpenFile', () => {
    const onOpenFile = jest.fn();
    render(<PlayerMenuBar {...baseProps} onOpenFile={onOpenFile} />);
    const btn = screen.getByRole('button', { name: /open file/i });
    fireEvent.click(btn);
    expect(onOpenFile).toHaveBeenCalledTimes(1);
  });

  it('renders an "Open folder" button that calls onOpenFolder', () => {
    const onOpenFolder = jest.fn();
    render(<PlayerMenuBar {...baseProps} onOpenFolder={onOpenFolder} />);
    const btn = screen.getByRole('button', { name: /open folder/i });
    fireEvent.click(btn);
    expect(onOpenFolder).toHaveBeenCalledTimes(1);
  });

  it('renders the open pill group with File + Folder buttons', () => {
    render(<PlayerMenuBar {...baseProps} />);
    expect(screen.getByRole('group', { name: /open media/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open file/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open folder/i })).toBeInTheDocument();
  });

  it('renders a "Library" button that calls onToggleLibrary', () => {
    const onToggleLibrary = jest.fn();
    render(<PlayerMenuBar {...baseProps} onToggleLibrary={onToggleLibrary} />);
    const btn = screen.getByRole('button', { name: /library/i });
    fireEvent.click(btn);
    expect(onToggleLibrary).toHaveBeenCalledTimes(1);
  });

  it('marks the Library button as pressed when library is open', () => {
    render(<PlayerMenuBar {...baseProps} isLibraryOpen={true} />);
    const btn = screen.getByRole('button', { name: /library/i });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks the Library button as not pressed when library is closed', () => {
    render(<PlayerMenuBar {...baseProps} isLibraryOpen={false} />);
    const btn = screen.getByRole('button', { name: /library/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });
});
