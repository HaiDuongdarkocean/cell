import { render, screen } from '@testing-library/react';
import { Label } from './Label';

describe('Label', () => {
  it('renders children with htmlFor', () => {
    render(<Label htmlFor="field">Name</Label>);
    const label = screen.getByText('Name');
    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute('for', 'field');
  });

  it('shows a required indicator', () => {
    render(<Label required>Email</Label>);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('applies disabled styling', () => {
    const { container } = render(<Label disabled>Field</Label>);
    expect(container.firstChild).toHaveClass('disabled');
  });

  it('merges custom className', () => {
    const { container } = render(<Label className="extra">Field</Label>);
    expect(container.firstChild).toHaveClass('extra');
  });
});
