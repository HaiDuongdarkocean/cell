import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect } from '@jest/globals';
import { HintIcon } from '@/shared/ui/HintIcon';

describe('HintIcon', () => {
  it('renders hint button', () => {
    render(
      <HintIcon
        hint="This is a hint"
        ariaLabel="Show hint"
      />
    );
    const button = screen.getByRole('button', { name: 'Show hint' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles popover when button clicked', () => {
    render(
      <HintIcon
        hint="This is a hint"
        ariaLabel="Show hint"
      />
    );
    const button = screen.getByRole('button', { name: 'Show hint' });
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('This is a hint')).toBeInTheDocument();

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows hint text in popover', () => {
    render(
      <HintIcon
        hint="This is a hint"
        ariaLabel="Show hint"
      />
    );
    const button = screen.getByRole('button', { name: 'Show hint' });
    fireEvent.click(button);
    expect(screen.getByText('This is a hint')).toBeInTheDocument();
  });

  it('applies data-cell-id when provided', () => {
    render(
      <HintIcon
        hint="This is a hint"
        ariaLabel="Show hint"
        dataTestId="test-hint"
      />
    );
    expect(screen.getByTestId('test-hint')).toBeInTheDocument();
  });

  it('applies id when provided', () => {
    render(
      <HintIcon
        hint="This is a hint"
        ariaLabel="Show hint"
        id="hint-id"
      />
    );
    const button = screen.getByRole('button', { name: 'Show hint' });
    expect(button).toHaveAttribute('id', 'hint-id');
  });

  it('closes popover when clicking outside', () => {
    render(
      <div>
        <HintIcon
          hint="This is a hint"
          ariaLabel="Show hint"
        />
        <div data-cell-id="outside">Outside</div>
      </div>
    );
    const button = screen.getByRole('button', { name: 'Show hint' });
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('has tooltip role on popover', () => {
    render(
      <HintIcon
        hint="This is a hint"
        ariaLabel="Show hint"
      />
    );
    const button = screen.getByRole('button', { name: 'Show hint' });
    fireEvent.click(button);

    const popover = screen.getByText('This is a hint');
    expect(popover).toHaveAttribute('role', 'tooltip');
  });
});
