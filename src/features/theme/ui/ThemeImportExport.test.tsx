import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeImportExport, isValidThemeConfig } from '@/features/theme/ui/ThemeImportExport';
import { DEFAULT_THEME_CONFIG } from '@/features/theme/logic/themeConfig';
import type { ThemeConfig } from '@/entities/theme';

describe('isValidThemeConfig', () => {
  it('validates correct ThemeConfig', () => {
    expect(isValidThemeConfig(DEFAULT_THEME_CONFIG)).toBe(true);
  });
  it('rejects null', () => {
    expect(isValidThemeConfig(null)).toBe(false);
  });
  it('rejects missing customColors', () => {
    expect(isValidThemeConfig({ foo: 'bar' })).toBe(false);
  });
  it('rejects missing dark', () => {
    expect(isValidThemeConfig({ customColors: { light: DEFAULT_THEME_CONFIG.customColors.light } })).toBe(false);
  });
  it('rejects missing token', () => {
    const bad = { customColors: { light: { ...DEFAULT_THEME_CONFIG.customColors.light, primary: undefined }, dark: DEFAULT_THEME_CONFIG.customColors.dark } };
    expect(isValidThemeConfig(bad)).toBe(false);
  });
});

describe('ThemeImportExport', () => {
  it('renders export/copy/import buttons', () => {
    render(<ThemeImportExport config={DEFAULT_THEME_CONFIG} onApply={jest.fn()} />);
    expect(screen.getByTestId('theme-export')).toBeInTheDocument();
    expect(screen.getByTestId('theme-copy')).toBeInTheDocument();
    expect(screen.getByTestId('theme-import-file')).toBeInTheDocument();
  });

  it('renders paste textarea + apply button', () => {
    render(<ThemeImportExport config={DEFAULT_THEME_CONFIG} onApply={jest.fn()} />);
    expect(screen.getByTestId('theme-paste-textarea')).toBeInTheDocument();
    expect(screen.getByTestId('theme-apply-paste')).toBeInTheDocument();
  });

  it('apply valid JSON calls onApply + shows success', async () => {
    const onApply = jest.fn();
    render(<ThemeImportExport config={DEFAULT_THEME_CONFIG} onApply={onApply} />);
    const textarea = screen.getByTestId('theme-paste-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: JSON.stringify(DEFAULT_THEME_CONFIG) } });
    fireEvent.click(screen.getByTestId('theme-apply-paste'));
    await waitFor(() => expect(screen.getByTestId('theme-import-success')).toBeInTheDocument());
    expect(onApply).toHaveBeenCalledWith(DEFAULT_THEME_CONFIG);
  });

  it('apply invalid JSON shows error', async () => {
    const onApply = jest.fn();
    render(<ThemeImportExport config={DEFAULT_THEME_CONFIG} onApply={onApply} />);
    fireEvent.change(screen.getByTestId('theme-paste-textarea'), { target: { value: 'not-json' } });
    fireEvent.click(screen.getByTestId('theme-apply-paste'));
    await waitFor(() => expect(screen.getByTestId('theme-import-error')).toBeInTheDocument());
    expect(onApply).not.toHaveBeenCalled();
  });

  it('apply valid JSON but wrong shape shows error', async () => {
    const onApply = jest.fn();
    render(<ThemeImportExport config={DEFAULT_THEME_CONFIG} onApply={onApply} />);
    fireEvent.change(screen.getByTestId('theme-paste-textarea'), { target: { value: '{"foo":"bar"}' } });
    fireEvent.click(screen.getByTestId('theme-apply-paste'));
    await waitFor(() => expect(screen.getByTestId('theme-import-error')).toBeInTheDocument());
    expect(onApply).not.toHaveBeenCalled();
  });

  it('apply empty shows error', async () => {
    render(<ThemeImportExport config={DEFAULT_THEME_CONFIG} onApply={jest.fn()} />);
    fireEvent.click(screen.getByTestId('theme-apply-paste'));
    await waitFor(() => expect(screen.getByTestId('theme-import-error')).toBeInTheDocument());
  });
});

export type { ThemeConfig };
