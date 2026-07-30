import { render, screen } from '@testing-library/react';
import { Text } from './Text';

describe('Text', () => {
  it('renders children', () => {
    render(<Text>Hello</Text>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders all variants', () => {
    const variants = ['body', 'label', 'heading-1', 'heading-2', 'heading-3', 'supporting'] as const;
    for (const variant of variants) {
      const { unmount } = render(<Text variant={variant}>{variant}</Text>);
      expect(screen.getByText(variant)).toBeInTheDocument();
      unmount();
    }
  });

  it('renders all colors', () => {
    const colors = ['primary', 'secondary', 'disabled', 'inverse'] as const;
    for (const color of colors) {
      const { unmount } = render(<Text color={color}>{color}</Text>);
      expect(screen.getByText(color)).toBeInTheDocument();
      unmount();
    }
  });

  it('applies truncate class', () => {
    const { container } = render(<Text truncate>Truncated</Text>);
    expect(container.firstChild).toHaveClass('truncate');
  });

  it('renders as custom element', () => {
    render(<Text as="p">Paragraph</Text>);
    const el = screen.getByText('Paragraph');
    expect(el.tagName).toBe('P');
  });

  it('merges custom className', () => {
    const { container } = render(<Text className="extra">Custom</Text>);
    expect(container.firstChild).toHaveClass('extra');
  });

  it('renders as span by default', () => {
    render(<Text>Default</Text>);
    const el = screen.getByText('Default');
    expect(el.tagName).toBe('SPAN');
  });
});
