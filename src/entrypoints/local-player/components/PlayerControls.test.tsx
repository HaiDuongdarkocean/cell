import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerControls } from './PlayerControls';

const defaultProps = {
  isPlaying: false,
  currentTime: 30,
  duration: 120,
  volume: 0.8,
  muted: false,
  playbackRate: 1,
  buffered: 60,
  onPlayPause: jest.fn(),
  onSeek: jest.fn(),
  onVolumeChange: jest.fn(),
  onMuteToggle: jest.fn(),
  onSpeedChange: jest.fn(),
  onToggleFullscreen: jest.fn(),
  onTogglePiP: jest.fn(),
  onSkip: jest.fn(),
};

describe('PlayerControls', () => {
  it('renders the control bar root', () => {
    const { container } = render(<PlayerControls {...defaultProps} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders PlayPauseButton (aria-label "Play" when paused)', () => {
    render(<PlayerControls {...defaultProps} isPlaying={false} />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('renders PlayPauseButton (aria-label "Pause" when playing)', () => {
    render(<PlayerControls {...defaultProps} isPlaying={true} />);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('renders Timeline (role=slider aria-label "Seek") with currentTime + duration', () => {
    render(<PlayerControls {...defaultProps} />);
    const timeline = screen.getByRole('slider', { name: 'Seek' });
    expect(timeline).toHaveAttribute('aria-valuenow', '30');
    expect(timeline).toHaveAttribute('aria-valuemax', '120');
  });

  it('renders VolumeControl mute button + volume slider', () => {
    render(<PlayerControls {...defaultProps} muted={false} />);
    expect(screen.getByRole('button', { name: 'Mute' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Volume' })).toBeInTheDocument();
  });

  it('renders VolumeControl mute button as "Unmute" when muted', () => {
    render(<PlayerControls {...defaultProps} muted={true} />);
    expect(screen.getByRole('button', { name: 'Unmute' })).toBeInTheDocument();
  });

  it('renders FullscreenButton (aria-label "Enter fullscreen")', () => {
    render(<PlayerControls {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: 'Enter fullscreen' }),
    ).toBeInTheDocument();
  });

  it('renders FullscreenButton (aria-label "Exit fullscreen") when fullscreen', () => {
    render(<PlayerControls {...defaultProps} isFullscreen={true} />);
    expect(
      screen.getByRole('button', { name: 'Exit fullscreen' }),
    ).toBeInTheDocument();
  });

  it('renders PiPButton (aria-label "Enter picture-in-picture")', () => {
    render(<PlayerControls {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: 'Enter picture-in-picture' }),
    ).toBeInTheDocument();
  });

  it('renders PiPButton (aria-label "Exit picture-in-picture") when pip active', () => {
    render(<PlayerControls {...defaultProps} isPiP={true} />);
    expect(
      screen.getByRole('button', { name: 'Exit picture-in-picture' }),
    ).toBeInTheDocument();
  });

  it('renders SkipButton forward + backward', () => {
    render(<PlayerControls {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: 'Skip forward 10 seconds' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Skip backward 10 seconds' }),
    ).toBeInTheDocument();
  });

  it('renders TimeDisplay (role=timer) with current / total', () => {
    render(<PlayerControls {...defaultProps} currentTime={30} duration={120} />);
    const timer = screen.getByRole('timer');
    expect(timer).toHaveTextContent('0:30 / 2:00');
  });

  it('calls onPlayPause when play/pause button clicked', () => {
    const onPlayPause = jest.fn();
    render(<PlayerControls {...defaultProps} onPlayPause={onPlayPause} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(onPlayPause).toHaveBeenCalledTimes(1);
  });

  it('calls onSeek when Timeline ArrowRight pressed', () => {
    const onSeek = jest.fn();
    render(<PlayerControls {...defaultProps} onSeek={onSeek} />);
    const timeline = screen.getByRole('slider', { name: 'Seek' });
    fireEvent.keyDown(timeline, { key: 'ArrowRight' });
    expect(onSeek).toHaveBeenCalledWith(35);
  });

  it('calls onVolumeChange when Volume slider ArrowRight pressed', () => {
    const onVolumeChange = jest.fn();
    render(
      <PlayerControls
        {...defaultProps}
        volume={0.5}
        onVolumeChange={onVolumeChange}
      />,
    );
    const slider = screen.getByRole('slider', { name: 'Volume' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onVolumeChange).toHaveBeenCalledWith(expect.any(Number));
  });

  it('calls onMuteToggle when mute button clicked', () => {
    const onMuteToggle = jest.fn();
    render(<PlayerControls {...defaultProps} onMuteToggle={onMuteToggle} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
    expect(onMuteToggle).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleFullscreen when fullscreen button clicked', () => {
    const onToggleFullscreen = jest.fn();
    render(
      <PlayerControls {...defaultProps} onToggleFullscreen={onToggleFullscreen} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Enter fullscreen' }));
    expect(onToggleFullscreen).toHaveBeenCalledTimes(1);
  });

  it('calls onTogglePiP when PiP button clicked', () => {
    const onTogglePiP = jest.fn();
    render(<PlayerControls {...defaultProps} onTogglePiP={onTogglePiP} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Enter picture-in-picture' }),
    );
    expect(onTogglePiP).toHaveBeenCalledTimes(1);
  });

  it('calls onSkip("forward", 10) when forward skip button clicked', () => {
    const onSkip = jest.fn();
    render(<PlayerControls {...defaultProps} onSkip={onSkip} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip forward 10 seconds' }));
    expect(onSkip).toHaveBeenCalledWith('forward', 10);
  });

  it('calls onSkip("backward", 10) when backward skip button clicked', () => {
    const onSkip = jest.fn();
    render(<PlayerControls {...defaultProps} onSkip={onSkip} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Skip backward 10 seconds' }),
    );
    expect(onSkip).toHaveBeenCalledWith('backward', 10);
  });

  it('is hidden when isHidden=true', () => {
    const { container } = render(
      <PlayerControls {...defaultProps} isHidden={true} />,
    );
    expect(container.firstChild).not.toBeVisible();
  });

  it('is visible when isHidden is false/omitted', () => {
    const { container } = render(<PlayerControls {...defaultProps} />);
    expect(container.firstChild).toBeVisible();
  });

  it('does not render Settings button when hasMultipleTracks is false', () => {
    render(<PlayerControls {...defaultProps} />);
    expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('renders Settings button when hasMultipleTracks + onToggleTrackSelector provided', () => {
    render(
      <PlayerControls
        {...defaultProps}
        hasMultipleTracks={true}
        onToggleTrackSelector={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  it('opens settings menu and shows speed control + tracks item on click', () => {
    const onToggleTrackSelector = jest.fn();
    render(
      <PlayerControls
        {...defaultProps}
        hasMultipleTracks={true}
        onToggleTrackSelector={onToggleTrackSelector}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /playback speed 1x/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /tracks/i })).toBeInTheDocument();
  });

  it('calls onToggleTrackSelector when Tracks menu item clicked', () => {
    const onToggleTrackSelector = jest.fn();
    render(
      <PlayerControls
        {...defaultProps}
        hasMultipleTracks={true}
        onToggleTrackSelector={onToggleTrackSelector}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /tracks/i }));
    expect(onToggleTrackSelector).toHaveBeenCalledTimes(1);
  });

  it('calls onSpeedChange when a speed menu item is picked from settings popover', () => {
    const onSpeedChange = jest.fn();
    render(
      <PlayerControls
        {...defaultProps}
        playbackRate={1}
        onSpeedChange={onSpeedChange}
        hasMultipleTracks={true}
        onToggleTrackSelector={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: /playback speed 1x/i }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /1\.5x/i }));
    expect(onSpeedChange).toHaveBeenCalledWith(1.5);
  });

  it('renders CaptionsButton when onToggleCaptions provided', () => {
    render(
      <PlayerControls
        {...defaultProps}
        captionsOn={false}
        captionsAvailable={true}
        onToggleCaptions={jest.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /captions/i })).toBeInTheDocument();
  });
});
