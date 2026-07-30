import { render, screen } from '@testing-library/react';
import { Section } from './Section';

describe('Section', () => {
  it('renders children', () => {
    render(<Section>Content</Section>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders a section element', () => {
    render(<Section>Content</Section>);
    expect(screen.getByText('Content').tagName).toBe('SECTION');
  });

  it('applies default padding6 class', () => {
    const { container } = render(<Section>Content</Section>);
    expect(container.firstChild).toHaveClass('padding6');
  });

  it('applies padding4 class', () => {
    const { container } = render(<Section padding="4">Content</Section>);
    expect(container.firstChild).toHaveClass('padding4');
  });

  it('applies padding10 class', () => {
    const { container } = render(<Section padding="10">Content</Section>);
    expect(container.firstChild).toHaveClass('padding10');
  });

  it('merges custom className', () => {
    const { container } = render(<Section className="extra">Content</Section>);
    expect(container.firstChild).toHaveClass('extra');
  });
});
