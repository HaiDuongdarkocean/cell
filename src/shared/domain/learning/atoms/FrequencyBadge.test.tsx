import { render, screen } from '@testing-library/react';
import { FrequencyBadge } from './FrequencyBadge';

describe('FrequencyBadge', () => {
  it('renders the level as children by default', () => {
    render(<FrequencyBadge level="common" />);
    expect(screen.getByText('common')).toBeInTheDocument();
  });

  it('renders custom children when provided', () => {
    render(<FrequencyBadge level="rare">Very Rare</FrequencyBadge>);
    expect(screen.getByText('Very Rare')).toBeInTheDocument();
  });

  it('renders as a span (display-only)', () => {
    const { container } = render(<FrequencyBadge level="common" />);
    expect(container.firstChild).not.toHaveAttribute('role');
    expect(container.firstChild?.nodeName).toBe('SPAN');
  });

  it('has correct aria-label', () => {
    render(<FrequencyBadge level="academic" />);
    expect(screen.getByLabelText('Frequency: academic')).toBeInTheDocument();
  });

  it('renders all levels', () => {
    const levels = ['common', 'frequent', 'rare', 'academic', 'archaic'] as const;
    for (const level of levels) {
      const { unmount } = render(<FrequencyBadge level={level} />);
      expect(screen.getByLabelText(`Frequency: ${level}`)).toBeInTheDocument();
      unmount();
    }
  });

  it('merges custom className', () => {
    const { container } = render(<FrequencyBadge level="common" className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
