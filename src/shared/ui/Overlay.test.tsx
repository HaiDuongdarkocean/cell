import { render, screen } from '@testing-library/react';
import { Overlay } from './Overlay';

describe('Overlay', () => {
  it('renders children when open', () => {
    render(<Overlay>Content</Overlay>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('hides content when not visible', () => {
    const { container } = render(<Overlay visible={false}>Content</Overlay>);
    expect(container.firstChild).toHaveClass('hidden');
  });

  it('applies the overlay class', () => {
    const { container } = render(<Overlay>Content</Overlay>);
    expect(container.firstChild).toHaveClass('overlay');
  });

  it('calls onClick when backdrop is clicked', () => {
    const onClick = jest.fn();
    const { container } = render(<Overlay onClick={onClick}>Content</Overlay>);
    (container.firstChild as HTMLElement).click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('merges custom className', () => {
    const { container } = render(<Overlay className="extra">Content</Overlay>);
    expect(container.firstChild).toHaveClass('extra');
  });
});
