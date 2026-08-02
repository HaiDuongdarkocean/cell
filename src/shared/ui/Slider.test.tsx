import { render, screen, fireEvent } from '@testing-library/react';
import { Slider } from '@/shared/ui/Slider';

describe('Slider atom — settings-controls-restyle spec F2', () => {
  it('renders range input with min/max/step/value', () => {
    render(<Slider value={48} min={40} max={56} step={1} onChange={() => {}} aria-label="Button size" />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('min', '40');
    expect(slider).toHaveAttribute('max', '56');
    expect(slider).toHaveAttribute('step', '1');
    expect((slider as HTMLInputElement).value).toBe('48');
  });

  it('calls onChange with numeric value on change', () => {
    const onChange = jest.fn();
    render(<Slider value={48} min={40} max={56} step={1} onChange={onChange} aria-label="Button size" />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '52' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toBe(52);
  });

  it('exposes aria-valuenow/min/max', () => {
    render(<Slider value={0.7} min={0} max={1} step={0.1} onChange={() => {}} aria-label="BG opacity" />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuenow', '0.7');
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '1');
  });

  it('requires aria-label', () => {
    render(<Slider value={0.7} min={0} max={1} step={0.1} onChange={() => {}} aria-label="BG opacity" />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-label', 'BG opacity');
  });

  it('sets --progress CSS custom property from value', () => {
    render(<Slider value={48} min={40} max={56} step={1} onChange={() => {}} aria-label="Button size" />);
    const slider = screen.getByRole('slider') as HTMLInputElement;
    expect(slider.style.getPropertyValue('--progress')).toBe('50%');
  });

  it('forwards data-cell-id', () => {
    render(<Slider value={48} min={40} max={56} step={1} onChange={() => {}} aria-label="Test" data-cell-id="my-slider" />);
    expect(screen.getByTestId('my-slider')).toBeInTheDocument();
  });

  it('forwards id', () => {
    render(<Slider value={48} min={40} max={56} step={1} onChange={() => {}} aria-label="Test" id="my-id" />);
    expect(screen.getByRole('slider')).toHaveAttribute('id', 'my-id');
  });
});
