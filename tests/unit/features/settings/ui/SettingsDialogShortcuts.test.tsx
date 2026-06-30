import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsDialog } from '@/features/settings/ui/SettingsDialog';
import { DEFAULT_SETTINGS } from '@/shared/config/config';
import type { Settings } from '@/types/media';

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

describe('SettingsDialog — Keyboard Shortcuts section', () => {
  const noop = () => {};

  it('renders shortcuts section with title', () => {
    render(
      <SettingsDialog
        isOpen={true}
        settings={makeSettings()}
        onChange={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByText(/keyboard shortcuts/i)).toBeInTheDocument();
  });

  it('renders input field for each shortcut action', () => {
    render(
      <SettingsDialog
        isOpen={true}
        settings={makeSettings()}
        onChange={noop}
        onClose={noop}
      />,
    );
    // 5 actions: prev-cue, next-cue, replay-cue, toggle-overlay, toggle-panel
    expect(screen.getByTestId('shortcut-prev-cue')).toBeInTheDocument();
    expect(screen.getByTestId('shortcut-next-cue')).toBeInTheDocument();
    expect(screen.getByTestId('shortcut-replay-cue')).toBeInTheDocument();
    expect(screen.getByTestId('shortcut-toggle-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('shortcut-toggle-panel')).toBeInTheDocument();
  });

  it('displays current key values from settings', () => {
    render(
      <SettingsDialog
        isOpen={true}
        settings={makeSettings()}
        onChange={noop}
        onClose={noop}
      />,
    );
    expect((screen.getByTestId('shortcut-prev-cue') as HTMLInputElement).value).toBe('a');
    expect((screen.getByTestId('shortcut-next-cue') as HTMLInputElement).value).toBe('d');
    expect((screen.getByTestId('shortcut-replay-cue') as HTMLInputElement).value).toBe('s');
    expect((screen.getByTestId('shortcut-toggle-overlay') as HTMLInputElement).value).toBe('w');
    expect((screen.getByTestId('shortcut-toggle-panel') as HTMLInputElement).value).toBe('t');
  });

  it('calls onChange with updated key when input changes', () => {
    const onChange = jest.fn();
    render(
      <SettingsDialog
        isOpen={true}
        settings={makeSettings()}
        onChange={onChange}
        onClose={noop}
      />,
    );
    const input = screen.getByTestId('shortcut-prev-cue') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'q' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const newSettings = onChange.mock.calls[0][0] as Settings;
    const prevCue = newSettings.keyboardShortcuts.find((s) => s.action === 'prev-cue');
    expect(prevCue?.key).toBe('q');
  });

  it('normalizes key to lowercase', () => {
    const onChange = jest.fn();
    render(
      <SettingsDialog
        isOpen={true}
        settings={makeSettings()}
        onChange={onChange}
        onClose={noop}
      />,
    );
    const input = screen.getByTestId('shortcut-next-cue') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'E' } });
    const newSettings = onChange.mock.calls[0][0] as Settings;
    const nextCue = newSettings.keyboardShortcuts.find((s) => s.action === 'next-cue');
    expect(nextCue?.key).toBe('e');
  });

  it('displays action labels', () => {
    render(
      <SettingsDialog
        isOpen={true}
        settings={makeSettings()}
        onChange={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByText(/previous cue/i)).toBeInTheDocument();
    expect(screen.getByText(/next cue/i)).toBeInTheDocument();
    expect(screen.getByText(/replay cue/i)).toBeInTheDocument();
    expect(screen.getByText(/toggle overlay/i)).toBeInTheDocument();
    expect(screen.getByText(/toggle panel/i)).toBeInTheDocument();
  });
});
