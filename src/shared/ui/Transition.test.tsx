import { render, screen } from '@testing-library/react';
import { Transition } from './Transition';

describe('Transition', () => {
  it('renders children when visible', () => {
    render(<Transition visible>Content</Transition>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders nothing when not visible', () => {
    render(<Transition visible={false}>Hidden</Transition>);
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('applies custom duration via inline style', () => {
    const { container } = render(<Transition visible duration={300}>Content</Transition>);
    const el = container.firstChild as HTMLElement;
    expect(el.style.transitionDuration).toBe('300ms');
  });

  it('applies custom easing via inline style', () => {
    const { container } = render(
      <Transition visible easing="linear">Content</Transition>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.transitionTimingFunction).toBe('linear');
  });
});
