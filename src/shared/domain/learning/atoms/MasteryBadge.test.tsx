import { render, screen } from '@testing-library/react';
import { MasteryBadge } from './MasteryBadge';

describe('MasteryBadge', () => {
  it('renders the progress percentage', () => {
    render(<MasteryBadge progress={42} />);
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('renders as a span (display-only)', () => {
    const { container } = render(<MasteryBadge progress={10} />);
    expect(container.firstChild?.nodeName).toBe('SPAN');
    expect(container.firstChild).not.toHaveAttribute('role');
  });

  it('has correct aria-label with derived level', () => {
    render(<MasteryBadge progress={80} />);
    expect(screen.getByLabelText('Mastery: 80%, level: master')).toBeInTheDocument();
  });

  it('derives beginner level for 0–25', () => {
    render(<MasteryBadge progress={10} />);
    expect(screen.getByLabelText('Mastery: 10%, level: beginner')).toBeInTheDocument();
  });

  it('derives intermediate level for 26–50', () => {
    render(<MasteryBadge progress={35} />);
    expect(screen.getByLabelText('Mastery: 35%, level: intermediate')).toBeInTheDocument();
  });

  it('derives advanced level for 51–75', () => {
    render(<MasteryBadge progress={60} />);
    expect(screen.getByLabelText('Mastery: 60%, level: advanced')).toBeInTheDocument();
  });

  it('derives master level for 76–100', () => {
    render(<MasteryBadge progress={100} />);
    expect(screen.getByLabelText('Mastery: 100%, level: master')).toBeInTheDocument();
  });

  it('clamps progress below 0 to 0', () => {
    render(<MasteryBadge progress={-20} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('clamps progress above 100 to 100', () => {
    render(<MasteryBadge progress={150} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('hides progress when showProgress is false', () => {
    render(<MasteryBadge progress={50} showProgress={false} />);
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
  });

  it('renders custom children label', () => {
    render(<MasteryBadge progress={70}>Vocab</MasteryBadge>);
    expect(screen.getByText('Vocab')).toBeInTheDocument();
  });

  it('merges custom className', () => {
    const { container } = render(<MasteryBadge progress={40} className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
