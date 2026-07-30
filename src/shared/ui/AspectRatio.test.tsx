import { render, screen } from '@testing-library/react';
import { AspectRatio } from './AspectRatio';

describe('AspectRatio', () => {
  it('renders children', () => {
    render(<AspectRatio>Content</AspectRatio>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('applies default 16:9 padding-top', () => {
    const { container } = render(<AspectRatio>Content</AspectRatio>);
    const box = container.firstChild as HTMLElement;
    expect(box.style.paddingTop).toBe('6.25%');
  });

  it('applies 1:1 padding-top for square ratio', () => {
    const { container } = render(<AspectRatio ratio={1}>Square</AspectRatio>);
    const box = container.firstChild as HTMLElement;
    expect(box.style.paddingTop).toBe('100%');
  });

  it('renders content with the content class', () => {
    const { container } = render(<AspectRatio>Content</AspectRatio>);
    const content = container.querySelector('[class*="content"]');
    expect(content).toHaveClass('content');
  });

  it('merges custom className', () => {
    const { container } = render(<AspectRatio className="extra">Content</AspectRatio>);
    expect(container.firstChild).toHaveClass('extra');
  });
});
