import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HintIcon } from './HintIcon';

const baseProps = {
  hint: 'This is the hint text',
  ariaLabel: 'More information',
  dataTestId: 'hint-btn',
};

describe('HintIcon', () => {
  it('renders the hint button with accessible label', () => {
    render(<HintIcon {...baseProps} />);
    expect(screen.getByTestId('hint-btn')).toHaveAttribute('aria-label', 'More information');
  });

  it('toggles popover open and closed on button click', () => {
    render(<HintIcon {...baseProps} />);
    const button = screen.getByTestId('hint-btn');

    fireEvent.click(button);
    expect(screen.getByRole('tooltip')).toHaveTextContent('This is the hint text');
    expect(button).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes popover on Escape key', async () => {
    render(<HintIcon {...baseProps} />);
    fireEvent.click(screen.getByTestId('hint-btn'));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('closes popover when clicking outside', async () => {
    render(<HintIcon {...baseProps} />);
    fireEvent.click(screen.getByTestId('hint-btn'));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });
});
