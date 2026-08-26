import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('renders page numbers and navigation buttons', () => {
    render(<Pagination current={0} total={5} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /first page/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous page/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /last page/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /jump to page/i })).toBeInTheDocument();
  });

  it('calls onChange with correct page index', () => {
    const handleChange = jest.fn();
    render(<Pagination current={0} total={5} onChange={handleChange} />);
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(handleChange).toHaveBeenCalledWith(2);
  });

  it('disables first and previous on first page', () => {
    render(<Pagination current={0} total={5} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /first page/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
  });

  it('disables next and last on last page', () => {
    render(<Pagination current={4} total={5} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /last page/i })).toBeDisabled();
  });

  it('jumps to typed page on Enter', () => {
    const handleChange = jest.fn();
    render(<Pagination current={0} total={10} onChange={handleChange} />);
    const input = screen.getByRole('spinbutton', { name: /jump to page/i });
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(handleChange).toHaveBeenCalledWith(4);
  });
});
