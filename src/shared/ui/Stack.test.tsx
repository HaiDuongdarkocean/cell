import { render, screen } from '@testing-library/react';
import { VStack, HStack } from './Stack';

describe('Stack', () => {
  it('VStack renders children', () => {
    render(<VStack>Content</VStack>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('HStack renders children', () => {
    render(<HStack>Content</HStack>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('VStack defaults to vertical direction', () => {
    const { container } = render(<VStack>Content</VStack>);
    expect(container.firstChild).toHaveClass('vertical');
  });

  it('HStack defaults to horizontal direction', () => {
    const { container } = render(<HStack>Content</HStack>);
    expect(container.firstChild).toHaveClass('horizontal');
  });

  it('renders all align values', () => {
    const aligns = ['start', 'center', 'end', 'stretch'] as const;
    for (const align of aligns) {
      const { unmount } = render(<VStack align={align}>{align}</VStack>);
      expect(screen.getByText(align)).toBeInTheDocument();
      unmount();
    }
  });

  it('renders all justify values', () => {
    const justifies = ['start', 'center', 'end', 'between'] as const;
    for (const justify of justifies) {
      const { unmount } = render(<VStack justify={justify}>{justify}</VStack>);
      expect(screen.getByText(justify)).toBeInTheDocument();
      unmount();
    }
  });

  it('applies gap prop', () => {
    const { container } = render(<VStack gap="4">Gapped</VStack>);
    expect(container.firstChild).toHaveClass('gap4');
  });

  it('applies divider prop', () => {
    const { container } = render(<VStack divider>Divided</VStack>);
    expect(container.firstChild).toHaveClass('divider');
  });

  it('HStack applies gap and align', () => {
    const { container } = render(<HStack gap="3" align="center">H</HStack>);
    expect(container.firstChild).toHaveClass('gap3');
    expect(container.firstChild).toHaveClass('alignCenter');
  });

  it('merges custom className', () => {
    const { container } = render(<VStack className="extra">Stack</VStack>);
    expect(container.firstChild).toHaveClass('extra');
  });
});
