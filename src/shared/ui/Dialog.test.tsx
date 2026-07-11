import { render, screen, fireEvent } from '@testing-library/react';
import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('renders when open', () => {
    render(
      <Dialog open title="Title" description="Desc" footer={<button>Action</button>}>
        Content
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Desc')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    const { container } = render(<Dialog open={false}>Content</Dialog>);
    expect(container.firstChild).toBeNull();
  });

  it('calls onOpenChange with false on overlay click', () => {
    const onOpenChange = jest.fn();
    render(<Dialog open title="Title" onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('presentation'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange with false on Escape', () => {
    const onOpenChange = jest.fn();
    render(<Dialog open title="Title" onOpenChange={onOpenChange} />);
    fireEvent.keyDown(screen.getByRole('presentation'), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders close button and closes on click', () => {
    const onOpenChange = jest.fn();
    render(<Dialog open title="Title" onOpenChange={onOpenChange} showCloseButton />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
