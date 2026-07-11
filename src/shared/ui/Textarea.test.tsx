import { render, screen, fireEvent } from '@testing-library/react';
import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('renders a textarea', () => {
    render(<Textarea placeholder="Type here" />);
    expect(screen.getByPlaceholderText('Type here')).toBeInTheDocument();
  });

  it('applies resize directions', () => {
    const resizes = ['none', 'vertical', 'horizontal', 'both'] as const;
    for (const resize of resizes) {
      const { unmount } = render(<Textarea resize={resize} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      unmount();
    }
  });

  it('sets error state', () => {
    render(<Textarea error />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('disables textarea', () => {
    render(<Textarea disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('calls onChange', () => {
    const onChange = jest.fn();
    render(<Textarea onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'text' } });
    expect(onChange).toHaveBeenCalled();
  });
});
