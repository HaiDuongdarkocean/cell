import { render, screen } from '@testing-library/react';
import { SourceBadge } from './SourceBadge';

describe('SourceBadge', () => {
  it('renders the label text', () => {
    render(<SourceBadge source="cambridge">Cambridge</SourceBadge>);
    expect(screen.getByText('Cambridge')).toBeInTheDocument();
  });

  it('renders a span element', () => {
    const { container } = render(<SourceBadge source="oxford">Oxford</SourceBadge>);
    expect(container.querySelector('span')).not.toBeNull();
  });

  it('renders correct aria-label for each source', () => {
    const sources = ['cambridge', 'oxford', 'merriam-webster', 'collins', 'longman'] as const;
    for (const source of sources) {
      const { unmount } = render(<SourceBadge source={source}>{source}</SourceBadge>);
      expect(screen.getByLabelText(`Source: ${source}`)).toBeInTheDocument();
      unmount();
    }
  });

  it('merges custom className', () => {
    const { container } = render(<SourceBadge source="cambridge" className="extra">Cambridge</SourceBadge>);
    expect(container.firstChild).toHaveClass('extra');
  });
});
