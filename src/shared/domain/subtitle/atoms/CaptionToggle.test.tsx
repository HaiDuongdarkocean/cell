import { render, screen, fireEvent } from '@testing-library/react';
import { CaptionToggle } from './CaptionToggle';

describe('CaptionToggle', () => {
  it('renders with role="switch"', () => {
    render(
      <CaptionToggle
        enabled={false}
        onChange={() => {}}
        trackLabel="English"
      />,
    );
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('reflects enabled state in aria-checked', () => {
    render(
      <CaptionToggle
        enabled={true}
        onChange={() => {}}
        trackLabel="English"
      />,
    );
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('reflects disabled state in aria-checked', () => {
    render(
      <CaptionToggle
        enabled={false}
        onChange={() => {}}
        trackLabel="English"
      />,
    );
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('builds dynamic aria-label with track label and On state', () => {
    render(
      <CaptionToggle
        enabled={true}
        onChange={() => {}}
        trackLabel="English"
      />,
    );
    expect(screen.getByRole('switch')).toHaveAttribute(
      'aria-label',
      'Captions: English — On',
    );
  });

  it('builds dynamic aria-label with track label and Off state', () => {
    render(
      <CaptionToggle
        enabled={false}
        onChange={() => {}}
        trackLabel="Spanish"
      />,
    );
    expect(screen.getByRole('switch')).toHaveAttribute(
      'aria-label',
      'Captions: Spanish — Off',
    );
  });

  it('calls onChange with toggled value on click', () => {
    const onChange = jest.fn();
    render(
      <CaptionToggle
        enabled={false}
        onChange={onChange}
        trackLabel="English"
      />,
    );
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not call onChange when disabled', () => {
    const onChange = jest.fn();
    render(
      <CaptionToggle
        enabled={false}
        onChange={onChange}
        trackLabel="English"
        disabled
      />,
    );
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('applies data-cell-id', () => {
    render(
      <CaptionToggle
        enabled={false}
        onChange={() => {}}
        trackLabel="English"
        dataTestId="caption-toggle"
      />,
    );
    expect(screen.getByTestId('caption-toggle')).toBeInTheDocument();
  });
});
