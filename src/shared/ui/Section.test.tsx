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

  it('applies default md size class', () => {
    const { container } = render(<Section>Content</Section>);
    expect(container.firstChild).toHaveClass('md');
  });

  it('applies sm size class', () => {
    const { container } = render(<Section size="sm">Content</Section>);
    expect(container.firstChild).toHaveClass('sm');
  });

  it('applies lg size class', () => {
    const { container } = render(<Section size="lg">Content</Section>);
    expect(container.firstChild).toHaveClass('lg');
  });

  it('merges custom className', () => {
    const { container } = render(<Section className="extra">Content</Section>);
    expect(container.firstChild).toHaveClass('extra');
  });
});
