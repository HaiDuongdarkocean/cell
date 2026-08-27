import { render, screen, fireEvent } from '@testing-library/react';
import { SliderRow } from './SliderRow';

const baseProps = {
  label: 'Opacity',
  value: 50,
  min: 0,
  max: 100,
  step: 1,
  onChange: jest.fn(),
  'aria-label': 'Opacity slider',
};

describe('SliderRow', () => {
  it('renders label and formatted value', () => {
    render(<SliderRow {...baseProps} />);
    expect(screen.getByText('Opacity')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('renders the range slider and forwards aria-label', () => {
    render(<SliderRow {...baseProps} />);
    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute('aria-label', 'Opacity slider');
  });

  it('propagates onChange when the slider value changes', () => {
    const onChange = jest.fn();
    render(<SliderRow {...baseProps} onChange={onChange} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '75' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(75);
  });

  it('disables the slider and shows a disabled note', () => {
    render(<SliderRow {...baseProps} disabled disabledNote="Turn on to adjust" />);
    expect(screen.getByRole('slider')).toBeDisabled();
    expect(screen.getByText('Turn on to adjust')).toBeInTheDocument();
  });

  it('uses the bubble variant without error', () => {
    const { container } = render(<SliderRow {...baseProps} variant="bubble" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('uses a custom formatValue function', () => {
    render(<SliderRow {...baseProps} value={12} formatValue={(v) => `${v}px`} />);
    expect(screen.getByText('12px')).toBeInTheDocument();
  });
});
