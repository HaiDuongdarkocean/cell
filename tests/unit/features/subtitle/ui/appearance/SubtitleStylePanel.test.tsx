import { render, screen, fireEvent } from '@testing-library/react';
import { SubtitleStylePanel } from '@/features/subtitle/ui/appearance/SubtitleStylePanel';
import { DEFAULT_OVERLAY_STYLE_TARGET } from '@/shared/config/config';

describe('SubtitleStylePanel', () => {
  const defaultProps = {
    role: 'target' as const,
    style: DEFAULT_OVERLAY_STYLE_TARGET,
    onChange: jest.fn(),
    onReset: jest.fn(),
    defaultStyle: DEFAULT_OVERLAY_STYLE_TARGET,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders panel with role data-cell-id', () => {
    render(<SubtitleStylePanel {...defaultProps} />);
    expect(screen.getByTestId('subtitle-style-panel-target')).toBeTruthy();
  });

  it('renders font size slider with current value', () => {
    render(<SubtitleStylePanel {...defaultProps} />);
    const slider = screen.getByLabelText(/Font size/) as HTMLInputElement;
    expect(slider.value).toBe(String(DEFAULT_OVERLAY_STYLE_TARGET.fontSize));
  });

  it('calls onChange with fontSize when slider changes', () => {
    render(<SubtitleStylePanel {...defaultProps} />);
    const slider = screen.getByLabelText(/Font size/) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '32' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith({ fontSize: 32 });
  });

  it('calls onChange with textColor when color input changes', () => {
    render(<SubtitleStylePanel {...defaultProps} />);
    const input = screen.getByLabelText('Text color') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '#ff0000' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith({ textColor: '#ff0000' });
  });

  it('calls onChange with backgroundOpacity when slider changes', () => {
    render(<SubtitleStylePanel {...defaultProps} />);
    const slider = screen.getByLabelText(/Background opacity/) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '0.5' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith({ backgroundOpacity: 0.5 });
  });

  it('calls onChange with textShadow preset when radio changes', () => {
    render(<SubtitleStylePanel {...defaultProps} />);
    const cinemaRadio = screen.getByLabelText('Cinema shadow') as HTMLInputElement;
    fireEvent.click(cinemaRadio);
    expect(defaultProps.onChange).toHaveBeenCalledWith({
      textShadow: { ...DEFAULT_OVERLAY_STYLE_TARGET.textShadow, preset: 'cinema' },
    });
  });

  it('shows custom shadow fields only when preset=custom', () => {
    const { rerender } = render(<SubtitleStylePanel {...defaultProps} />);
    expect(screen.queryByLabelText('Shadow color')).toBeNull();
    rerender(
      <SubtitleStylePanel
        {...defaultProps}
        style={{ ...DEFAULT_OVERLAY_STYLE_TARGET, textShadow: { ...DEFAULT_OVERLAY_STYLE_TARGET.textShadow, preset: 'custom' } }}
      />,
    );
    expect(screen.getByLabelText('Shadow color')).toBeTruthy();
  });

  it('calls onChange with horizontalAlign when radio changes', () => {
    render(<SubtitleStylePanel {...defaultProps} />);
    const leftRadio = screen.getByLabelText('Align left') as HTMLInputElement;
    fireEvent.click(leftRadio);
    expect(defaultProps.onChange).toHaveBeenCalledWith({ horizontalAlign: 'left' });
  });

  // ADR-025: yOffsetPercent moved to SubtitleBlockSettingsPanel (Block section).
  // ADR-025: visible toggle moved to SettingsDialog section header (Block/Target/Native cards).

  it('calls onReset when reset confirmed', () => {
    render(<SubtitleStylePanel {...defaultProps} />);
    const resetBtn = screen.getByTestId('style-target-reset');
    fireEvent.click(resetBtn);
    const confirmBtn = screen.getByText('Yes, reset');
    fireEvent.click(confirmBtn);
    expect(defaultProps.onReset).toHaveBeenCalled();
  });

  it('does not call onReset when reset cancelled', () => {
    render(<SubtitleStylePanel {...defaultProps} />);
    const resetBtn = screen.getByTestId('style-target-reset');
    fireEvent.click(resetBtn);
    const cancelBtn = screen.getByText('Cancel');
    fireEvent.click(cancelBtn);
    expect(defaultProps.onReset).not.toHaveBeenCalled();
  });
});
