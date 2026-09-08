import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { InkTabs } from './InkTabs';

describe('InkTabs', () => {
  it('renders tabs with labels and badges', () => {
    render(
      <InkTabs
        aria-label="Test tabs"
        items={[
          { value: 'a', label: 'Tab A', badge: 3 },
          { value: 'b', label: 'Tab B' },
          { value: 'c', label: 'Tab C', badge: 12 },
        ]}
        value="a"
        onValueChange={jest.fn()}
      />,
    );

    expect(screen.getByRole('tab', { name: /Tab A/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Tab B/ })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('calls onValueChange when a tab is clicked', () => {
    const onValueChange = jest.fn();
    render(
      <InkTabs
        aria-label="Test tabs"
        items={[
          { value: 'a', label: 'Tab A' },
          { value: 'b', label: 'Tab B' },
        ]}
        value="a"
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Tab B' }));
    expect(onValueChange).toHaveBeenCalledWith('b');
  });

  it('navigates with arrow keys and wraps around', () => {
    const onValueChange = jest.fn();
    render(
      <InkTabs
        aria-label="Test tabs"
        items={[
          { value: 'a', label: 'Tab A' },
          { value: 'b', label: 'Tab B' },
          { value: 'c', label: 'Tab C' },
        ]}
        value="a"
        onValueChange={onValueChange}
      />,
    );

    const tablist = screen.getByRole('tablist');
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onValueChange).toHaveBeenCalledWith('b');
    onValueChange.mockClear();

    // Without a controlling parent re-rendering, aria-selected stays on 'a',
    // so subsequent arrow nav starts from 'a'.
    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(onValueChange).toHaveBeenCalledWith('c');
    onValueChange.mockClear();

    fireEvent.keyDown(tablist, { key: 'End' });
    expect(onValueChange).toHaveBeenCalledWith('c');
    onValueChange.mockClear();

    fireEvent.keyDown(tablist, { key: 'Home' });
    expect(onValueChange).toHaveBeenCalledWith('a');
  });

  it('skips disabled tabs during keyboard navigation', () => {
    const onValueChange = jest.fn();
    render(
      <InkTabs
        aria-label="Test tabs"
        items={[
          { value: 'a', label: 'Tab A' },
          { value: 'b', label: 'Tab B', disabled: true },
          { value: 'c', label: 'Tab C' },
        ]}
        value="a"
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Tab B' }));
    expect(onValueChange).not.toHaveBeenCalled();

    const tablist = screen.getByRole('tablist');
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(onValueChange).toHaveBeenCalledWith('c');
  });
});
