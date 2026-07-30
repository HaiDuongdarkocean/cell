import { render, screen } from '@testing-library/react';
import { ExampleSentence } from './ExampleSentence';

describe('ExampleSentence', () => {
  it('renders a p element by default', () => {
    const { container } = render(<ExampleSentence>She found the book by serendipity.</ExampleSentence>);
    expect(container.querySelector('p')).not.toBeNull();
    expect(screen.getByText('She found the book by serendipity.')).toBeInTheDocument();
  });

  it('renders a blockquote when blockquote=true', () => {
    const { container } = render(<ExampleSentence blockquote>A quote.</ExampleSentence>);
    expect(container.querySelector('blockquote')).not.toBeNull();
  });

  it('highlights the specified word with mark', () => {
    const { container } = render(<ExampleSentence highlight="serendipity">She found the book by serendipity.</ExampleSentence>);
    expect(container.querySelector('mark')).not.toBeNull();
  });

  it('renders translation when provided', () => {
    render(<ExampleSentence translation="Cô ấy tìm thấy cuốn sách một cách tình cờ.">She found the book by serendipity.</ExampleSentence>);
    expect(screen.getByText('Cô ấy tìm thấy cuốn sách một cách tình cờ.')).toBeInTheDocument();
  });

  it('does not render mark when no highlight provided', () => {
    const { container } = render(<ExampleSentence>No highlight here.</ExampleSentence>);
    expect(container.querySelector('mark')).toBeNull();
  });

  it('merges custom className', () => {
    const { container } = render(<ExampleSentence className="extra">test</ExampleSentence>);
    expect(container.firstChild).toHaveClass('extra');
  });
});
