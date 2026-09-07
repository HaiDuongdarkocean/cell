import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { WordBadgeSettingsPanel } from '@/features/settings/ui/WordBadgeSettingsPanel';
import type { BadgePointerTriggerSettings } from '@/entities/settings';

function makeProps(overrides: Partial<BadgePointerTriggerSettings> = {}) {
  const badgePointerTrigger: BadgePointerTriggerSettings = { position: 'center', size: 36, pointerScale: 0.25, ...overrides };
  return {
    badgePointerTrigger,
    onChange: jest.fn(),
  };
}

describe('WordBadgeSettingsPanel', () => {
  it('calls onChange with selected pointer position', () => {
    const props = makeProps({ position: 'center' });
    render(<WordBadgeSettingsPanel {...props} />);
    fireEvent.click(screen.getByLabelText(/Pointer position/i));
    fireEvent.click(screen.getByRole('option', { name: 'Pointer left' }));
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ position: 'left' }),
    );
  });

  it('calls onChange with new button size', () => {
    const props = makeProps({ size: 36 });
    render(<WordBadgeSettingsPanel {...props} />);
    const slider = screen.getByLabelText(/Button size/i) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '48' } });
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ size: 48 }),
    );
  });

  it('calls onChange with new pointer scale', () => {
    const props = makeProps({ pointerScale: 0.25 });
    render(<WordBadgeSettingsPanel {...props} />);
    const slider = screen.getByLabelText(/Pointer scale/i) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '0.4' } });
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ pointerScale: 0.4 }),
    );
  });
});
