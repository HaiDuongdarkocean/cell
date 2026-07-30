import { render, screen } from '@testing-library/react';
import { LevelIndicator } from './LevelIndicator';

describe('LevelIndicator', () => {
  it('renders the level label by default', () => {
    render(<LevelIndicator level="B1" />);
    expect(screen.getByText('B1')).toBeInTheDocument();
  });

  it('renders as a span (display-only)', () => {
    const { container } = render(<LevelIndicator level="A1" />);
    expect(container.firstChild?.nodeName).toBe('SPAN');
    expect(container.firstChild).not.toHaveAttribute('role');
  });

  it('has correct aria-label', () => {
    render(<LevelIndicator level="C2" />);
    expect(screen.getByLabelText('CEFR level: C2')).toBeInTheDocument();
  });

  it('hides label when showLabel is false', () => {
    render(<LevelIndicator level="B2" showLabel={false} />);
    expect(screen.queryByText('B2')).not.toBeInTheDocument();
    expect(screen.getByLabelText('CEFR level: B2')).toBeInTheDocument();
  });

  it('renders all CEFR levels', () => {
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
    for (const level of levels) {
      const { unmount } = render(<LevelIndicator level={level} />);
      expect(screen.getByLabelText(`CEFR level: ${level}`)).toBeInTheDocument();
      unmount();
    }
  });

  it('renders custom children when provided', () => {
    render(<LevelIndicator level="A2">Beginner</LevelIndicator>);
    expect(screen.getByText('Beginner')).toBeInTheDocument();
  });

  it('merges custom className', () => {
    const { container } = render(<LevelIndicator level="A1" className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
