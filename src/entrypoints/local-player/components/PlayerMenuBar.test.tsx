import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerMenuBar } from './PlayerMenuBar';

describe('PlayerMenuBar', () => {
  it('renders the app title', () => {
    render(
      <PlayerMenuBar
        filename={null}
        isLibraryOpen={false}
        onOpenFile={jest.fn()}
        onToggleLibrary={jest.fn()}
      />,
    );
    expect(screen.getByText('Local Player')).toBeInTheDocument();
  });

  it('renders "No file loaded" when no video is loaded', () => {
    render(
      <PlayerMenuBar
        filename={null}
        isLibraryOpen={false}
        onOpenFile={jest.fn()}
        onToggleLibrary={jest.fn()}
      />,
    );
    expect(screen.getByText('No file loaded')).toBeInTheDocument();
  });

  it('renders the filename when a video is loaded', () => {
    render(
      <PlayerMenuBar
        filename="movie.mp4"
        isLibraryOpen={false}
        onOpenFile={jest.fn()}
        onToggleLibrary={jest.fn()}
      />,
    );
    expect(screen.getByText('movie.mp4')).toBeInTheDocument();
    expect(screen.queryByText('No file loaded')).not.toBeInTheDocument();
  });

  it('renders an "Open file" button that calls onOpenFile', () => {
    const onOpenFile = jest.fn();
    render(
      <PlayerMenuBar
        filename={null}
        isLibraryOpen={false}
        onOpenFile={onOpenFile}
        onToggleLibrary={jest.fn()}
      />,
    );
    const btn = screen.getByRole('button', { name: /open file/i });
    fireEvent.click(btn);
    expect(onOpenFile).toHaveBeenCalledTimes(1);
  });

  it('renders a "Library" button that calls onToggleLibrary', () => {
    const onToggleLibrary = jest.fn();
    render(
      <PlayerMenuBar
        filename={null}
        isLibraryOpen={false}
        onOpenFile={jest.fn()}
        onToggleLibrary={onToggleLibrary}
      />,
    );
    const btn = screen.getByRole('button', { name: /library/i });
    fireEvent.click(btn);
    expect(onToggleLibrary).toHaveBeenCalledTimes(1);
  });

  it('marks the Library button as pressed when library is open', () => {
    render(
      <PlayerMenuBar
        filename={null}
        isLibraryOpen={true}
        onOpenFile={jest.fn()}
        onToggleLibrary={jest.fn()}
      />,
    );
    const btn = screen.getByRole('button', { name: /library/i });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks the Library button as not pressed when library is closed', () => {
    render(
      <PlayerMenuBar
        filename={null}
        isLibraryOpen={false}
        onOpenFile={jest.fn()}
        onToggleLibrary={jest.fn()}
      />,
    );
    const btn = screen.getByRole('button', { name: /library/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });
});
