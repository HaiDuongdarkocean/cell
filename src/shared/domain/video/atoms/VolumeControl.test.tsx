import { render, screen, fireEvent } from '@testing-library/react';
import { VolumeControl } from './VolumeControl';

describe('VolumeControl', () => {
  it('renders mute button and volume slider', () => {
    render(
      <VolumeControl volume={0.5} muted={false} onVolumeChange={jest.fn()} onMuteToggle={jest.fn()} />,
    );
    const slider = screen.getByRole('slider', { name: 'Volume' });
    expect(slider).toHaveAttribute('aria-valuenow', '50');
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '100');
  });

  it('shows "Mute" label and aria-pressed=false when not muted', () => {
    render(
      <VolumeControl volume={0.5} muted={false} onVolumeChange={jest.fn()} onMuteToggle={jest.fn()} />,
    );
    const muteBtn = screen.getByRole('button', { name: 'Mute' });
    expect(muteBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows "Unmute" label and aria-pressed=true when muted', () => {
    render(
      <VolumeControl volume={0.5} muted={true} onVolumeChange={jest.fn()} onMuteToggle={jest.fn()} />,
    );
    const muteBtn = screen.getByRole('button', { name: 'Unmute' });
    expect(muteBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onMuteToggle when mute button clicked', () => {
    const onMuteToggle = jest.fn();
    render(
      <VolumeControl volume={0.5} muted={false} onVolumeChange={jest.fn()} onMuteToggle={onMuteToggle} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
    expect(onMuteToggle).toHaveBeenCalledTimes(1);
  });

  it('increases volume on ArrowRight', () => {
    const onVolumeChange = jest.fn();
    render(
      <VolumeControl volume={0.5} muted={false} onVolumeChange={onVolumeChange} onMuteToggle={jest.fn()} />,
    );
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Volume' }), { key: 'ArrowRight' });
    expect(onVolumeChange).toHaveBeenCalledWith(0.6);
  });

  it('decreases volume on ArrowLeft', () => {
    const onVolumeChange = jest.fn();
    render(
      <VolumeControl volume={0.5} muted={false} onVolumeChange={onVolumeChange} onMuteToggle={jest.fn()} />,
    );
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Volume' }), { key: 'ArrowLeft' });
    expect(onVolumeChange).toHaveBeenCalledWith(0.4);
  });

  it('clamps volume to 1 on End', () => {
    const onVolumeChange = jest.fn();
    render(
      <VolumeControl volume={0.5} muted={false} onVolumeChange={onVolumeChange} onMuteToggle={jest.fn()} />,
    );
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Volume' }), { key: 'End' });
    expect(onVolumeChange).toHaveBeenCalledWith(1);
  });

  it('clamps volume to 0 on Home', () => {
    const onVolumeChange = jest.fn();
    render(
      <VolumeControl volume={0.5} muted={false} onVolumeChange={onVolumeChange} onMuteToggle={jest.fn()} />,
    );
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Volume' }), { key: 'Home' });
    expect(onVolumeChange).toHaveBeenCalledWith(0);
  });

  it('shows aria-valuenow=0 when muted', () => {
    render(
      <VolumeControl volume={0.8} muted={true} onVolumeChange={jest.fn()} onMuteToggle={jest.fn()} />,
    );
    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveAttribute('aria-valuenow', '0');
  });

  it('merges custom className', () => {
    const { container } = render(
      <VolumeControl volume={0.5} muted={false} onVolumeChange={jest.fn()} onMuteToggle={jest.fn()} className="extra" />,
    );
    expect(container.firstChild).toHaveClass('extra');
  });
});
