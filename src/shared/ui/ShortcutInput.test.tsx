import { render, screen, fireEvent } from '@testing-library/react';
import { ShortcutInput } from '@/shared/ui/ShortcutInput';

describe('ShortcutInput atom — ADR-021 D7 combo support', () => {
  describe('single-char mode (backward compat)', () => {
    it('renders pill with uppercase single char', () => {
      render(<ShortcutInput value={{ key: 'a' }} onChange={() => {}} aria-label="Previous cue" />);
      const pill = screen.getByRole('button', { name: 'Previous cue' });
      expect(pill).toBeInTheDocument();
      expect(pill.textContent).toBe('A');
    });

    it('renders arrow keys with display labels', () => {
      render(<ShortcutInput value={{ key: 'arrowleft' }} onChange={() => {}} aria-label="Previous cue" />);
      const pill = screen.getByRole('button', { name: 'Previous cue' });
      expect(pill.textContent).toContain('←');
    });

    it('requires aria-label', () => {
      render(<ShortcutInput value={{ key: 'a' }} onChange={() => {}} aria-label="Next cue" />);
      expect(screen.getByRole('button', { name: 'Next cue' })).toHaveAttribute('aria-label', 'Next cue');
    });

    it('forwards data-testid', () => {
      render(<ShortcutInput value={{ key: 'a' }} onChange={() => {}} aria-label="Test" data-testid="shortcut-prev-cue" />);
      expect(screen.getByTestId('shortcut-prev-cue')).toBeInTheDocument();
    });

    it('forwards id', () => {
      render(<ShortcutInput value={{ key: 'a' }} onChange={() => {}} aria-label="Test" id="set-shortcut-prev-cue" />);
      expect(screen.getByRole('button', { name: 'Test' })).toHaveAttribute('id', 'set-shortcut-prev-cue');
    });
  });

  describe('combo mode (Ctrl+Shift+T)', () => {
    it('renders modifier chips + key chip for combo', () => {
      render(
        <ShortcutInput
          value={{ key: 't', ctrl: true, shift: true }}
          onChange={() => {}}
          aria-label="Toggle auto-translate"
        />,
      );
      const pill = screen.getByRole('button', { name: 'Toggle auto-translate' });
      expect(pill.textContent).toContain('Ctrl');
      expect(pill.textContent).toContain('Shift');
      expect(pill.textContent).toContain('T');
    });

    it('renders only ctrl modifier when only ctrl set', () => {
      render(
        <ShortcutInput
          value={{ key: 's', ctrl: true }}
          onChange={() => {}}
          aria-label="Save"
        />,
      );
      const pill = screen.getByRole('button', { name: 'Save' });
      expect(pill.textContent).toContain('Ctrl');
      expect(pill.textContent).not.toContain('Shift');
      expect(pill.textContent).toContain('S');
    });
  });

  describe('keydown capture', () => {
    it('captures single key press and calls onChange', () => {
      const onChange = jest.fn();
      render(<ShortcutInput value={{ key: 'a' }} onChange={onChange} aria-label="Test" />);
      const pill = screen.getByRole('button', { name: 'Test' });
      pill.focus();
      fireEvent.keyDown(pill, { key: 'R' });
      expect(onChange).toHaveBeenCalledWith({ key: 'r', ctrl: undefined, shift: undefined, alt: undefined });
    });

    it('captures combo key press (Ctrl+Shift+T) and calls onChange', () => {
      const onChange = jest.fn();
      render(<ShortcutInput value={{ key: 'a' }} onChange={onChange} aria-label="Test" />);
      const pill = screen.getByRole('button', { name: 'Test' });
      pill.focus();
      fireEvent.keyDown(pill, { key: 't', ctrlKey: true, shiftKey: true });
      expect(onChange).toHaveBeenCalledWith({ key: 't', ctrl: true, shift: true, alt: undefined });
    });

    it('ignores pure modifier key presses (Shift alone)', () => {
      const onChange = jest.fn();
      render(<ShortcutInput value={{ key: 'a' }} onChange={onChange} aria-label="Test" />);
      const pill = screen.getByRole('button', { name: 'Test' });
      pill.focus();
      fireEvent.keyDown(pill, { key: 'Shift' });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('ignores pure Ctrl key press', () => {
      const onChange = jest.fn();
      render(<ShortcutInput value={{ key: 'a' }} onChange={onChange} aria-label="Test" />);
      const pill = screen.getByRole('button', { name: 'Test' });
      pill.focus();
      fireEvent.keyDown(pill, { key: 'Control' });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('normalizes arrow key press', () => {
      const onChange = jest.fn();
      render(<ShortcutInput value={{ key: 'a' }} onChange={onChange} aria-label="Test" />);
      const pill = screen.getByRole('button', { name: 'Test' });
      pill.focus();
      fireEvent.keyDown(pill, { key: 'ArrowLeft' });
      expect(onChange).toHaveBeenCalledWith({ key: 'arrowleft', ctrl: undefined, shift: undefined, alt: undefined });
    });
  });
});
