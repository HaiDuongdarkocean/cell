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
    expect(screen.getByRole('heading', { name: /keyboard shortcuts/i, level: 4 })).toBeInTheDocument();
  });

  it('renders input field for each shortcut action (incl. play-pause)', () => {
    render(
      <SettingsDialog
        isOpen={true}
        settings={makeSettings()}
        onChange={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByTestId('shortcut-prev-cue')).toBeInTheDocument();
    expect(screen.getByTestId('shortcut-next-cue')).toBeInTheDocument();
    expect(screen.getByTestId('shortcut-replay-cue')).toBeInTheDocument();
    expect(screen.getByTestId('shortcut-play-pause')).toBeInTheDocument();
    expect(screen.getByTestId('shortcut-toggle-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('shortcut-toggle-panel')).toBeInTheDocument();
    expect(screen.getByTestId('shortcut-toggle-translate')).toBeInTheDocument();
  });

  it('displays current key values from settings (pill text content)', () => {
    render(
      <SettingsDialog
        isOpen={true}
        settings={makeSettings()}
        onChange={noop}
        onClose={noop}
      />,
    );
    // ADR-021 D7: ShortcutInput is now a pill (role=button), not a textbox.
    // Single-char shows uppercase; combo shows modifier + key chips.
    expect(screen.getByTestId('shortcut-prev-cue').textContent).toBe('A');
    expect(screen.getByTestId('shortcut-next-cue').textContent).toBe('D');
    expect(screen.getByTestId('shortcut-replay-cue').textContent).toBe('S');
    expect(screen.getByTestId('shortcut-toggle-overlay').textContent).toBe('W');
    expect(screen.getByTestId('shortcut-toggle-panel').textContent).toBe('T');
    // toggle-translate = Ctrl+Shift+T combo
    const translatePill = screen.getByTestId('shortcut-toggle-translate');
    expect(translatePill.textContent).toContain('Ctrl');
    expect(translatePill.textContent).toContain('Shift');
    expect(translatePill.textContent).toContain('T');
  });

  it('calls onChange with updated key when user presses a key', () => {
    const onChange = jest.fn();
    render(
      <SettingsDialog
        isOpen={true}
        settings={makeSettings()}
        onChange={onChange}
        onClose={noop}
      />,
    );
    const pill = screen.getByTestId('shortcut-prev-cue');
    pill.focus();
    fireEvent.keyDown(pill, { key: 'q' });
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
    const pill = screen.getByTestId('shortcut-next-cue');
    pill.focus();
    fireEvent.keyDown(pill, { key: 'E' });
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
    expect(screen.getByText(/play \/ pause video/i)).toBeInTheDocument();
    expect(screen.getByText(/toggle overlay/i)).toBeInTheDocument();
    expect(screen.getByText(/toggle panel/i)).toBeInTheDocument();
    expect(screen.getByText(/toggle auto-translate/i)).toBeInTheDocument();
  });
});
