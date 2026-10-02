import { render, screen, fireEvent, within } from '@testing-library/react';
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

  it('collapses long ranges to boundary pages with a single ellipsis', () => {
    render(<Pagination current={0} total={100} onChange={() => {}} showJump={false} />);
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '99' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '100' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '50' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /show all pages/i })).toHaveLength(1);
  });

  it('shows sibling pages around the current page with ellipses on both sides', () => {
    render(<Pagination current={49} total={100} onChange={() => {}} showJump={false} />);
    for (const n of ['49', '50', '51']) {
      expect(screen.getByRole('button', { name: n })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('button', { name: /show all pages/i })).toHaveLength(2);
  });

  it('jumps to the page typed in the ellipsis popover on Enter', () => {
    const handleChange = jest.fn();
    render(<Pagination current={0} total={100} onChange={handleChange} showJump={false} />);
    fireEvent.click(screen.getByRole('button', { name: /show all pages/i }));
    const dialog = screen.getByRole('dialog', { name: /jump to page/i });
    const input = within(dialog).getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(handleChange).toHaveBeenCalledWith(41);
    expect(screen.queryByRole('dialog', { name: /jump to page/i })).not.toBeInTheDocument();
  });

  it('scrubs pages via the popover slider', () => {
    const handleChange = jest.fn();
    render(<Pagination current={0} total={100} onChange={handleChange} showJump={false} />);
    fireEvent.click(screen.getByRole('button', { name: /show all pages/i }));
    fireEvent.change(screen.getByRole('slider', { name: /jump to page/i }), { target: { value: '42' } });
    expect(handleChange).toHaveBeenCalledWith(41);
  });

  it('blurs the clicked button after pointer activation', () => {
    render(<Pagination current={0} total={5} onChange={() => {}} />);
    const btn = screen.getByRole('button', { name: '3' });
    btn.focus();
    fireEvent.click(btn, { detail: 1 });
    expect(btn).not.toHaveFocus();
  });

  it('keeps focus on keyboard-activated clicks', () => {
    render(<Pagination current={0} total={5} onChange={() => {}} />);
    const btn = screen.getByRole('button', { name: '3' });
    btn.focus();
    fireEvent.click(btn);
    expect(btn).toHaveFocus();
  });

  it('closes the popover on outside pointerdown', () => {
    render(<Pagination current={0} total={100} onChange={() => {}} showJump={false} />);
    fireEvent.click(screen.getByRole('button', { name: /show all pages/i }));
    expect(screen.getByRole('dialog', { name: /jump to page/i })).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('dialog', { name: /jump to page/i })).not.toBeInTheDocument();
  });
});
