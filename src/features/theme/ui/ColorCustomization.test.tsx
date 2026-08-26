import { render, screen, fireEvent, act } from '@testing-library/react';
import { ColorCustomization } from '@/features/theme/ui/ColorCustomization';
import { DEFAULT_THEME_CONFIG } from '@/features/theme/logic/themeConfig';

jest.useFakeTimers();

describe('ColorCustomization', () => {
  it('renders 9 color pickers', () => {
    render(<ColorCustomization config={DEFAULT_THEME_CONFIG} onColorChange={jest.fn()} />);
    expect(screen.getByTestId('color-picker-primary')).toBeInTheDocument();
    expect(screen.getByTestId('color-picker-background')).toBeInTheDocument();
    expect(screen.getByTestId('color-picker-surface')).toBeInTheDocument();
    expect(screen.getByTestId('color-picker-text')).toBeInTheDocument();
    expect(screen.getByTestId('color-picker-textSecondary')).toBeInTheDocument();
    expect(screen.getByTestId('color-picker-border')).toBeInTheDocument();
    expect(screen.getByTestId('color-picker-success')).toBeInTheDocument();
    expect(screen.getByTestId('color-picker-warning')).toBeInTheDocument();
    expect(screen.getByTestId('color-picker-error')).toBeInTheDocument();
  });

  it('renders light + dark tabs', () => {
    render(<ColorCustomization config={DEFAULT_THEME_CONFIG} onColorChange={jest.fn()} />);
    expect(screen.getByTestId('color-tab-light')).toBeInTheDocument();
    expect(screen.getByTestId('color-tab-dark')).toBeInTheDocument();
  });

  it('switching tab changes visible colors', () => {
    render(<ColorCustomization config={DEFAULT_THEME_CONFIG} onColorChange={jest.fn()} />);
    // Dark tab default
    expect((screen.getByTestId('color-picker-primary') as HTMLInputElement).value).toBe(DEFAULT_THEME_CONFIG.customColors.dark.primary.toLowerCase());
    fireEvent.click(screen.getByTestId('color-tab-light'));
    // Light tab
    expect((screen.getByTestId('color-picker-primary') as HTMLInputElement).value).toBe(DEFAULT_THEME_CONFIG.customColors.light.primary.toLowerCase());
  });

  it('debounces onColorChange 300ms', () => {
    const onColorChange = jest.fn();
    render(<ColorCustomization config={DEFAULT_THEME_CONFIG} onColorChange={onColorChange} />);
    fireEvent.change(screen.getByTestId('color-picker-primary'), { target: { value: '#ff0000' } });
    // Not called immediately.
    expect(onColorChange).not.toHaveBeenCalled();
    // After 300ms.
    act(() => { jest.advanceTimersByTime(300); });
    expect(onColorChange).toHaveBeenCalledWith('dark', 'primary', '#ff0000');
  });

  it('coalesces rapid changes (only last fires)', () => {
    const onColorChange = jest.fn();
    render(<ColorCustomization config={DEFAULT_THEME_CONFIG} onColorChange={onColorChange} />);
    fireEvent.change(screen.getByTestId('color-picker-primary'), { target: { value: '#ff0000' } });
    fireEvent.change(screen.getByTestId('color-picker-primary'), { target: { value: '#00ff00' } });
    fireEvent.change(screen.getByTestId('color-picker-primary'), { target: { value: '#0000ff' } });
    act(() => { jest.advanceTimersByTime(300); });
    expect(onColorChange).toHaveBeenCalledTimes(1);
    expect(onColorChange).toHaveBeenCalledWith('dark', 'primary', '#0000ff');
  });
});
