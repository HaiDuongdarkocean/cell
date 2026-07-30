import { render, screen } from '@testing-library/react';
import { VisuallyHidden } from './VisuallyHidden';

describe('VisuallyHidden', () => {
  it('renders children', () => {
    render(<VisuallyHidden>Screen reader text</VisuallyHidden>);
    expect(screen.getByText('Screen reader text')).toBeInTheDocument();
  });

  it('renders as a span by default', () => {
    render(<VisuallyHidden>Default</VisuallyHidden>);
    expect(screen.getByText('Default').tagName).toBe('SPAN');
  });

  it('renders as a custom element via `as` prop', () => {
    render(<VisuallyHidden as="p">Paragraph</VisuallyHidden>);
    expect(screen.getByText('Paragraph').tagName).toBe('P');
  });

  it('applies the sr-only class', () => {
    const { container } = render(<VisuallyHidden>Hidden</VisuallyHidden>);
    expect(container.firstChild).toHaveClass(expect.stringMatching(/srOnly|sr-only/));
  });
});
