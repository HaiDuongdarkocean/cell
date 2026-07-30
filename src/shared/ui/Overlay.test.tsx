import { render, screen } from '@testing-library/react';
import { Overlay } from './Overlay';

describe('Overlay', () => {
  it('renders children when open', () => {
    render(<Overlay>Content</Overlay>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<Overlay open={false}>Content</Overlay>);
    expect(container.firstChild).toBeNull();
  });

  it('applies fixed positioning and overlay background', () => {
    const { container } = render(<Overlay>Content</Overlay>);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveStyle({ position: 'fixed', inset: '0' });
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
