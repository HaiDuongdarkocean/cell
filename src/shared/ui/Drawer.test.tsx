import { render, screen, fireEvent } from '@testing-library/react';
import { Drawer } from './Drawer';

describe('Drawer', () => {
  it('renders when open', () => {
    render(<Drawer open title="Drawer" footer={<button>Action</button>}>Content</Drawer>);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Drawer')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    const { container } = render(<Drawer open={false}>Content</Drawer>);
    expect(container.firstChild).toBeNull();
  });

  it('calls onOpenChange with false on overlay click', () => {
    const onOpenChange = jest.fn();
    render(<Drawer open title="Drawer" onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('presentation'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange with false on Escape', () => {
    const onOpenChange = jest.fn();
    render(<Drawer open title="Drawer" onOpenChange={onOpenChange} />);
    fireEvent.keyDown(screen.getByRole('presentation'), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
