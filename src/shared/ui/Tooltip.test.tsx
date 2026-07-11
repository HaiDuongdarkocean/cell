import { render, screen, fireEvent } from '@testing-library/react';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('sets aria-describedby on trigger', () => {
    render(
      <Tooltip content="Help">
        <button>Hover me</button>
      </Tooltip>,
    );
    expect(screen.getByRole('button', { name: 'Hover me' })).toHaveAttribute('aria-describedby');
  });

  it('shows tooltip on mouse enter and hides on leave', () => {
    render(
      <Tooltip content="Help">
        <button>Hover me</button>
      </Tooltip>,
    );
    const button = screen.getByRole('button', { name: 'Hover me' });
    fireEvent.mouseEnter(button);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Help');
    fireEvent.mouseLeave(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
