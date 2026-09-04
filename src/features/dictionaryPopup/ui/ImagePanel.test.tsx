import { describe, expect, it, jest } from '@jest/globals';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ImagePanel } from './ImagePanel';
import type { ImageItem } from '../types';

function makeImage(id: string, selected = false): ImageItem {
  return {
    id,
    src: `https://example.com/${id}.jpg`,
    alt: `image ${id}`,
    defaultSelected: selected,
  };
}

const selection = (entries: [string, boolean][]) => new Map(entries);

describe('ImagePanel', () => {
  it('renders a skeleton while loading', () => {
    render(
      <ImagePanel
        items={[]}
        loading
        error={null}
        selection={new Map()}
        onToggle={jest.fn()}
        onImageError={jest.fn()}
        term="hello"
      />,
    );

    expect(screen.getByTestId('dictionary-image-panel')).toBeInTheDocument();
    expect(screen.getByTestId('dictionary-image-panel').querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('renders an error message', () => {
    render(
      <ImagePanel
        items={[]}
        loading={false}
        error="image search failed"
        selection={new Map()}
        onToggle={jest.fn()}
        onImageError={jest.fn()}
        term="hello"
      />,
    );

    expect(screen.getByText('image search failed')).toBeInTheDocument();
  });

  it('renders a Google Images fallback link when empty', () => {
    render(
      <ImagePanel
        items={[]}
        loading={false}
        error={null}
        selection={new Map()}
        onToggle={jest.fn()}
        onImageError={jest.fn()}
        term="hello"
      />,
    );

    const panel = screen.getByTestId('dictionary-image-panel');
    const link = within(panel).getByRole('link', { name: /Search Google Images/i });
    expect(link).toHaveAttribute('href', 'https://www.google.com/search?tbm=isch&q=hello');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders image items and toggles selection', () => {
    const onToggle = jest.fn();
    const item = makeImage('i1');
    render(
      <ImagePanel
        items={[item]}
        loading={false}
        error={null}
        selection={selection([['i1', false]])}
        onToggle={onToggle}
        onImageError={jest.fn()}
        term="hello"
      />,
    );

    const button = screen.getByRole('checkbox', { name: /image i1/i });
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledWith('i1', true);
  });

  it('renders scroll controls and scrolls the strip', () => {
    const item = makeImage('i1');
    render(
      <ImagePanel
        items={[item]}
        loading={false}
        error={null}
        selection={selection([['i1', false]])}
        onToggle={jest.fn()}
        onImageError={jest.fn()}
        term="hello"
      />,
    );

    const left = screen.getByRole('button', { name: /Scroll images left/i });
    const right = screen.getByRole('button', { name: /Scroll images right/i });
    expect(left).toBeDisabled();
    expect(right).toBeEnabled();

    const strip = screen.getByTestId('dictionary-image-strip');
    const scrollBy = jest.fn();
    strip.scrollBy = scrollBy;
    Object.defineProperty(strip, 'clientWidth', { value: 200, configurable: true });

    fireEvent.click(right);
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ left: 128, behavior: 'smooth' }));
  });

  it('marks selected items', () => {
    const item = makeImage('i1', true);
    render(
      <ImagePanel
        items={[item]}
        loading={false}
        error={null}
        selection={selection([['i1', true]])}
        onToggle={jest.fn()}
        onImageError={jest.fn()}
        term="hello"
      />,
    );

    const button = screen.getByRole('checkbox', { name: /image i1/i });
    expect(button).toHaveAttribute('aria-checked', 'true');
  });
});
