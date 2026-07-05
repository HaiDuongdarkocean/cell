import { render, screen } from '@testing-library/react';
import { ImportProgress } from '@/features/dictionary/ui/ImportProgress';

describe('ImportProgress', () => {
  it('renders processed count without total', () => {
    render(<ImportProgress processed={42} total={0} />);
    expect(screen.getByText(/42 mục/)).toBeInTheDocument();
  });

  it('renders processed / total when total > 0', () => {
    render(<ImportProgress processed={50} total={100} />);
    expect(screen.getByText(/50 \/ 100 mục/)).toBeInTheDocument();
  });

  it('renders cancel button when onCancel provided', () => {
    const onCancel = jest.fn();
    render(<ImportProgress processed={10} total={100} onCancel={onCancel} />);
    expect(screen.getByText('Hủy')).toBeInTheDocument();
  });

  it('does not render cancel button when onCancel not provided', () => {
    render(<ImportProgress processed={10} total={100} />);
    expect(screen.queryByText('Hủy')).not.toBeInTheDocument();
  });
});
