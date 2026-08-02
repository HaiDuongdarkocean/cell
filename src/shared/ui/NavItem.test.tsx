import { render, screen, fireEvent } from '@testing-library/react';
import { NavItem } from './NavItem';

describe('NavItem', () => {
  it('renders icon and label', () => {
    render(<NavItem icon={<span data-cell-id="icon">I</span>} label="Home" />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('supports active and disabled', () => {
    const { container } = render(<NavItem label="Home" active disabled />);
    expect(container.firstChild).toHaveClass('active');
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls onClick', () => {
    const onClick = jest.fn();
    render(<NavItem label="Home" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders horizontal orientation', () => {
    const { container } = render(<NavItem label="Home" orientation="horizontal" />);
    expect(container.firstChild).toHaveClass('horizontal');
  });
});
